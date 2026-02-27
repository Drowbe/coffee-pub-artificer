// ==================================================================
// ===== GATHER MANAGER (Phase 1: Herb / component gathering) ======
// ==================================================================
// Temporary herb gather: GM requests roll (Herbalism Kit), compare to DC,
// then send chat card (failure or success + add items to actor).
// ==================================================================

import { MODULE } from './const.js';
import { OFFICIAL_BIOMES } from './schema-ingredients.js';
import { ARTIFICER_TYPES, FAMILIES_BY_TYPE, FAMILY_LABELS, ARTIFICER_FLAG_KEYS } from './schema-artificer-item.js';
import { getFamilyFromFlags } from './utility-artificer-item.js';
import { addCraftedItemToActor } from './utility-artificer-item.js';
import { getAllRecordsFromCache, getAllItemsFromCache } from './cache/cache-items.js';
import { getAPI } from './api-artificer.js';
import { getLearnedPerkIdsForSkill, getEffectiveGatheringRules, getEffectiveComponentSkillAccess, getAppliedGatheringPerksForDisplay } from './skills-rules.js';

/** @typedef {{ dc: number, biomes: string[], componentTypes: string[] }} PendingGather */

let _pendingGather = null;

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
 * Send "You didn't find anything" chat card (failed roll or no actor).
 * @param {Actor} [actor] - Optional actor (for speaker)
 */
export function sendGatherFailureCard(actor = null) {
    const title = 'Forage for components';
    const body = '<p>You didn\'t find anything.</p>';
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
 * Send "You found ... Added to your inventory." chat card.
 * Uses card-results-gather.hbs and Blacksmith Chat Cards API (cardTheme).
 * @param {Actor} [actor]
 * @param {Array<{ name: string, uuid: string, img?: string }>} items - Items added (name, uuid, img for display)
 * @param {Array<{ perkTitle: string, benefitTitle: string, description: string }>} [appliedPerks] - Perks that applied to this gather (for success card)
 */
export async function sendGatherSuccessCard(actor = null, items = [], appliedPerks = []) {
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
export async function getGatheringRollBonusForActor(actor) {
    if (!actor) return 0;
    const learnedPerkIds = await getAPI().skills.getLearnedPerks(actor);
    const herbalismPerks = getLearnedPerkIdsForSkill(learnedPerkIds ?? [], 'Herbalism');
    const rules = await getEffectiveGatheringRules('Herbalism', herbalismPerks);
    return Math.max(0, Number(rules.gatheringRollBonus) || 0);
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
    const { dc, biomes, componentTypes } = pending;
    let effectiveTotal = rollTotal;
    let yieldMultiplier = 1;
    let appliedPerks = [];
    let herbalismPerks = [];
    if (actor) {
        const learnedPerkIds = await getAPI().skills.getLearnedPerks(actor);
        herbalismPerks = getLearnedPerkIdsForSkill(learnedPerkIds ?? [], 'Herbalism');
        const gatheringRules = await getEffectiveGatheringRules('Herbalism', herbalismPerks);
        effectiveTotal = rollTotal + (gatheringRules.gatheringRollBonus ?? 0);
        yieldMultiplier = Math.max(1, Math.floor(gatheringRules.gatheringYieldMultiplier ?? 1));
        appliedPerks = await getAppliedGatheringPerksForDisplay('Herbalism', herbalismPerks);
    }
    if (effectiveTotal < dc) return { success: false };
    if (!actor) return { success: false };
    const eligibleRecords = getEligibleGatherRecords(biomes, componentTypes);
    if (!eligibleRecords.length) return { success: true, noPool: true };

    const componentSkillRanges = await getEffectiveComponentSkillAccess('Herbalism', herbalismPerks);

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
        sendGatherFailureCard(actor);
        return;
    }
    if (outcome.noPool) {
        sendGatherNoPoolCard(actor);
        return;
    }
    if (!outcome.success) {
        sendGatherFailureCard(actor);
        return;
    }
    if (outcome.itemRecords?.length) {
        await sendGatherSuccessCard(actor, outcome.itemRecords, outcome.appliedPerks);
    } else {
        sendGatherFailureCard(actor);
    }
}
