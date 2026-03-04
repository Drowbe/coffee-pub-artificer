// ==================================================================
// ===== GATHER MANAGER (Phase 1: Herb / component gathering) ======
// ==================================================================
// Temporary herb gather: GM requests roll (Herbalism Kit), compare to DC,
// then send chat card (failure or success + add items to actor).
// ==================================================================

import { MODULE } from './const.js';
import { BlacksmithAPI } from '/modules/coffee-pub-blacksmith/api/blacksmith-api.js';
import { OFFICIAL_BIOMES } from './schema-ingredients.js';
import { ARTIFICER_TYPES, FAMILIES_BY_TYPE, FAMILY_LABELS, ARTIFICER_FLAG_KEYS } from './schema-artificer-item.js';
import { getFamilyFromFlags } from './utility-artificer-item.js';
import { addCraftedItemToActor } from './utility-artificer-item.js';
import { getAllRecordsFromCache, getAllItemsFromCache } from './cache/cache-items.js';
import { getAPI } from './api-artificer.js';
import { getLearnedPerkIdsForSkill, getEffectiveGatheringRules, getEffectiveComponentSkillAccess, getAppliedGatheringPerksForDisplay, getComponentAutoGatherPerkNames } from './skills-rules.js';
import { getFromCache } from './cache/cache-items.js';

/** @typedef {{ dc: number, biomes: string[], componentTypes: string[], skillIds?: string[], sourcePinId?: string|null, sourceSceneId?: string|null }} PendingGather */

let _pendingGather = null;
const GATHER_SOCKET_EVENT = `${MODULE.ID}.gatherRollResolved`;
let _gatherSocketApi = null;
let _gatherSocketRegistered = false;
const _gatherRollBuffers = new Map(); // requestId -> Array<{ actor: Actor|null, outcome: object }>
const DEFAULT_GATHER_SKILLS = ['Herbalism'];

/**
 * Get biome options for multiselect (create-window style: name + selected).
 * @param {string[]} selectedBiomes - Currently selected biome keys
 * @returns {Array<{ name: string, selected: boolean }>}
 */
export function getBiomeOptionsForMultiselect(selectedBiomes = []) {
    const set = new Set(Array.isArray(selectedBiomes) ? selectedBiomes : []);
    return OFFICIAL_BIOMES.map((b) => ({ name: b, selected: set.has(b) }));
}

/**
 * Get biome options for dropdown (value + label). Prefer getBiomeOptionsForMultiselect for gather window.
 * @returns {Array<{ value: string, label: string }>}
 */
export function getBiomeOptions() {
    return OFFICIAL_BIOMES.map((b) => ({ value: b, label: b }));
}

/**
 * Get component type (family) options for checkboxes.
 * Uses ARTIFICER_TYPES.COMPONENT families.
 * @returns {Array<{ value: string, label: string }>}
 */
export function getComponentTypeOptions() {
    const families = FAMILIES_BY_TYPE[ARTIFICER_TYPES.COMPONENT] ?? [];
    return families.map((f) => ({ value: f, label: FAMILY_LABELS[f] ?? f }));
}

/**
 * Set pending gather context (used when Request Roll is sent; cleared when roll completes).
 * @param {PendingGather} ctx
 */
export function setPendingGather(ctx) {
    _pendingGather = ctx;
}

/**
 * Get and clear pending gather context.
 * @returns {PendingGather|null}
 */
export function consumePendingGather() {
    const p = _pendingGather;
    _pendingGather = null;
    return p;
}

function _normalizeGatherSkillIds(skillIds) {
    const raw = Array.isArray(skillIds) ? skillIds : DEFAULT_GATHER_SKILLS;
    const cleaned = raw.map((s) => String(s).trim()).filter(Boolean);
    return [...new Set(cleaned)];
}

