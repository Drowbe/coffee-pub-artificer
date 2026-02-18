// ==================================================================
// ===== ITEM CACHE ==================================================
// ==================================================================
// Purposeful cache: GM must click Refresh to build. Supports translation
// mapping for name variants (e.g. "Oil Flask" -> "Flask of Oil").
// ==================================================================

import { MODULE } from '../const.js';

/** @type {Map<string, { item: Item, overlay?: Object }>} Key: normalized name */
let _cache = new Map();
/** @type {Map<string, Item>} UUID -> Item for getAllItems() */
let _itemsByUuid = new Map();
let _status = {
    hasCache: false,
    building: false,
    compendiumCount: 0,
    itemCount: 0,
    message: ''
};

/**
 * Normalize name for cache key
 * @param {string} name
 * @returns {string}
 */
function normalizeName(name) {
    if (!name || typeof name !== 'string') return '';
    return name.trim().toLowerCase();
}

/**
 * Parse translation JSON from setting
 * Format: { "canonical": ["alias1", "alias2", ...], ... }
 * @returns {Object<string, string[]>}
 */
function getTranslationMap() {
    try {
        const raw = game.settings.get(MODULE.ID, 'itemTranslation') ?? '{}';
        if (typeof raw !== 'string') return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

/**
 * Get all names that should map to the same item (canonical + aliases)
 * @param {string} itemName - Actual item name from compendium/world
 * @param {Object<string, string[]>} translation
 * @returns {string[]} All normalized keys to store under
 */
function getCacheKeysForItem(itemName, translation) {
    const normalized = normalizeName(itemName);
    const keys = new Set([normalized]);

    for (const [canonical, aliases] of Object.entries(translation)) {
        const canonNorm = normalizeName(canonical);
        const aliasNorms = (Array.isArray(aliases) ? aliases : []).map((a) => normalizeName(String(a)));
        if (normalized === canonNorm || aliasNorms.includes(normalized)) {
            keys.add(canonNorm);
            aliasNorms.forEach((a) => keys.add(a));
        }
    }
    return Array.from(keys);
}

/**
 * Get configured compendium IDs (priority order)
 * @returns {string[]}
 */
function getConfiguredCompendiumIds() {
    const ids = [];
    let num = 1;
    try {
        num = game.settings.get(MODULE.ID, 'numIngredientCompendiums') ?? 1;
    } catch {
        return [];
    }
    for (let i = 1; i <= num; i++) {
        try {
            const id = game.settings.get(MODULE.ID, `ingredientCompendium${i}`);
            if (id && id !== 'none' && id !== '') ids.push(id);
        } catch {
            continue;
        }
    }
    return ids;
}

/**
 * Add item to cache under all relevant keys
 * @param {Item} item
 * @param {Object<string, string[]>} translation
 */
function addToCache(item, translation) {
    if (!item?.uuid) return;
    _itemsByUuid.set(item.uuid, item);
    const entry = { item };
    const keys = getCacheKeysForItem(item.name ?? '', translation);
    for (const k of keys) {
        if (k) _cache.set(k, entry);
    }
}

/**
 * Build cache from compendia and world. Progress callback receives { compendiumIndex, compendiumCount, itemCount, message }.
 * @param {Function} [onProgress] - (state) => void
 * @returns {Promise<{ compendiumCount: number, itemCount: number }>}
 */
export async function refreshCache(onProgress) {
    _status.building = true;
    _status.hasCache = false;
    _status.message = 'Building cache...';
    _cache.clear();
    _itemsByUuid.clear();

    const translation = getTranslationMap();
    const compendiumIds = getConfiguredCompendiumIds();

    let totalItems = 0;
    const seenUuids = new Set();

    const addItem = (item) => {
        if (!item || seenUuids.has(item.uuid)) return;
        seenUuids.add(item.uuid);
        addToCache(item, translation);
        totalItems++;
    };

    // 1. From compendia
    for (let i = 0; i < compendiumIds.length; i++) {
        const cid = compendiumIds[i];
        if (onProgress) {
            onProgress({
                compendiumIndex: i + 1,
                compendiumCount: compendiumIds.length,
                itemCount: totalItems,
                message: `Building cache... ${i + 1}/${compendiumIds.length} compendiums, ${totalItems} items`
            });
        }
        try {
            const pack = game.packs.get(cid);
            if (!pack || pack.documentName !== 'Item') continue;
            const index = await pack.getIndex();
            const itemIds = index && typeof index.keys === 'function' ? Array.from(index.keys()) : [];
            if (!itemIds.length) continue;
            for (const itemId of itemIds) {
                try {
                    const item = await pack.getDocument(itemId);
                    if (item) addItem(item);
                } catch {
                    continue;
                }
            }
        } catch (err) {
            console.warn(`[Artificer] Cache: error loading compendium "${cid}":`, err?.message);
        }
    }

    // 2. From world
    const worldItems = game.items ?? [];
    for (const item of worldItems) {
        addItem(item);
    }

    _status.building = false;
    _status.hasCache = true;
    _status.compendiumCount = compendiumIds.length;
    _status.itemCount = totalItems;
    _status.message = `${compendiumIds.length} compendiums, ${totalItems} items`;

    if (onProgress) {
        onProgress({
            compendiumIndex: compendiumIds.length,
            compendiumCount: compendiumIds.length,
            itemCount: totalItems,
            message: _status.message
        });
    }

    return { compendiumCount: compendiumIds.length, itemCount: totalItems };
}

/**
 * Get cache status for UI
 * @returns {{ hasCache: boolean, building: boolean, compendiumCount: number, itemCount: number, message: string }}
 */
export function getCacheStatus() {
    return { ..._status };
}

/**
 * Look up item by name from cache. Returns null if no cache or miss.
 * @param {string} name - Item name (any variant)
 * @param {string} [typeFilter] - 'container' to filter by container type
 * @returns {Item|null}
 */
export function getFromCache(name, typeFilter) {
    if (!_status.hasCache || _status.building) return null;
    const key = normalizeName(name);
    if (!key) return null;
    const entry = _cache.get(key);
    if (!entry?.item) return null;
    if (typeFilter === 'container') {
        const f = entry.item.flags?.artificer ?? entry.item.flags?.[MODULE.ID];
        if (f?.type !== 'container') return null;
    }
    return entry.item;
}

/**
 * Get all unique items from cache (for IngredientStorage etc.). Returns [] if no cache.
 * @returns {Item[]}
 */
export function getAllItemsFromCache() {
    if (!_status.hasCache || _status.building) return [];
    return Array.from(_itemsByUuid.values());
}

/**
 * Clear cache (e.g. when compendia change)
 */
export function clearCache() {
    _cache.clear();
    _itemsByUuid.clear();
    _status = {
        hasCache: false,
        building: false,
        compendiumCount: 0,
        itemCount: 0,
        message: ''
    };
}
