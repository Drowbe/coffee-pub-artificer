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

/** @typedef {{ dc: number, biome: string, componentTypes: string[] }} PendingGather */

let _pendingGather = null;

/**
 * Get biome options for dropdown (value + label).
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
 * Get cache records that match biome and selected component families (no fromUuid).
 * Use this for gather so we only fetch the single chosen item.
 * @param {string} biome - Selected biome
 * @param {string[]} families - Selected component families (e.g. ['Plant', 'Mineral'])
 * @returns {Array<{ name: string, uuid: string, family: string, biomes?: string[] }>}
 */
export function getEligibleGatherRecords(biome, families) {
    if (!biome || !families?.length) return [];
    const records = getAllRecordsFromCache();
    const familySet = new Set(families.map((f) => f.trim()).filter(Boolean));
    return records.filter((rec) => {
        const itemFamily = rec.family ?? '';
        if (!itemFamily || !familySet.has(itemFamily)) return false;
        const biomes = Array.isArray(rec.biomes) ? rec.biomes : [];
        if (biomes.length === 0) return true;
        return biomes.includes(biome);
    });
}

/**
 * Get items from cache that match biome and selected component families.
 * Prefer getEligibleGatherRecords + fetch only winner for fast gather; this loads all items (slow when cache cold).
 * @param {string} biome - Selected biome
 * @param {string[]} families - Selected component families (e.g. ['Plant', 'Mineral'])
 * @returns {Promise<Item[]>}
 */
export async function getEligibleGatherItems(biome, families) {
    if (!biome || !families?.length) return [];
    const items = await getAllItemsFromCache();
    const flagsKey = MODULE.ID;
    const familySet = new Set(families.map((f) => f.trim()).filter(Boolean));
    return items.filter((item) => {
        const f = item.flags?.[flagsKey] || item.flags?.artificer;
        const itemFamily = getFamilyFromFlags(f);
        if (!itemFamily || !familySet.has(itemFamily)) return false;
        const biomes = f?.[ARTIFICER_FLAG_KEYS.BIOMES] ?? f?.biomes ?? [];
        if (!Array.isArray(biomes) || biomes.length === 0) return true;
        return biomes.includes(biome);
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
 * @param {Actor} [actor]
 * @param {string[]} itemNames - Names of items added
 */
export function sendGatherSuccessCard(actor = null, itemNames = []) {
    const title = 'Forage for components';
    const list = itemNames.length ? itemNames.map((n) => `<li>${n}</li>`).join('') : '<li>(none)</li>';
    const body = `<p>You found:</p><ul>${list}</ul><p>Added to your inventory.</p>`;
    const html = buildChatCardHtml(title, body, 'card');
    const speaker = actor ? ChatMessage.getSpeaker({ actor }) : ChatMessage.getSpeaker();
    ChatMessage.create({
        content: html,
        speaker,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER
    });
}

/**
 * Handle roll completion from Blacksmith Request a Roll: compare total to DC, then send card and optionally add items.
 * Call this from the onRollComplete callback (or similar). Expects roll total and actor from the callback args.
 * @param {number} rollTotal - The roll total (e.g. d20 + modifier)
 * @param {Actor} [actor] - Actor who rolled (for adding items and speaker)
 * @param {PendingGather} [pending] - If not provided, uses consumePendingGather()
 */
export async function handleGatherRollResult(rollTotal, actor = null, pending = null) {
    const ctx = pending ?? consumePendingGather();
    if (!ctx) return;
    const { dc, biome, componentTypes } = ctx;
    if (rollTotal < dc) {
        sendGatherFailureCard(actor);
        return;
    }
    // Use records only (no getAllItemsFromCache) so we do at most one fromUuid for the winner
    const eligibleRecords = getEligibleGatherRecords(biome, componentTypes);
    const record = pickOneGatherRecord(eligibleRecords);
    if (!actor) {
        sendGatherFailureCard(actor);
        return;
    }
    if (!record) {
        sendGatherNoPoolCard(actor);
        return;
    }
    let item = null;
    try {
        item = await fromUuid(record.uuid);
    } catch {
        sendGatherFailureCard(actor);
        return;
    }
    if (!item) {
        sendGatherFailureCard(actor);
        return;
    }
    await addGatherItemToActor(actor, item);
    sendGatherSuccessCard(actor, [record.name ?? item.name]);
}
