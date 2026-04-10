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
import {
    getLearnedPerkIdsForSkill,
    getEffectiveGatheringRules,
    getEffectiveComponentSkillAccess,
    getAppliedGatheringPerksForDisplay,
    getComponentAutoGatherPerkNames,
    loadSkillsDetails,
    resolveGatherDefaults
} from './skills-rules.js';
import { getFromCache } from './cache/cache-items.js';
import { getGatherRuntimeDefaultsSync, resolveGatheringImageForScene } from './manager-gathering-images.js';
import { getChatCardPresentationFields } from './utils/helpers.js';

/** @typedef {{ dc: number, biomes: string[], componentTypes: string[], skillIds?: string[], sourcePinId?: string|null, sourceSceneId?: string|null, sourceFamily?: string|null, maxRarityRank?: number|null }} PendingGather */

let _pendingGather = null;
let _blacksmithRollHookRegistered = false;
let _hookManager = null;
const _gatherRollBuffers = new Map(); // requestId -> Array<{ actor: Actor|null, outcome: object }>
const _discoveryRollBuffers = new Map(); // requestId -> Array<{ actor: Actor|null, rollTotal: number }>
function _gatherRt() {
    return getGatherRuntimeDefaultsSync();
}
const _pinProcessingStates = new Map(); // requestId -> { pinId, sceneId, originalImage, pingController, animationTimeoutId }
/** Single-slot memo for gathering skill context (same actor + skills + perks → repeat calls are cheap). */
let _gatherSkillContextCache = { key: null, value: null };

/**
 * @param {Actor|null} actor
 * @param {string[]} enabledSkillIds
 * @param {string[]} learnedPerkIds
 */
function _gatherSkillContextCacheKey(actor, enabledSkillIds, learnedPerkIds) {
    const aid = actor?.uuid ?? '';
    const skills = [...enabledSkillIds].sort().join('\x1e');
    const perks = [...(learnedPerkIds ?? [])].sort().join('\x1e');
    return `${aid}\x1e${skills}\x1e${perks}`;
}
const DISCOVERY_NODES_FLAG_KEY = 'discoveredNodes';
const RARITY_RANKS = {
    common: 1,
    uncommon: 2,
    rare: 3,
    'very rare': 4,
    legendary: 5
};

const GATHER_PIN_CUES = {
    start: { animation: ['scale-small', 'ripple'], loops: 1, broadcast: true, sound: 'interface-notification-05' },
    working: { animation: ['pulse', 'glow'], untilStopped: true, sound: 'rustling-grass' },
    success: { animation: ['flash', 'scale-small'], loops: 1, broadcast: true, sound: 'fanfare-success-1' },
    failure: { animation: ['shake'], loops: 1, broadcast: true, sound: 'interface-error-03' }
};
const PIN_TYPE_GATHER_SPOT = 'gather-spot';
const BLACKSMITH_SOUNDS_BASE = 'modules/coffee-pub-blacksmith/sounds';
const PIN_EVENT_ANIMATIONS = Object.freeze({
    hover: { animation: 'ripple', sound: `${BLACKSMITH_SOUNDS_BASE}/interface-pop-03.mp3` },
    click: { animation: null, sound: null },
    doubleClick: { animation: 'scale-medium', sound: `${BLACKSMITH_SOUNDS_BASE}/rustling-grass.mp3` },
    add: { animation: 'ping', sound: `${BLACKSMITH_SOUNDS_BASE}/interface-pop-02.mp3` },
    delete: { animation: 'dissolve', sound: `${BLACKSMITH_SOUNDS_BASE}/interface-pop-01.mp3` }
});
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

async function _normalizeGatherSkillIds(skillIds) {
    const raw = Array.isArray(skillIds) && skillIds.length ? skillIds : resolveGatherDefaults(await loadSkillsDetails()).singleSkillIds;
    const cleaned = raw.map((s) => String(s).trim()).filter(Boolean);
    return [...new Set(cleaned)];
}

async function _getGatheringSkillContext(actor, skillIds) {
    const enabledSkillIds = await _normalizeGatherSkillIds(skillIds);
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
    const cacheKey = _gatherSkillContextCacheKey(actor, enabledSkillIds, learnedPerkIds);
    if (_gatherSkillContextCache.key === cacheKey) {
        return _gatherSkillContextCache.value;
    }

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

    const result = {
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
    _gatherSkillContextCache = { key: cacheKey, value: result };
    return result;
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

async function _playBlacksmithSound(soundName) {
    const sound = String(soundName ?? '').trim();
    if (!sound) return;
    try {
        const utils = globalThis?.BlacksmithUtils;
        const soundPath = _resolveBlacksmithSoundPath(sound);
        if (!soundPath || !utils?.playSound) return;
        await utils.playSound(soundPath, 0.8, false, false);
    } catch {
        // Ignore sound failures.
    }
}

function _resolveBlacksmithSoundPath(sound) {
    if (!sound) return '';
    if (sound.includes('/') || sound.startsWith('http://') || sound.startsWith('https://')) {
        return sound;
    }
    const pinsApi = game.modules.get('coffee-pub-blacksmith')?.api?.pins;
    const options = pinsApi?.getSoundOptions?.() ?? [];
    const name = sound.toLowerCase();
    const match = options.find((opt) => String(opt?.value ?? '').toLowerCase().endsWith(`/${name}.mp3`));
    if (match?.value) return String(match.value);
    return `modules/coffee-pub-blacksmith/sounds/${sound}.mp3`;
}

function sendExploreResultCard({
    sceneName = 'Current Scene',
    discovered = 0,
    byRarity = {},
    mode = 'explore'
} = {}) {
    const title = mode === 'populate' ? 'Populate Gathering Spots' : 'Explore the Area';
    const raritySummary = Object.entries(byRarity ?? {})
        .map(([rarity, count]) => `${count} ${rarity}`)
        .join(', ');
    const body = discovered > 0
        ? `<p><strong>${discovered}</strong> gathering spot(s) were discovered in <strong>${sceneName}</strong>${raritySummary ? `: ${raritySummary}` : ''}.</p><p>Next step: move to a spot and double-click it to gather and harvest.</p>`
        : `<p>No gathering spots were discovered in <strong>${sceneName}</strong>.</p><p>Try exploring again, changing habitats/component types, or increasing support through perks.</p>`;
    const html = buildChatCardHtml(title, body, 'card');
    ChatMessage.create({
        content: html,
        speaker: ChatMessage.getSpeaker(),
        ...getChatCardPresentationFields()
    });
    const rt = _gatherRt();
    _playBlacksmithSound(discovered > 0 ? rt.soundExploreSuccess : rt.soundExploreFail);
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
        ...getChatCardPresentationFields()
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
        ...getChatCardPresentationFields()
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
        ...getChatCardPresentationFields()
    });
}