async function _getGatheringSkillContext(actor, skillIds = DEFAULT_GATHER_SKILLS) {
    const enabledSkillIds = _normalizeGatherSkillIds(skillIds);
    if (!enabledSkillIds.length) {
        return {
            enabledSkillIds,
            hasEnabledSceneSkills: false,
            hasActorHarvestingSkill: false,
            gatheringRollBonus: 0,
            gatheringYieldMultiplier: 1,
            appliedPerks: [],
            componentSkillRanges: [],
            componentAutoGatherBySkill: {},
            activeSkillIds: []
        };
    }

    if (!actor) {
        return {
            enabledSkillIds,
            hasEnabledSceneSkills: true,
            hasActorHarvestingSkill: false,
            gatheringRollBonus: 0,
            gatheringYieldMultiplier: 1,
            appliedPerks: [],
            componentSkillRanges: [],
            componentAutoGatherBySkill: {},
            activeSkillIds: []
        };
    }

    const learnedPerkIds = await getAPI().skills.getLearnedPerks(actor);
    const combinedAppliedPerks = [];
    const combinedRanges = [];
    const componentAutoGatherBySkill = {};
    const activeSkillIds = [];
    let gatheringRollBonus = 0;
    let gatheringYieldMultiplier = 1;

    for (const skillId of enabledSkillIds) {
        const skillPerks = getLearnedPerkIdsForSkill(learnedPerkIds ?? [], skillId);
        if (!skillPerks.length) continue;
        activeSkillIds.push(skillId);

        const rules = await getEffectiveGatheringRules(skillId, skillPerks);
        gatheringRollBonus += Number(rules.gatheringRollBonus) || 0;
        gatheringYieldMultiplier = Math.max(gatheringYieldMultiplier, Math.floor(Number(rules.gatheringYieldMultiplier) || 1));
        if (rules.componentAutoGather) componentAutoGatherBySkill[skillId] = rules.componentAutoGather;

        const ranges = await getEffectiveComponentSkillAccess(skillId, skillPerks);
        for (const range of ranges ?? []) combinedRanges.push(range);

        const applied = await getAppliedGatheringPerksForDisplay(skillId, skillPerks);
        for (const perk of applied ?? []) combinedAppliedPerks.push(perk);
    }

    return {
        enabledSkillIds,
        hasEnabledSceneSkills: true,
        hasActorHarvestingSkill: activeSkillIds.length > 0,
        gatheringRollBonus,
        gatheringYieldMultiplier: Math.max(1, gatheringYieldMultiplier),
        appliedPerks: combinedAppliedPerks,
        componentSkillRanges: combinedRanges,
        componentAutoGatherBySkill,
        activeSkillIds
    };
}

/**
 * Get cache records that match selected biomes and component families (no fromUuid).
 * Only returns items that are Artificer type Component. Item eligible if it has no biomes or its biomes intersect selected.
 * Records include a tier (skill level) from the item flags.
 * @param {string[]} biomes - Selected biomes (e.g. ['FOREST', 'HILL'])
 * @param {string[]} families - Selected component families (e.g. ['Plant', 'Mineral'])
 * @returns {Array<{ name: string, uuid: string, family: string, img?: string, biomes?: string[], tier?: number }>}
 */
export function getEligibleGatherRecords(biomes, families) {
    if (!biomes?.length || !families?.length) return [];
    const records = getAllRecordsFromCache();
    const biomeSet = new Set(biomes.map((b) => String(b).trim()).filter(Boolean));
    const familySet = new Set(families.map((f) => f.trim()).filter(Boolean));
    return records.filter((rec) => {
        if ((rec.artificerType ?? null) !== ARTIFICER_TYPES.COMPONENT) return false;
        const itemFamily = rec.family ?? '';
        if (!itemFamily || !familySet.has(itemFamily)) return false;
        const recBiomes = Array.isArray(rec.biomes) ? rec.biomes : [];
        if (recBiomes.length === 0) return true;
        return recBiomes.some((b) => biomeSet.has(b));
    });
}

/**
 * Get items from cache that match biomes and selected component families.
 * @param {string[]} biomes - Selected biomes
 * @param {string[]} families - Selected component families (e.g. ['Plant', 'Mineral'])
 * @returns {Promise<Item[]>}
 */
export async function getEligibleGatherItems(biomes, families) {
    if (!biomes?.length || !families?.length) return [];
    const items = await getAllItemsFromCache();
    const flagsKey = MODULE.ID;
    const biomeSet = new Set(biomes.map((b) => String(b).trim()).filter(Boolean));
    const familySet = new Set(families.map((f) => f.trim()).filter(Boolean));
    return items.filter((item) => {
        const f = item.flags?.[flagsKey] || item.flags?.artificer;
        if ((f?.[ARTIFICER_FLAG_KEYS.TYPE] ?? f?.type) !== ARTIFICER_TYPES.COMPONENT) return false;
        const itemFamily = getFamilyFromFlags(f);
        if (!itemFamily || !familySet.has(itemFamily)) return false;
        const itemBiomes = f?.[ARTIFICER_FLAG_KEYS.BIOMES] ?? f?.biomes ?? [];
        if (!Array.isArray(itemBiomes) || itemBiomes.length === 0) return true;
        return itemBiomes.some((b) => biomeSet.has(b));
    });
}