/**
 * Get the gathering roll bonus (from Herbalism perks) for an actor. Used to pre-fill Blacksmith's Request Roll situational bonus.
 * @param {Actor|null} actor
 * @returns {Promise<number>}
 */
export async function getGatheringRollBonusForActor(actor, skillIds) {
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
    const { dc, biomes, componentTypes, skillIds, sourceFamily, maxRarityRank } = pending;
    const enabledSkillIds = await _normalizeGatherSkillIds(skillIds);
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
    let eligibleRecords = getEligibleGatherRecords(biomes, componentTypes);
    if (sourceFamily) {
        eligibleRecords = eligibleRecords.filter((rec) => String(rec?.family ?? '') === String(sourceFamily));
    }
    if (Number.isFinite(Number(maxRarityRank)) && Number(maxRarityRank) > 0) {
        const cap = Number(maxRarityRank);
        eligibleRecords = eligibleRecords.filter((rec) => _getRarityRank(_getRecordRarity(rec)) <= cap);
    }
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

async function _getSceneGatherSettings(scene = canvas?.scene ?? null) {
    const flags = scene?.getFlag?.(MODULE.ID, 'scene') ?? {};
    const normalizeList = (value) => {
        if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
        if (typeof value === 'string' && value.trim()) return [value.trim()];
        return [];
    };
    const biomes = normalizeList(flags.habitats);
    const componentTypes = normalizeList(flags.componentTypes);
    let harvestingFallback = [];
    try {
        harvestingFallback = resolveGatherDefaults(await loadSkillsDetails()).harvestingSkillIds;
    } catch {
        /* skills mapping failed — caller may surface errors elsewhere */
    }
    const harvestingSkills = normalizeList(flags.harvestingSkills).length
        ? normalizeList(flags.harvestingSkills)
        : harvestingFallback;
    const fallbackDC = Number(flags.defaultDC);
    const rawDiscoveryDC = Number(flags.discoveryDC);
    const rawHarvestDC = Number(flags.harvestDC);
    const discoveryDC = Number.isFinite(rawDiscoveryDC)
        ? Math.max(0, Math.min(20, Math.floor(rawDiscoveryDC)))
        : (Number.isFinite(fallbackDC) ? Math.max(0, Math.min(20, Math.floor(fallbackDC))) : 5);
    const harvestDC = Number.isFinite(rawHarvestDC)
        ? Math.max(0, Math.min(20, Math.floor(rawHarvestDC)))
        : (Number.isFinite(fallbackDC) ? Math.max(0, Math.min(20, Math.floor(fallbackDC))) : 5);
    return { discoveryDC, harvestDC, biomes, componentTypes, harvestingSkills };
}

function _normalizeRarityKey(value) {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) return 'common';
    if (raw === 'veryrare' || raw === 'very-rare') return 'very rare';
    return raw;
}

function _getRarityRank(value) {
    const key = _normalizeRarityKey(value);
    return RARITY_RANKS[key] ?? 1;
}

function _getRecordRarity(rec) {
    const direct = rec?.rarity ?? rec?.rarityLabel ?? rec?.itemRarity ?? null;
    if (direct) return _normalizeRarityKey(direct);
    const labelsRarity = rec?.labels?.rarity;
    if (labelsRarity) return _normalizeRarityKey(labelsRarity);
    const sysRarity = rec?.system?.rarity;
    if (typeof sysRarity === 'string') return _normalizeRarityKey(sysRarity);
    if (sysRarity?.value) return _normalizeRarityKey(sysRarity.value);
    return 'common';
}

function _getDiscoveryMaxRarityRank(rollTotal, dc) {
    if (rollTotal < dc) return 0;
    if (rollTotal >= dc + 20) return 5;
    if (rollTotal >= dc + 15) return 4;
    if (rollTotal >= dc + 10) return 3;
    if (rollTotal >= dc + 5) return 2;
    return 1;
}

function _getRarityKeyFromRank(rank) {
    if (rank >= 5) return 'legendary';
    if (rank === 4) return 'very rare';
    if (rank === 3) return 'rare';
    if (rank === 2) return 'uncommon';
    if (rank === 1) return 'common';
    return null;
}

function _getDiscoveryMaxRarityRankByThresholds(rollTotal, thresholds = {}) {
    if (rollTotal >= Number(thresholds.legendary)) return 5;
    if (rollTotal >= Number(thresholds['very rare'])) return 4;
    if (rollTotal >= Number(thresholds.rare)) return 3;
    if (rollTotal >= Number(thresholds.uncommon)) return 2;
    if (rollTotal >= Number(thresholds.common)) return 1;
    return 0;
}

function _buildDiscoveryThresholds(baseDC, offsets = {}) {
    const base = Math.max(0, Math.min(20, Number(baseDC) || 0));
    const fallbacks = _gatherRt().discoveryRarityOffsets;
    const clampOffset = (v, fallback = 0) => {
        const n = Number(v);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(0, Math.min(30, Math.floor(n)));
    };
    const raw = {
        common: clampOffset(offsets.common, fallbacks.common),
        uncommon: clampOffset(offsets.uncommon, fallbacks.uncommon),
        rare: clampOffset(offsets.rare, fallbacks.rare),
        'very rare': clampOffset(offsets['very rare'], fallbacks['very rare']),
        legendary: clampOffset(offsets.legendary, fallbacks.legendary)
    };

    const ordered = ['common', 'uncommon', 'rare', 'very rare', 'legendary'];
    const thresholds = {};
    let running = -Infinity;
    for (const rarity of ordered) {
        const value = Math.max(0, Math.min(50, base + raw[rarity]));
        running = Math.max(running, value);
        thresholds[rarity] = running;
    }
    return thresholds;
}

function _getDiscoveryNodeCount(rollTotal, dc, remainingCap) {
    if (rollTotal < dc) return 0;
    const discovered = 1 + Math.floor((rollTotal - dc) / 5);
    const bounded = Math.max(1, Math.min(3, discovered));
    return Math.max(0, Math.min(remainingCap, bounded));
}

function _getSceneDiscoveredNodes(scene = canvas?.scene ?? null) {
    const sceneFlags = scene?.getFlag?.(MODULE.ID, 'scene') ?? {};
    const nodes = Array.isArray(sceneFlags[DISCOVERY_NODES_FLAG_KEY]) ? sceneFlags[DISCOVERY_NODES_FLAG_KEY] : [];
    return nodes.filter((n) => n && typeof n === 'object' && n.id);
}

async function _setSceneDiscoveredNodes(scene, nodes) {
    const clean = Array.isArray(nodes) ? nodes : [];
    await scene?.setFlag?.(MODULE.ID, 'scene', {
        ...(scene.getFlag(MODULE.ID, 'scene') ?? {}),
        [DISCOVERY_NODES_FLAG_KEY]: clean
    });
}

export async function clearGatheringSpotsForScene(scene = canvas?.scene ?? null) {
    if (!game.user?.isGM) {
        ui.notifications?.warn('Only a GM can clear gathering spots.');
        return;
    }
    if (!scene) {
        ui.notifications?.warn('No active scene.');
        return;
    }

    const pins = game.modules.get('coffee-pub-blacksmith')?.api?.pins;
    const sceneId = scene.id;
    if (pins?.deleteAllByType) {
        await pins.deleteAllByType(PIN_TYPE_GATHER_SPOT, { sceneId, moduleId: MODULE.ID });
    } else if (pins?.list && pins?.delete) {
        const existingPins = pins.list({
            sceneId,
            moduleId: MODULE.ID,
            type: PIN_TYPE_GATHER_SPOT
        }) ?? [];
        for (const pin of existingPins) {
            await pins.delete(pin.id, { sceneId });
        }
    }
    await pins?.reload?.();
    await _setSceneDiscoveredNodes(scene, []);
    ui.notifications?.info(`Cleared gathering spots for "${scene.name ?? 'scene'}".`);
    _playBlacksmithSound(_gatherRt().soundClear);
}

export async function populateGatheringSpotsForScene(scene = canvas?.scene ?? null) {
    if (!game.user?.isGM) {
        ui.notifications?.warn('Only a GM can populate gathering spots.');
        return;
    }
    if (!scene) {
        ui.notifications?.warn('No active scene.');
        return;
    }

    const context = await _buildDiscoveryContext(scene);
    if (!context.biomes.length || !context.componentTypes.length || context.gatherSpots <= 0) {
        await _notifyGMSceneGatherNotConfigured(scene);
        return;
    }

    const existing = _getSceneDiscoveredNodes(scene);
    let remaining = Math.max(0, Number(context.gatherSpots) - existing.length);
    if (remaining <= 0) {
        ui.notifications?.info(`"${scene.name ?? 'Scene'}" is already at gather spot cap.`);
        return;
    }

    const basePool = getEligibleGatherRecords(context.biomes, context.componentTypes);
    if (!basePool.length) {
        ui.notifications?.warn('No eligible gather records for this scene configuration.');
        return;
    }

    const additions = [];
    while (remaining > 0) {
        const rec = pickOneGatherRecord(basePool);
        const family = String(rec?.family ?? '').trim();
        if (!family) break;
        const rarity = _getRecordRarity(rec);
        additions.push({
            id: foundry.utils.randomID(),
            sourceFamily: family,
            maxRarityRank: Math.max(1, _getRarityRank(rarity)),
            rarity,
            biomes: [...context.biomes],
            componentTypes: [family],
            skillIds: [...context.harvestingSkills]
        });
        remaining -= 1;
    }

    if (!additions.length) {
        ui.notifications?.warn('Could not populate gathering spots from current pool.');
        return;
    }

    await _setSceneDiscoveredNodes(scene, [...existing, ...additions]);
    ui.notifications?.info(`Populated ${additions.length} gathering spot(s) in "${scene.name ?? 'scene'}".`);
    const byRarity = {};
    for (const node of additions) {
        const rarity = String(node?.rarity ?? 'common');
        byRarity[rarity] = (byRarity[rarity] ?? 0) + 1;
    }
    sendExploreResultCard({
        sceneName: scene.name ?? 'Current Scene',
        discovered: additions.length,
        byRarity,
        mode: 'populate'
    });
    _playBlacksmithSound(_gatherRt().soundPopulate);
}