/**
 * Pick one random record from list (or first if single). Returns record or null.
 * @param {Array<{ uuid: string, name?: string }>} records
 * @returns {typeof records[0] | null}
 */
export function pickOneGatherRecord(records) {
    if (!records?.length) return null;
    const idx = records.length === 1 ? 0 : Math.floor(Math.random() * records.length);
    return records[idx] ?? null;
}

/**
 * Pick one random item from list (or first if single). Returns Item or null.
 * @param {Item[]} items
 * @returns {Item|null}
 */
export function pickOneGatherItem(items) {
    if (!items?.length) return null;
    const idx = items.length === 1 ? 0 : Math.floor(Math.random() * items.length);
    return items[idx] ?? null;
}

/**
 * Add a single item (by cloning to actor) to the actor. Uses addCraftedItemToActor.
 * @param {Actor} actor
 * @param {Item} item - Source item (e.g. from compendium)
 * @returns {Promise<Item|null>}
 */
export async function addGatherItemToActor(actor, item) {
    if (!actor || !item) return null;
    const data = item.toObject?.();
    if (!data) return null;
    return addCraftedItemToActor(actor, data);
}

/**
 * Build HTML for a simple chat card (Blacksmith-style if API available).
 * @param {string} title - Card title
 * @param {string} bodyHtml - Body content (safe HTML)
 * @param {'card'|'announcement'} [themeType] - Prefer card or announcement theme
 * @returns {string}
 */
function buildChatCardHtml(title, bodyHtml, themeType = 'card') {
    const chatCardsAPI = game.modules.get('coffee-pub-blacksmith')?.api?.chatCards;
    const themeClassName = chatCardsAPI?.getThemeClassName?.('default') ?? 'theme-default';
    if (chatCardsAPI?.getAnnouncementThemeChoices && themeType === 'announcement') {
        const ann = chatCardsAPI.getTheme('announcement-green');
        if (ann) return `<div class="blacksmith-card ${ann.className}"><div class="card-header">${title}</div><div class="section-content">${bodyHtml}</div></div>`;
    }
    return `<div class="blacksmith-card ${themeClassName}"><div class="card-header">${title}</div><div class="section-content">${bodyHtml}</div></div>`;
}

/**
 * Send gather result when the roll failed but a perk granted consolation item(s).
 * Uses the same card-results-gather.hbs template with a custom intro paragraph.
 * @param {Actor|null} [actor]
 * @param {Array<{ name: string, uuid: string, img?: string }>} items - Consolation item(s) granted
 * @param {string[]} [perkNames] - Perk title(s) that granted the consolation (e.g. ["Gentle Hand of the Grove"])
 */