function _getNodeByPinId(scene = canvas?.scene ?? null, pinId = null) {
    if (!pinId) return null;
    const nodes = _getSceneDiscoveredNodes(scene);
    return nodes.find((n) => String(n.id) === String(pinId)) ?? null;
}

async function _notifyGMSceneGatherNotConfigured(scene) {
    const sceneName = scene?.name ?? 'Current Scene';
    const gmMessage = `Artificer gathering is not configured for "${sceneName}". Configure Artificer Scene settings (Habitats, Component Types, and Gather Spots).`;
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

function _getTokenCenterById(scene, tokenId) {
    if (!scene || !tokenId) return null;
    const tokenDoc = scene?.tokens?.get?.(tokenId) ?? null;
    if (!tokenDoc) return null;
    const x = Number(tokenDoc.x);
    const y = Number(tokenDoc.y);
    const w = Number(tokenDoc.width) || 1;
    const h = Number(tokenDoc.height) || 1;
    const gridSize = Number(scene?.grid?.size) || Number(canvas?.dimensions?.size) || 100;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(gridSize)) return null;
    return {
        x: x + (w * gridSize) / 2,
        y: y + (h * gridSize) / 2
    };
}

function _getSceneSpawnBounds(scene = canvas?.scene ?? null) {
    const dims = canvas?.dimensions ?? {};
    const edgePadding = 40;
    const sceneX = Number(dims.sceneX);
    const sceneY = Number(dims.sceneY);
    const sceneWidth = Number(dims.sceneWidth);
    const sceneHeight = Number(dims.sceneHeight);
    if (Number.isFinite(sceneX) && Number.isFinite(sceneY) && Number.isFinite(sceneWidth) && Number.isFinite(sceneHeight)) {
        return {
            minX: sceneX + edgePadding,
            minY: sceneY + edgePadding,
            maxX: Math.max(sceneX + edgePadding + 1, sceneX + sceneWidth - edgePadding),
            maxY: Math.max(sceneY + edgePadding + 1, sceneY + sceneHeight - edgePadding)
        };
    }
    const rect = dims.sceneRect ?? { x: 0, y: 0, width: Number(dims.width) || Number(scene?.width) || 3000, height: Number(dims.height) || Number(scene?.height) || 2000 };
    return {
        minX: Number(rect.x) + edgePadding,
        minY: Number(rect.y) + edgePadding,
        maxX: Math.max(Number(rect.x) + edgePadding + 1, Number(rect.x) + Number(rect.width) - edgePadding),
        maxY: Math.max(Number(rect.y) + edgePadding + 1, Number(rect.y) + Number(rect.height) - edgePadding)
    };
}

function _getRandomPointAroundCenter(center, radiusUnits, scene = canvas?.scene ?? null) {
    const cx = Number(center?.x);
    const cy = Number(center?.y);
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
    const gridPx = Number(canvas?.dimensions?.size) || Number(scene?.grid?.size) || 100;
    const gridUnits = Number(canvas?.dimensions?.distance) || 5;
    const radiusPx = Math.max(0, Number(radiusUnits) || 0) * (gridPx / gridUnits);
    const theta = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radiusPx;
    const rawX = cx + Math.cos(theta) * r;
    const rawY = cy + Math.sin(theta) * r;
    const bounds = _getSceneSpawnBounds(scene);
    return {
        x: Math.round(Math.max(bounds.minX, Math.min(bounds.maxX, rawX))),
        y: Math.round(Math.max(bounds.minY, Math.min(bounds.maxY, rawY)))
    };
}

function _distancePx(a, b) {
    const dx = Number(a?.x) - Number(b?.x);
    const dy = Number(a?.y) - Number(b?.y);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return Infinity;
    return Math.hypot(dx, dy);
}

function _pickDiscoveryPoint(anchor, radiusUnits, scene, occupied = []) {
    const existing = (Array.isArray(occupied) ? occupied : [])
        .filter((p) => Number.isFinite(Number(p?.x)) && Number.isFinite(Number(p?.y)))
        .map((p) => ({ x: Number(p.x), y: Number(p.y) }));
    if (!anchor) return null;
    if (!existing.length) return _getRandomPointAroundCenter(anchor, radiusUnits, scene);

    let best = null;
    let bestMinDistance = -1;
    for (let i = 0; i < 20; i++) {
        const point = _getRandomPointAroundCenter(anchor, radiusUnits, scene);
        if (!point) continue;
        const minDistance = existing.reduce((acc, p) => Math.min(acc, _distancePx(point, p)), Infinity);
        if (minDistance > bestMinDistance) {
            best = point;
            bestMinDistance = minDistance;
        }
        if (minDistance >= _gatherRt().discoveryMinPointSeparationPx) {
            return point;
        }
    }
    return best;
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
        if (sceneId) {
            const scene = game.scenes?.get?.(sceneId) ?? null;
            if (scene) {
                const nodes = _getSceneDiscoveredNodes(scene).filter((n) => String(n.id) !== String(pinId));
                await _setSceneDiscoveredNodes(scene, nodes);
            }
        }
        await pins.reload?.();
    } catch (e) {
        BlacksmithUtils?.postConsoleAndNotification?.(MODULE.NAME, 'Gather pin delete failed', e?.message ?? String(e), true, false);
    }
}

async function _playGatherPinCue(pinId, cue = null) {
    if (!pinId || !cue) return;
    const pins = game.modules.get('coffee-pub-blacksmith')?.api?.pins;
    if (!pins?.ping) return;
    try {
        await pins.ping(pinId, cue);
    } catch {
        // Ignore cue failures.
    }
}

async function _startGatherPinProcessing(requestId, pinId, sceneId = canvas?.scene?.id ?? null) {
    if (!requestId || !pinId) return;
    const pins = game.modules.get('coffee-pub-blacksmith')?.api?.pins;
    if (!pins) return;

    const pin = pins.get?.(pinId, sceneId ? { sceneId } : undefined) ?? null;
    const originalImage = pin?.image ?? null;

    const scene = sceneId ? game.scenes?.get?.(sceneId) ?? null : canvas?.scene ?? null;
    const activeImage = await resolveGatheringImageForScene(scene, 'active');

    try {
        await pins.update?.(
            pinId,
            { image: activeImage || originalImage || _gatherRt().pinDefaultImage, shape: 'none' },
            sceneId ? { sceneId } : undefined
        );
        await pins.refreshPin?.(pinId, sceneId ? { sceneId } : undefined);
    } catch {
        // Ignore image-swap failures.
    }

    await _playGatherPinCue(pinId, GATHER_PIN_CUES.start);

    let pingController = null;
    try {
        pingController = await pins.ping?.(pinId, GATHER_PIN_CUES.working);
    } catch {
        // Ignore ping failures.
    }
    if (!pingController?.stop) {
        BlacksmithUtils?.postConsoleAndNotification?.(MODULE.NAME, 'Gather pin animation did not start controller', { pinId, sceneId }, false, false);
    }

    let animationTimeoutId = null;
    if (pingController?.stop) {
        animationTimeoutId = setTimeout(async () => {
            try {
                pingController.stop();
                if (pingController.promise) await pingController.promise;
            } catch {
                // Ignore timeout-stop failures.
            }
        }, _gatherRt().pinAnimationTimeoutMs);
    }

    _pinProcessingStates.set(requestId, { pinId, sceneId, originalImage, pingController, animationTimeoutId });
}

async function _stopGatherPinProcessing(requestId, { restoreImage = false } = {}) {
    if (!requestId) return;
    const state = _pinProcessingStates.get(requestId);
    if (!state) return;

    if (state.animationTimeoutId) clearTimeout(state.animationTimeoutId);
    try {
        if (state.pingController?.stop) {
            state.pingController.stop();
            if (state.pingController.promise) {
                await state.pingController.promise;
            }
        }
    } catch {
        // Ignore animation stop failures.
    }
    _pinProcessingStates.delete(requestId);

    if (!restoreImage) return;
    const pins = game.modules.get('coffee-pub-blacksmith')?.api?.pins;
    if (!pins?.update) return;
    try {
        await pins.update(state.pinId, { image: state.originalImage ?? 'fa-solid fa-seedling', shape: 'none' }, state.sceneId ? { sceneId: state.sceneId } : undefined);
        await pins.reload?.();
    } catch {
        // ignore restore failures
    }
}

/**
 * Initialize gather/discovery socket listeners on this client.
 * Must run for all users so player-originated roll events can be resolved by connected GMs.
 */
export async function initializeGatherSockets() {
    await _ensureBlacksmithRollCompleteHook();
}

async function _ensureBlacksmithRollCompleteHook() {
    if (_blacksmithRollHookRegistered) return;
    if (!_hookManager) _hookManager = await BlacksmithAPI.getHookManager();
    const hookContext = `${MODULE.ID}-gather-manager`;
    const hookKey = `${hookContext}-blacksmith-requestRollComplete`;
    _hookManager.registerHook({
        name: 'blacksmith.requestRollComplete',
        description: 'Resolve gather/discovery roll results for Artificer',
        context: hookContext,
        key: hookKey,
        priority: 3,
        callback: async (payload) => {
            if (!game.user?.isGM) return;
            if (!payload || typeof payload !== 'object') return;
            const rollerUserId = String(payload?.rollerUserId ?? '');
            if (rollerUserId && rollerUserId === String(game.user.id)) return;

            const messageId = String(payload?.messageId ?? '');
            if (!messageId) return;
            const message = payload?.message ?? game.messages?.get?.(messageId) ?? null;
            const rollContext = message?.getFlag?.(MODULE.ID, 'rollContext') ?? null;
            if (!rollContext || typeof rollContext !== 'object') return;

            const rollTotal = Number(payload?.result?.total);
            if (!Number.isFinite(rollTotal)) return;
            const tokenId = payload?.tokenId ?? null;
            const speakerActorId = payload?.messageData?.actors?.find?.((a) => String(a?.id ?? '') === String(tokenId))?.actorId
                ?? payload?.message?.speaker?.actor
                ?? null;
            const sceneId = payload?.message?.speaker?.scene ?? canvas?.scene?.id ?? null;
            const allComplete = payload?.allComplete !== false;

            if (rollContext.kind === 'discovery' && rollContext.context) {
                await _processDiscoveryRollOnGM({
                    requestId: String(rollContext.requestId ?? `msg:${messageId}`),
                    rollTotal,
                    allComplete,
                    tokenId,
                    speakerActorId,
                    sceneId,
                    context: rollContext.context
                });
                return;
            }

            if (rollContext.kind === 'gather' && rollContext.pending) {
                await _processGatherRollOnGM({
                    requestId: String(rollContext.requestId ?? `msg:${messageId}`),
                    rollTotal,
                    allComplete,
                    tokenId,
                    speakerActorId,
                    sceneId,
                    pending: rollContext.pending
                });
            }
        }
    });
    _blacksmithRollHookRegistered = true;
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
    const allComplete = data?.allComplete !== false;
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
    // Harvest attempts always consume the originating gather node once the roll resolves.
    const shouldConsumePin = !!pending?.sourcePinId;
    const pinSceneId = pending?.sourceSceneId ?? sceneId ?? canvas?.scene?.id ?? null;
    if (pending?.sourcePinId) {
        await _stopGatherPinProcessing(requestId, { restoreImage: !shouldConsumePin });
        await _playGatherPinCue(pending.sourcePinId, shouldConsumePin ? GATHER_PIN_CUES.success : GATHER_PIN_CUES.failure);
    } else {
        await _stopGatherPinProcessing(requestId, { restoreImage: false });
    }
    if (pending?.sourcePinId && shouldConsumePin) {
        await _deleteGatherPin(pending.sourcePinId, pinSceneId);
    }
    _gatherRollBuffers.delete(requestId);
}