export async function sendGatherConsolationCard(actor = null, items = [], perkNames = []) {
    const actorPossessive = actor?.name ? `${actor.name}'s` : 'their';
    const escapeHtml = (s) => {
        if (s == null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };
    const perkText = perkNames?.length ? perkNames.join(', ') : 'your perk';
    const introParagraph = `Your roll <strong>failed</strong>, but thanks to <strong>${escapeHtml(perkText)}</strong> you still got something. These items have been added to <strong>${escapeHtml(actorPossessive)}</strong> inventory:`;
    const consolationPerks = perkNames.map((p) => ({
        perkTitle: p,
        benefitTitle: '',
        description: 'Granted at least one item even on a failed roll.'
    }));
    await sendGatherSuccessCard(actor, items, consolationPerks, { introParagraph });
}

/**
 * Send "You didn't find anything" chat card (failed roll or no actor).
 * @param {Actor} [actor] - Optional actor (for speaker)
 */
export function sendGatherFailureCard(actor = null, reason = null) {
    const title = 'Forage for components';
    const body = `<p>${reason || 'You didn\'t find anything.'}</p>`;
    const html = buildChatCardHtml(title, body, 'card');
    const speaker = actor ? ChatMessage.getSpeaker({ actor }) : ChatMessage.getSpeaker();
    ChatMessage.create({
        content: html,
        speaker,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER
    });
}

/**
 * Send "You searched but found no matching components here." (roll succeeded but pool empty).
 * @param {Actor} [actor] - Optional actor (for speaker)
 */
export function sendGatherNoPoolCard(actor = null) {
    const title = 'Forage for components';
    const body = '<p>You searched the area but found no components of the types you were looking for here.</p>';
    const html = buildChatCardHtml(title, body, 'card');
    const speaker = actor ? ChatMessage.getSpeaker({ actor }) : ChatMessage.getSpeaker();
    ChatMessage.create({
        content: html,
        speaker,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER
    });
}

/**
 * Send gather result chat card using card-results-gather.hbs (success or consolation).
 * Same template and layout; only the intro paragraph and optional perks list differ.
 * @param {Actor|null} [actor]
 * @param {Array<{ name: string, uuid: string, img?: string }>} items - Items added (name, uuid, img for display)
 * @param {Array<{ perkTitle: string, benefitTitle: string, description: string }>} [appliedPerks] - Perks that applied (for success) or consolation perk(s) for display
 * @param {{ introParagraph?: string }} [options] - Optional intro HTML. When set (e.g. consolation), used instead of default "Foraging has paid off..."
 */
export async function sendGatherSuccessCard(actor = null, items = [], appliedPerks = [], options = {}) {
    const chatCardsAPI = game.modules.get('coffee-pub-blacksmith')?.api?.chatCards;
    const cardTheme = chatCardsAPI?.getThemeClassName?.('default') ?? 'theme-default';

    const escapeHtml = (s) => {
        if (s == null) return '';
        const str = String(s);
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    const itemsData = items?.length
        ? items.map((it) => {
            const name = it.name ?? '';
            const uuid = it.uuid ?? '';
            const img = it.img ?? '';
            const link = uuid ? `@UUID[${escapeHtml(uuid)}]{${escapeHtml(name)}}` : escapeHtml(name);
            return { img: img || null, link };
        })
        : [];

    const actorPossessive = actor?.name ? `${actor.name}'s` : 'their';

    const html = await renderTemplate('modules/coffee-pub-artificer/templates/card-results-gather.hbs', {
        cardTheme,
        title: 'Forage for components',
        icon: 'leaf',
        resultTitle: 'Results',
        resultIcon: 'leafy-green',
        actorPossessive,
        introParagraph: options.introParagraph ?? null,
        items: itemsData,
        perkTitle: 'Perks applied',
        perkIcon: 'seedling',
        perks: appliedPerks?.length ? appliedPerks : null
    });

    const speaker = actor ? ChatMessage.getSpeaker({ actor }) : ChatMessage.getSpeaker();
    ChatMessage.create({
        content: html,
        speaker,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER
    });
}

/**
 * Get the gathering roll bonus (from Herbalism perks) for an actor. Used to pre-fill Blacksmith's Request Roll situational bonus.
 * @param {Actor|null} actor
 * @returns {Promise<number>}
 */
export async function getGatheringRollBonusForActor(actor, skillIds = DEFAULT_GATHER_SKILLS) {
    if (!actor) return 0;
    const ctx = await _getGatheringSkillContext(actor, skillIds);
    return Math.max(0, Number(ctx.gatheringRollBonus) || 0);
}

/**
 * Process one gather roll: DC check (with perk roll bonus), pick item(s), add to actor. Does NOT send any chat card.
 * Uses Herbalism perks for gathering roll bonus and yield multiplier when the actor has learned perks.
 * @param {number} rollTotal - The roll total (d20 + modifier from sheet)
 * @param {Actor|null} actor - Actor who rolled
 * @param {PendingGather} pending - Gather context (dc, biomes, componentTypes)
 * @returns {Promise<{ success: boolean, noPool?: boolean, itemRecords?: Array<{ name: string, uuid: string, img?: string }> }>}
 */
export async function processGatherRollResult(rollTotal, actor, pending) {
    if (!pending) return { success: false };
    const { dc, biomes, componentTypes, skillIds } = pending;
    const enabledSkillIds = _normalizeGatherSkillIds(skillIds);
    if (!enabledSkillIds.length) {
        return {
            success: false,
            reason: `No harvesting skills are enabled for this area.`
        };
    }

    let effectiveTotal = rollTotal;
    let yieldMultiplier = 1;
    let appliedPerks = [];
    let componentSkillRanges = [];
    let componentAutoGatherBySkill = {};

    if (actor) {
        const skillContext = await _getGatheringSkillContext(actor, enabledSkillIds);
        if (!skillContext.hasActorHarvestingSkill) {
            return {
                success: false,
                reason: `Your roll was high, but none of your enabled harvesting skills apply in this area (${enabledSkillIds.join(', ')}).`
            };
        }

        effectiveTotal = rollTotal + (skillContext.gatheringRollBonus ?? 0);
        yieldMultiplier = Math.max(1, Math.floor(skillContext.gatheringYieldMultiplier ?? 1));
        appliedPerks = skillContext.appliedPerks ?? [];
        componentSkillRanges = skillContext.componentSkillRanges ?? [];
        componentAutoGatherBySkill = skillContext.componentAutoGatherBySkill ?? {};
    }

    if (effectiveTotal < dc) {
        if (actor) {
            const autoGatherName = Object.values(componentAutoGatherBySkill)[0] ?? null;
            if (autoGatherName) {
                const item = await getFromCache(autoGatherName);
                if (item) {
                    await addGatherItemToActor(actor, item);
                    const name = item.name ?? autoGatherName;
                    const uuid = item.uuid ?? '';
                    const img = item.img ?? '';
                    const learnedPerkIds = await getAPI().skills.getLearnedPerks(actor);
                    const perkNames = [];
                    for (const sid of Object.keys(componentAutoGatherBySkill)) {
                        const skillPerks = getLearnedPerkIdsForSkill(learnedPerkIds ?? [], sid);
                        const names = await getComponentAutoGatherPerkNames(sid, skillPerks);
                        for (const n of names ?? []) perkNames.push(n);
                    }
                    return {
                        success: false,
                        componentAutoGatherGranted: true,
                        itemRecords: [{ name, uuid, img }],
                        perkNames
                    };
                }
            }
        }
        return { success: false };
    }
    if (!actor) return { success: false };
    const eligibleRecords = getEligibleGatherRecords(biomes, componentTypes);
    if (!eligibleRecords.length) return { success: true, noPool: true };

    const recordsAllowedByPerks = eligibleRecords.filter((rec) => {
        const tier = rec.tier ?? 0;
        if (tier === 0) return true;
        if (!componentSkillRanges.length) return false;
        return componentSkillRanges.some(([min, max]) => tier >= min && tier <= max);
    });

    if (!recordsAllowedByPerks.length) return { success: true, noPool: true };

    const itemRecords = [];
    for (let i = 0; i < yieldMultiplier; i++) {
        const record = pickOneGatherRecord(recordsAllowedByPerks);
        if (!record) continue;
        let item = null;
        try {
            item = await fromUuid(record.uuid);
        } catch {
            continue;
        }
        if (!item) continue;
        await addGatherItemToActor(actor, item);
        itemRecords.push({ name: record.name ?? item.name, uuid: record.uuid, img: record.img ?? item.img });
    }
    if (!itemRecords.length) return { success: false };
    return {
        success: true,
        itemRecords,
        appliedPerks
    };
}

/**
 * Handle roll completion: process and send a single chat card. Use when not buffering.
 * @param {number} rollTotal - The roll total (e.g. d20 + modifier)
 * @param {Actor} [actor] - Actor who rolled (for adding items and speaker)
 * @param {PendingGather} [pending] - If not provided, uses consumePendingGather()
 */
export async function handleGatherRollResult(rollTotal, actor = null, pending = null) {
    const ctx = pending ?? consumePendingGather();
    const outcome = await processGatherRollResult(rollTotal, actor ?? null, ctx);
    if (!actor) {
        sendGatherFailureCard(actor, outcome?.reason ?? null);
        return;
    }
    if (outcome.noPool) {
        sendGatherNoPoolCard(actor);
        return;
    }
    if (!outcome.success) {
        if (outcome.componentAutoGatherGranted && outcome.itemRecords?.length) {
            sendGatherConsolationCard(actor, outcome.itemRecords, outcome.perkNames ?? []);
        } else {
            sendGatherFailureCard(actor, outcome?.reason ?? null);
        }
        return;
    }
    if (outcome.itemRecords?.length) {
        await sendGatherSuccessCard(actor, outcome.itemRecords, outcome.appliedPerks);
    } else {
        sendGatherFailureCard(actor, outcome?.reason ?? null);
    }
}

function _getSceneGatherSettings(scene = canvas?.scene ?? null) {
    const flags = scene?.getFlag?.(MODULE.ID, 'scene') ?? {};
    const normalizeList = (value) => {
        if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
        if (typeof value === 'string' && value.trim()) return [value.trim()];
        return [];
    };
    const biomes = normalizeList(flags.habitats);
    const componentTypes = normalizeList(flags.componentTypes);
    const harvestingSkills = normalizeList(flags.harvestingSkills).length
        ? normalizeList(flags.harvestingSkills)
        : ['Herbalism', 'Cooking'];
    const rawDC = Number(flags.defaultDC);
    const dc = Number.isFinite(rawDC) ? Math.max(1, Math.min(30, Math.floor(rawDC))) : 5;
    return { dc, biomes, componentTypes, harvestingSkills };
}

async function _notifyGMSceneGatherNotConfigured(scene) {
    const sceneName = scene?.name ?? 'Current Scene';
    const gmMessage = `Artificer Gather and Harvest is not configured for "${sceneName}". Configure Artificer Scene settings (Habitats and Component Types).`;
    if (game.user?.isGM) {
        ui.notifications?.warn(gmMessage);
        return;
    }

    ui.notifications?.warn('Gather and Harvest is not configured for this scene. A GM has been notified.');
    const gmRecipients = (game.users?.contents ?? game.users ?? []).filter((u) => u?.isGM).map((u) => u.id);
    if (!gmRecipients.length) return;
    try {
        await ChatMessage.create({
            content: gmMessage,
            whisper: gmRecipients,
            speaker: ChatMessage.getSpeaker()
        });
    } catch {
        // ignore chat delivery errors; user already received a warning
    }
}

function _getControlledTokenActorsForRequest() {
    const controlledTokens = canvas?.tokens?.controlled ?? [];
    if (!controlledTokens.length) return [];
    return controlledTokens
        .map((token) => ({ token, actor: token?.actor ?? null }))
        .filter((entry) => !!entry.actor);
}

function _distanceInSceneUnits(fromPoint, toPoint) {
    const dx = Number(toPoint?.x) - Number(fromPoint?.x);
    const dy = Number(toPoint?.y) - Number(fromPoint?.y);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return Infinity;
    const pixels = Math.hypot(dx, dy);
    const gridPx = Number(canvas?.dimensions?.size) || 100;
    const gridUnits = Number(canvas?.dimensions?.distance) || 5;
    return (pixels / gridPx) * gridUnits;
}

function _getPinById(pinId, sceneId = canvas?.scene?.id ?? null) {
    if (!pinId) return null;
    const pins = game.modules.get('coffee-pub-blacksmith')?.api?.pins;
    if (!pins?.get) return null;
    return pins.get(pinId, sceneId ? { sceneId } : undefined);
}

function _getPinCenter(pin) {
    const x = Number(pin?.x);
    const y = Number(pin?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
}

function _getEligibleTokenActorsForPinProximity(pin, maxDistanceUnits = 5) {
    const selected = _getControlledTokenActorsForRequest();
    const pinCenter = _getPinCenter(pin);
    if (!pinCenter) return [];
    return selected.filter(({ token }) => {
        const tokenCenter = token?.center ?? {
            x: Number(token?.document?.x) + (Number(token?.w) || Number(canvas?.dimensions?.size) || 100) / 2,
            y: Number(token?.document?.y) + (Number(token?.h) || Number(canvas?.dimensions?.size) || 100) / 2
        };
        return _distanceInSceneUnits(tokenCenter, pinCenter) <= maxDistanceUnits;
    });
}

async function _deleteGatherPin(pinId, sceneId = canvas?.scene?.id ?? null) {
    if (!pinId) return;
    const pins = game.modules.get('coffee-pub-blacksmith')?.api?.pins;
    if (!pins?.delete) return;
    try {
        await pins.delete(pinId, sceneId ? { sceneId } : undefined);
        await pins.reload?.();
    } catch (e) {
        BlacksmithUtils?.postConsoleAndNotification?.(MODULE.NAME, 'Gather pin delete failed', e?.message ?? String(e), true, false);
    }
}

async function _ensureGatherSocketHandler() {
    if (_gatherSocketRegistered) return;
    if (!_gatherSocketApi) {
        _gatherSocketApi = await BlacksmithAPI.getSockets();
    }
    await _gatherSocketApi.waitForReady();
    await _gatherSocketApi.register(GATHER_SOCKET_EVENT, async (data) => {
        if (!game.user?.isGM) return;
        await _processGatherRollOnGM(data);
    });
    _gatherSocketRegistered = true;
}

async function _resolveActorFromRollPayload(payload) {
    const { tokenId, message } = payload ?? {};
    if (tokenId && canvas?.scene) {
        const tokenDoc = canvas.scene.tokens.get(tokenId);
        if (tokenDoc) {
            return tokenDoc.actor ?? (tokenDoc.actorId ? game.actors.get(tokenDoc.actorId) : null) ?? null;
        }
    }
    if (message?.speaker?.actor) {
        return game.actors.get(message.speaker.actor) ?? null;
    }
    return null;
}

async function _processGatherRollOnGM(data) {
    const rollTotal = Number(data?.rollTotal);
    const requestId = String(data?.requestId ?? '');
    if (!Number.isFinite(rollTotal) || !requestId) return;

    const tokenId = data?.tokenId ?? null;
    const sceneId = data?.sceneId ?? canvas?.scene?.id ?? null;
    const pending = data?.pending ?? null;
    const allComplete = !!data?.allComplete;
    const speakerActorId = data?.speakerActorId ?? null;

    let actor = null;
    if (sceneId && tokenId) {
        const scene = game.scenes?.get?.(sceneId) ?? null;
        const tokenDoc = scene?.tokens?.get?.(tokenId) ?? null;
        actor = tokenDoc?.actor ?? (tokenDoc?.actorId ? game.actors.get(tokenDoc.actorId) : null) ?? null;
    }
    if (!actor && speakerActorId) {
        actor = game.actors?.get?.(speakerActorId) ?? null;
    }

    const outcome = await processGatherRollResult(rollTotal, actor ?? null, pending);
    const bucket = _gatherRollBuffers.get(requestId) ?? [];
    bucket.push({ actor: actor ?? null, outcome });
    _gatherRollBuffers.set(requestId, bucket);
    if (!allComplete) return;

    for (const { actor: a, outcome: o } of bucket) {
        if (!a) {
            sendGatherFailureCard(a, o?.reason ?? null);
            continue;
        }
        if (o.noPool) {
            sendGatherNoPoolCard(a);
            continue;
        }
        if (!o.success) {
            if (o.componentAutoGatherGranted && o.itemRecords?.length) {
                await sendGatherConsolationCard(a, o.itemRecords, o.perkNames ?? []);
            } else {
                sendGatherFailureCard(a, o?.reason ?? null);
            }
            continue;
        }
        if (o.itemRecords?.length) {
            await sendGatherSuccessCard(a, o.itemRecords, o.appliedPerks);
        } else {
            sendGatherFailureCard(a, o?.reason ?? null);
        }
    }
    if (pending?.sourcePinId) {
        await _deleteGatherPin(pending.sourcePinId, pending.sourceSceneId ?? sceneId ?? canvas?.scene?.id ?? null);
    }
    _gatherRollBuffers.delete(requestId);
}

/**
 * Request a Gather and Harvest roll directly from current scene configuration.
 * Works for both GM and players, using selected tokens on the canvas.
 */
export async function requestGatherAndHarvestFromScene() {
    return requestGatherAndHarvestFromSceneWithOptions({});
}

/**
 * Request a Gather and Harvest roll directly from current scene configuration.
 * Works for both GM and players.
 * @param {{ sourcePinId?: string|null, requirePinProximity?: boolean, maxDistanceUnits?: number }} [options]
 */
export async function requestGatherAndHarvestFromSceneWithOptions(options = {}) {
    if (!canvas?.ready || !canvas?.scene) {
        ui.notifications?.warn('Canvas is not ready.');
        return;
    }

    const sourcePinId = options?.sourcePinId ?? null;
    const requirePinProximity = !!options?.requirePinProximity;
    const maxDistanceUnits = Number.isFinite(Number(options?.maxDistanceUnits)) ? Number(options.maxDistanceUnits) : 5;
    const sourcePin = sourcePinId ? _getPinById(sourcePinId, canvas.scene.id) : null;

    const scene = canvas.scene;
    const { dc, biomes, componentTypes, harvestingSkills } = _getSceneGatherSettings(scene);
    if (!biomes.length || !componentTypes.length) {
        await _notifyGMSceneGatherNotConfigured(scene);
        return;
    }

    const api = game.modules.get('coffee-pub-blacksmith')?.api;
    if (!api?.openRequestRollDialog) {
        ui.notifications?.warn('Blacksmith Request a Roll API not available.');
        return;
    }

    const selected = requirePinProximity && sourcePin
        ? _getEligibleTokenActorsForPinProximity(sourcePin, maxDistanceUnits)
        : _getControlledTokenActorsForRequest();
    if (!selected.length) {
        if (requirePinProximity && sourcePin) {
            ui.notifications?.warn(`Select at least one controlled token within ${maxDistanceUnits} ft of the gathering spot.`);
        } else {
            ui.notifications?.warn('Select at least one token you can control on the canvas.');
        }
        return;
    }

    const actorsForRequest = [];
    for (const { token, actor } of selected) {
        const situationalBonus = await getGatheringRollBonusForActor(actor, harvestingSkills);
        actorsForRequest.push({
            id: token.id,
            actorId: actor.id,
            name: token.name || actor.name,
            situationalBonus
        });
    }
    if (!actorsForRequest.length) {
        ui.notifications?.warn('No valid tokens selected.');
        return;
    }

    const pendingContext = {
        dc,
        biomes,
        componentTypes,
        skillIds: harvestingSkills,
        sourcePinId,
        sourceSceneId: canvas.scene.id
    };
    setPendingGather(pendingContext);
    const rollBuffer = [];
    const requestId = foundry.utils.randomID();
    await _ensureGatherSocketHandler();

    await api.openRequestRollDialog({
        silent: true,
        title: 'Gather and Harvest',
        dc,
        initialFilter: 'selected',
        initialType: 'ability',
        initialValue: 'wis',
        actors: actorsForRequest,
        groupRoll: false,
        onRollComplete: async (payload) => {
            const rollTotal = payload?.result?.total != null ? payload.result.total : null;
            if (rollTotal == null) {
                ui.notifications?.warn('Could not read roll result.');
                return;
            }

            if (!game.user?.isGM) {
                const gmRecipients = (game.users?.contents ?? game.users ?? []).filter((u) => u?.isGM).map((u) => u.id);
                if (!gmRecipients.length) {
                    ui.notifications?.warn('No GM connected to resolve gather results.');
                    return;
                }
                await _gatherSocketApi.emit(GATHER_SOCKET_EVENT, {
                    requestId,
                    sceneId: canvas?.scene?.id ?? null,
                    tokenId: payload?.tokenId ?? null,
                    speakerActorId: payload?.message?.speaker?.actor ?? null,
                    rollTotal,
                    allComplete: !!payload?.allComplete,
                    pending: pendingContext
                }, { recipients: gmRecipients });
                return;
            }

            const actor = await _resolveActorFromRollPayload(payload);
            const pending = pendingContext ?? consumePendingGather();
            if (!pending) return;

            const outcome = await processGatherRollResult(rollTotal, actor ?? null, pending);
            rollBuffer.push({ actor: actor ?? null, outcome });

            if (!payload?.allComplete) return;

            for (const { actor: a, outcome: o } of rollBuffer) {
                if (!a) {
                    sendGatherFailureCard(a, o?.reason ?? null);
                    continue;
                }
                if (o.noPool) {
                    sendGatherNoPoolCard(a);
                    continue;
                }
                if (!o.success) {
                    if (o.componentAutoGatherGranted && o.itemRecords?.length) {
                        await sendGatherConsolationCard(a, o.itemRecords, o.perkNames ?? []);
                    } else {
                        sendGatherFailureCard(a, o?.reason ?? null);
                    }
                    continue;
                }
                if (o.itemRecords?.length) {
                    await sendGatherSuccessCard(a, o.itemRecords, o.appliedPerks);
                } else {
                    sendGatherFailureCard(a, o?.reason ?? null);
                }
            }

            if (pendingContext?.sourcePinId) {
                await _deleteGatherPin(pendingContext.sourcePinId, pendingContext.sourceSceneId ?? canvas?.scene?.id ?? null);
            }
            consumePendingGather();
        }
    });
}