async function _applyDiscoveryResults(scene, context, entries) {
    const { discoveryThresholds, discoveryDC, dc, biomes, componentTypes, harvestingSkills, gatherSpots, discoveryRadiusUnits } = context;
    const fallbackBaseDC = Number.isFinite(Number(discoveryDC))
        ? Number(discoveryDC)
        : (Number.isFinite(Number(dc)) ? Number(dc) : 5);
    const effectiveThresholds = (discoveryThresholds && Number.isFinite(Number(discoveryThresholds.common)))
        ? discoveryThresholds
        : _buildDiscoveryThresholds(fallbackBaseDC, _gatherRt().discoveryRarityOffsets);
    let remaining = Math.max(0, Number(gatherSpots) || 0);
    const existing = _getSceneDiscoveredNodes(scene);
    remaining = Math.max(0, remaining - existing.length);
    if (remaining <= 0) return { discovered: 0, byRarity: {} };

    const discovered = [];
    const byRarity = {};
    const occupiedPoints = existing
        .filter((n) => Number.isFinite(Number(n?.x)) && Number.isFinite(Number(n?.y)))
        .map((n) => ({ x: Number(n.x), y: Number(n.y) }));
    for (const entry of entries) {
        if (remaining <= 0) break;
        const rollTotal = Number(entry?.rollTotal);
        if (!Number.isFinite(rollTotal)) continue;
        const maxRarityRank = _getDiscoveryMaxRarityRankByThresholds(rollTotal, effectiveThresholds);
        if (maxRarityRank <= 0) continue;

        const maxRarityKey = _getRarityKeyFromRank(maxRarityRank);
        const thresholdDC = Number.isFinite(Number(effectiveThresholds?.[maxRarityKey]))
            ? Number(effectiveThresholds[maxRarityKey])
            : 0;
        const countForRoll = _getDiscoveryNodeCount(rollTotal, thresholdDC, remaining);
        if (countForRoll <= 0) continue;

        const basePool = getEligibleGatherRecords(biomes, componentTypes)
            .filter((rec) => _getRarityRank(_getRecordRarity(rec)) <= maxRarityRank);
        if (!basePool.length) continue;
        const anchor = _getTokenCenterById(scene, entry?.tokenId ?? null);
        const radiusUnits = Math.max(5, Number(discoveryRadiusUnits) || DEFAULT_DISCOVERY_RADIUS_UNITS);

        for (let i = 0; i < countForRoll; i++) {
            if (remaining <= 0) break;
            const rec = pickOneGatherRecord(basePool);
            if (!rec?.uuid) continue;
            const family = String(rec?.family ?? '').trim();
            if (!family) continue;
            const rarity = _getRecordRarity(rec);
            const point = anchor ? _pickDiscoveryPoint(anchor, radiusUnits, scene, occupiedPoints) : null;
            byRarity[rarity] = (byRarity[rarity] ?? 0) + 1;
            discovered.push({
                id: foundry.utils.randomID(),
                sourceFamily: family,
                maxRarityRank,
                rarity,
                biomes: [...biomes],
                componentTypes: [family],
                skillIds: [...harvestingSkills],
                x: Number.isFinite(Number(point?.x)) ? Number(point.x) : null,
                y: Number.isFinite(Number(point?.y)) ? Number(point.y) : null
            });
            if (Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y))) {
                occupiedPoints.push({ x: Number(point.x), y: Number(point.y) });
            }
            remaining -= 1;
        }
    }

    if (!discovered.length) return { discovered: 0, byRarity };
    await _setSceneDiscoveredNodes(scene, [...existing, ...discovered]);
    await _ensureDiscoveredNodesPinned(scene, discovered);
    return { discovered: discovered.length, byRarity };
}

async function _ensureDiscoveredNodesPinned(scene, discoveredNodes = []) {
    const nodes = Array.isArray(discoveredNodes) ? discoveredNodes.filter((n) => n && n.id) : [];
    if (!scene?.id || !nodes.length) return;
    const pins = game.modules.get('coffee-pub-blacksmith')?.api?.pins;
    if (!pins?.create || !pins?.list) return;

    const existingPins = pins.list({
        sceneId: scene.id,
        moduleId: MODULE.ID,
        type: PIN_TYPE_GATHER_SPOT
    }) ?? [];
    const existingIds = new Set(existingPins.map((p) => String(p.id)));

    let created = false;
    for (const node of nodes) {
        const nodeId = String(node.id);
        if (!nodeId || existingIds.has(nodeId)) continue;
        const family = String(node?.sourceFamily ?? '').trim();
        const label = FAMILY_LABELS[family] ?? family;
        const image = await resolveGatheringImageForScene(scene, 'idle', { families: [family] });
        const x = Number(node?.x);
        const y = Number(node?.y);
        try {
            await pins.create({
                id: nodeId,
                moduleId: MODULE.ID,
                type: PIN_TYPE_GATHER_SPOT,
                x: Number.isFinite(x) ? x : Number(canvas?.dimensions?.sceneX) + 100 || 100,
                y: Number.isFinite(y) ? y : Number(canvas?.dimensions?.sceneY) + 100 || 100,
                ownership: { default: 2 },
                text: family ? `Gather: ${label}` : 'Gathering Spot',
                image: image || _gatherRt().pinDefaultImage,
                shape: 'none',
                dropShadow: true,
                textLayout: 'arc-below',
                textDisplay: 'hover',
                eventAnimations: PIN_EVENT_ANIMATIONS,
                size: { w: _gatherRt().pinSize, h: _gatherRt().pinSize }
            }, { sceneId: scene.id });
            existingIds.add(nodeId);
            created = true;
        } catch {
            // Keep discovery flowing even if one pin create fails; sync path can reconcile later.
        }
    }
    if (created) {
        await pins.reload?.();
    }
}

async function _processDiscoveryRollOnGM(data) {
    const requestId = String(data?.requestId ?? '');
    const rollTotal = Number(data?.rollTotal);
    const allComplete = data?.allComplete !== false;
    if (!requestId || !Number.isFinite(rollTotal)) return;

    const bucket = _discoveryRollBuffers.get(requestId) ?? [];
    bucket.push({
        actor: data?.speakerActorId ? game.actors?.get?.(data.speakerActorId) ?? null : null,
        rollTotal,
        tokenId: data?.tokenId ?? null
    });
    _discoveryRollBuffers.set(requestId, bucket);
    if (!allComplete) return;

    const sceneId = data?.sceneId ?? canvas?.scene?.id ?? null;
    const scene = sceneId ? game.scenes?.get?.(sceneId) ?? null : null;
    const context = data?.context ?? null;
    if (!scene || !context) {
        _discoveryRollBuffers.delete(requestId);
        return;
    }

    const result = await _applyDiscoveryResults(scene, context, bucket);
    const raritySummary = Object.entries(result.byRarity ?? {})
        .map(([rarity, count]) => `${count} ${rarity}`)
        .join(', ');
    if (result.discovered > 0) {
        ui.notifications?.info(`Discovered ${result.discovered} gathering spot(s)${raritySummary ? `: ${raritySummary}` : ''}.`);
    } else {
        ui.notifications?.info('No gathering spots discovered.');
    }
    sendExploreResultCard({
        sceneName: scene.name ?? 'Current Scene',
        discovered: result.discovered,
        byRarity: result.byRarity ?? {},
        mode: 'explore'
    });
    _discoveryRollBuffers.delete(requestId);
}

async function _buildDiscoveryContext(scene) {
    const { discoveryDC, biomes, componentTypes, harvestingSkills } = await _getSceneGatherSettings(scene);
    const sceneFlags = scene?.getFlag?.(MODULE.ID, 'scene') ?? {};
    const rawBase = Number(sceneFlags.discoveryBaseDC);
    const discoveryBaseDC = Number.isFinite(rawBase) ? Math.max(0, Math.min(20, Math.floor(rawBase))) : discoveryDC;
    const discoveryThresholds = _buildDiscoveryThresholds(discoveryBaseDC, {
        common: sceneFlags.discoveryOffsetCommon,
        uncommon: sceneFlags.discoveryOffsetUncommon,
        rare: sceneFlags.discoveryOffsetRare,
        'very rare': sceneFlags.discoveryOffsetVeryRare,
        legendary: sceneFlags.discoveryOffsetLegendary
    });
    const gatherSpots = Math.max(1, Math.min(30, Number(sceneFlags.gatherSpots) || 1));
    const rawRadius = Number(sceneFlags.discoveryRadiusUnits);
    const discoveryRadiusUnits = Number.isFinite(rawRadius)
        ? Math.max(5, Math.min(300, Math.round(rawRadius / 5) * 5))
        : _gatherRt().discoveryRadiusUnits;
    const discoveryRollDC = Number.isFinite(Number(discoveryThresholds.common)) ? Number(discoveryThresholds.common) : discoveryBaseDC;
    return { discoveryBaseDC, discoveryThresholds, discoveryRollDC, biomes, componentTypes, harvestingSkills, gatherSpots, discoveryRadiusUnits };
}

/**
 * Request a Gather and Harvest roll directly from current scene configuration.
 * Works for both GM and players, using selected tokens on the canvas.
 */
export async function requestGatherAndHarvestFromScene() {
    return requestGatherAndHarvestFromSceneWithOptions({});
}

/**
 * Request a Discovery roll that may spawn gather spots for the active scene.
 * Works for both GM and players; results are applied by GM.
 */
export async function requestDiscoverGatherSpotsFromScene() {
    if (!canvas?.ready || !canvas?.scene) {
        ui.notifications?.warn('Canvas is not ready.');
        return;
    }

    const scene = canvas.scene;
    const context = await _buildDiscoveryContext(scene);
    if (!context.biomes.length || !context.componentTypes.length || context.gatherSpots <= 0) {
        await _notifyGMSceneGatherNotConfigured(scene);
        return;
    }

    const selected = _getControlledTokenActorsForRequest();
    if (!selected.length) {
        ui.notifications?.warn('Select at least one token you can control on the canvas.');
        return;
    }

    const api = game.modules.get('coffee-pub-blacksmith')?.api;
    if (!api?.openRequestRollDialog) {
        ui.notifications?.warn('Blacksmith Request a Roll API not available.');
        return;
    }

    const actors = [];
    for (const { token, actor } of selected) {
        const situationalBonus = await getGatheringRollBonusForActor(actor, context.harvestingSkills);
        actors.push({
            id: token.id,
            actorId: actor.id,
            name: token.name || actor.name,
            situationalBonus
        });
    }
    if (!actors.length) {
        ui.notifications?.warn('No valid tokens selected.');
        return;
    }

    const requestId = foundry.utils.randomID();
    const localBuffer = [];

    const requestResult = await api.openRequestRollDialog({
        silent: true,
        title: 'Discover Gathering Spots',
        dc: context.discoveryRollDC,
        initialFilter: 'selected',
        initialType: 'ability',
        initialValue: 'wis',
        actors,
        groupRoll: false,
        onRollComplete: async (payload) => {
            const rollTotal = payload?.result?.total != null ? Number(payload.result.total) : null;
            if (!Number.isFinite(rollTotal)) {
                ui.notifications?.warn('Could not read roll result.');
                return;
            }

            if (!game.user?.isGM) {
                return;
            }

            const actor = await _resolveActorFromRollPayload(payload);
            localBuffer.push({ actor, rollTotal, tokenId: payload?.tokenId ?? null });
            if (payload?.allComplete === false) return;

            const result = await _applyDiscoveryResults(scene, context, localBuffer);
            const raritySummary = Object.entries(result.byRarity ?? {})
                .map(([rarity, count]) => `${count} ${rarity}`)
                .join(', ');
            if (result.discovered > 0) {
                ui.notifications?.info(`Discovered ${result.discovered} gathering spot(s)${raritySummary ? `: ${raritySummary}` : ''}.`);
            } else {
                ui.notifications?.info('No gathering spots discovered.');
            }
            sendExploreResultCard({
                sceneName: scene.name ?? 'Current Scene',
                discovered: result.discovered,
                byRarity: result.byRarity ?? {},
                mode: 'explore'
            });
        }
    });
    const requestMessage = requestResult?.message ?? (requestResult?.messageId ? game.messages?.get?.(requestResult.messageId) ?? null : null);
    if (requestMessage?.setFlag) {
        await requestMessage.setFlag(MODULE.ID, 'rollContext', {
            kind: 'discovery',
            requestId,
            context
        });
    }
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
    const { harvestDC, biomes, componentTypes, harvestingSkills } = await _getSceneGatherSettings(scene);
    const sourceNode = sourcePinId ? _getNodeByPinId(scene, sourcePinId) : null;
    const effectiveBiomes = sourceNode?.biomes?.length ? sourceNode.biomes : biomes;
    const effectiveComponentTypes = sourceNode?.componentTypes?.length ? sourceNode.componentTypes : componentTypes;
    const effectiveSkills = sourceNode?.skillIds?.length ? sourceNode.skillIds : harvestingSkills;

    if (!effectiveBiomes.length || !effectiveComponentTypes.length) {
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
        const situationalBonus = await getGatheringRollBonusForActor(actor, effectiveSkills);
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
        dc: harvestDC,
        biomes: effectiveBiomes,
        componentTypes: effectiveComponentTypes,
        skillIds: effectiveSkills,
        sourcePinId,
        sourceSceneId: canvas.scene.id,
        sourceFamily: sourceNode?.sourceFamily ?? null,
        maxRarityRank: Number.isFinite(Number(sourceNode?.maxRarityRank)) ? Number(sourceNode.maxRarityRank) : null
    };
    setPendingGather(pendingContext);
    const rollBuffer = [];
    const requestId = foundry.utils.randomID();
    if (sourcePinId) {
        await _startGatherPinProcessing(requestId, sourcePinId, pendingContext.sourceSceneId);
    }

    try {
        const requestResult = await api.openRequestRollDialog({
            silent: true,
            title: 'Gather and Harvest',
            dc: harvestDC,
            initialFilter: 'selected',
            initialType: 'ability',
            initialValue: 'wis',
            actors: actorsForRequest,
            groupRoll: false,
            onRollComplete: async (payload) => {
            const rollTotal = payload?.result?.total != null ? payload.result.total : null;
            if (rollTotal == null) {
                ui.notifications?.warn('Could not read roll result.');
                await _stopGatherPinProcessing(requestId, { restoreImage: true });
                return;
            }

            if (!game.user?.isGM) {
                if (payload?.allComplete !== false) {
                    await _stopGatherPinProcessing(requestId, { restoreImage: false });
                }
                return;
            }

            const actor = await _resolveActorFromRollPayload(payload);
            const pending = pendingContext ?? consumePendingGather();
            if (!pending) return;

            const outcome = await processGatherRollResult(rollTotal, actor ?? null, pending);
            rollBuffer.push({ actor: actor ?? null, outcome });

            if (payload?.allComplete === false) return;

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

            // Harvest attempts always consume the originating gather node once the roll resolves.
            const shouldConsumePin = !!pendingContext?.sourcePinId;
            const pinSceneId = pendingContext?.sourceSceneId ?? canvas?.scene?.id ?? null;
            if (pendingContext?.sourcePinId) {
                await _stopGatherPinProcessing(requestId, { restoreImage: !shouldConsumePin });
                await _playGatherPinCue(pendingContext.sourcePinId, shouldConsumePin ? GATHER_PIN_CUES.success : GATHER_PIN_CUES.failure);
            } else {
                await _stopGatherPinProcessing(requestId, { restoreImage: false });
            }
            if (pendingContext?.sourcePinId && shouldConsumePin) {
                await _deleteGatherPin(pendingContext.sourcePinId, pinSceneId);
            }
            consumePendingGather();
        }
        });
        const requestMessage = requestResult?.message ?? (requestResult?.messageId ? game.messages?.get?.(requestResult.messageId) ?? null : null);
        if (requestMessage?.setFlag) {
            await requestMessage.setFlag(MODULE.ID, 'rollContext', {
                kind: 'gather',
                requestId,
                pending: pendingContext
            });
        }
    } catch (error) {
        await _stopGatherPinProcessing(requestId, { restoreImage: true });
        throw error;
    }
}
