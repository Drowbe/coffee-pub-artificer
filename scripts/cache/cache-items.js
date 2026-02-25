// ==================================================================
// ===== ITEM CACHE ==================================================
// ==================================================================
// Purposeful cache: GM must click Refresh to build. Stored in world
// setting `itemCache`. Supports translation mapping for name variants.
// ==================================================================

import { MODULE } from '../const.js';
import { LEGACY_FAMILY_TO_FAMILY, ARTIFICER_FLAG_KEYS } from '../schema-artificer-item.js';

/** Schema version for cache invalidation */
const ITEM_CACHE_VERSION = 1;

/** @type {Map<string, Item>} Key: normalized name → Item (when in-memory warm) */
let _cache = new Map();
/** @type {Map<string, Item>} UUID → Item for getAllItems() when in-memory warm */
let _itemsByUuid = new Map();
/** @type {Map<string, string>} Key: normalized name → uuid (when restored from persisted only) */
let _nameToUuid = new Map();
/** @type {Map<string, { name: string, uuid: string, img?: string, type?: string, dndType?: string, family?: string, tags?: string[], tier?: number, rarity?: string, source?: string, artificerType?: string|null }>} uuid → record when persisted */
let _recordsByUuid = new Map();

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

/** Cached translation: alias (normalized) → canonical name. Loaded from resources/translation-item.json */
let _translationCache = null;

/**
 * Load translation from resources/translation-item.json.
 * Format: { "alias (normalized)": "Canonical Name", ... }
 * @returns {Promise<Object<string, string>>}
 */
export async function loadTranslationFromFile() {
    if (_translationCache) return _translationCache;
    try {
        const res = await fetch(`modules/${MODULE.ID}/resources/translation-item.json`);
        if (!res?.ok) return {};
        const data = await res.json();
        _translationCache = data && typeof data === 'object' ? data : {};
        return _translationCache;
    } catch {
        _translationCache = {};
        return _translationCache;
    }
}

/**
 * Get translation map (alias → canonical). Returns cached data; call loadTranslationFromFile() first.
 * @returns {Object<string, string>}
 */
function getTranslationMap() {
    return _translationCache ?? {};
}

/**
 * D&D 5e consumable subtype → family hint when flags.artificer.family missing
 * @type {Object<string, string>}
 */
const DND_CONSUMABLE_FAMILY = {
    potion: 'Herbs',
    poison: 'CreatureParts',
    scroll: 'Environmental',
    oil: 'Herbs',
    food: 'Herbs',
    ammunition: 'Minerals'
};

/**
 * Build a lightweight cache record from an Item
 * @param {Item} item
 * @param {string} source - compendium id or 'world'
 * @returns {{ name: string, uuid: string, img: string, type: string, dndType: string, family: string, tags: string[], tier: number, rarity: string, source: string, artificerType: string|null, biomes: string[] }}
 */
function itemToRecord(item, source) {
    const flags = item.flags?.artificer ?? item.flags?.[MODULE.ID] ?? {};
    const sys = item.system ?? {};
    const typeVal = sys?.type?.value ?? item.type ?? '';
    const subtype = (sys?.type?.subtype ?? sys?.consumableType ?? '').toLowerCase?.() ?? '';
    let family = flags[ARTIFICER_FLAG_KEYS.FAMILY] ?? flags.family ?? '';
    family = LEGACY_FAMILY_TO_FAMILY[family] ?? family;
    if (!family && typeVal === 'consumable' && subtype) {
        const legacyFamily = DND_CONSUMABLE_FAMILY[subtype] ?? 'Environmental';
        family = LEGACY_FAMILY_TO_FAMILY[legacyFamily] ?? legacyFamily;
    }
    if (!family) family = 'Environmental';

    const tags = Array.isArray(flags[ARTIFICER_FLAG_KEYS.TRAITS] ?? flags.traits)
        ? (flags[ARTIFICER_FLAG_KEYS.TRAITS] ?? flags.traits)
        : [flags.primaryTag, ...(Array.isArray(flags.secondaryTags) ? flags.secondaryTags : []), flags.quirk].filter(Boolean);

    const tierVal = flags[ARTIFICER_FLAG_KEYS.SKILL_LEVEL] ?? flags.skillLevel ?? flags.tier;
    const biomes = Array.isArray(flags[ARTIFICER_FLAG_KEYS.BIOMES] ?? flags.biomes) ? (flags[ARTIFICER_FLAG_KEYS.BIOMES] ?? flags.biomes) : [];
    return {
        name: item.name ?? '',
        uuid: item.uuid ?? '',
        img: item.img ?? '',
        type: typeVal,
        dndType: subtype || typeVal,
        family,
        tags,
        tier: typeof tierVal === 'number' ? tierVal : 1,
        rarity: (item.system?.rarity ?? 'Common').trim() || 'Common',
        source,
        artificerType: flags[ARTIFICER_FLAG_KEYS.TYPE] ?? flags.type ?? null,
        biomes
    };
}

/**
 * Get all normalized keys that should map to this item.
 * Translation format: { "alias (normalized)": "Canonical Name" }
 * @param {string} itemName - Item name from compendium
 * @param {Object<string, string>} translation - alias → canonical
 * @returns {string[]} Normalized keys for index
 */
function getCacheKeysForItem(itemName, translation) {
    const normalized = normalizeName(itemName);
    const keys = new Set([normalized]);
    for (const [aliasKey, canonicalValue] of Object.entries(translation)) {
        if (!canonicalValue || typeof canonicalValue !== 'string') continue;
        if (normalizeName(canonicalValue) === normalized) {
            keys.add(normalizeName(aliasKey));
        }
    }
    return Array.from(keys);
}

/**
 * Build name → uuid index from entries and translation
 * @param {Array<{ name: string, uuid: string }>} entries
 * @param {Object<string, string>} translation
 * @returns {Map<string, string>}
 */
function buildNameIndex(entries, translation) {
    const index = new Map();
    for (const entry of entries) {
        const keys = getCacheKeysForItem(entry.name, translation);
        for (const k of keys) {
            if (k) index.set(k, entry.uuid);
        }
    }
    return index;
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
 * Load and validate persisted cache from world setting
 * @returns {{ version: number, compendiumIds: string[], builtAt: number, entries: Array }|null}
 */
function getPersistedCache() {
    try {
        const raw = game.settings.get(MODULE.ID, 'itemCache');
        if (!raw || typeof raw !== 'object') return null;
        const version = raw.version;
        const compendiumIds = Array.isArray(raw.compendiumIds) ? raw.compendiumIds : [];
        const entries = Array.isArray(raw.entries) ? raw.entries : [];
        if (version !== ITEM_CACHE_VERSION) return null;
        const currentIds = getConfiguredCompendiumIds();
        if (currentIds.length !== compendiumIds.length || currentIds.some((id, i) => id !== compendiumIds[i])) {
            return null;
        }
        return { version: raw.version, compendiumIds, builtAt: raw.builtAt ?? 0, entries };
    } catch {
        return null;
    }
}

/**
 * Restore in-memory state from persisted cache (name index + records). Does not fetch Items.
 */
function loadFromPersisted() {
    const payload = getPersistedCache();
    if (!payload || !payload.entries.length) return;
    const translation = getTranslationMap();
    _nameToUuid = buildNameIndex(payload.entries, translation);
    _recordsByUuid.clear();
    for (const entry of payload.entries) {
        if (entry?.uuid) _recordsByUuid.set(entry.uuid, entry);
    }
    _status.hasCache = true;
    _status.compendiumCount = payload.compendiumIds.length;
    _status.itemCount = payload.entries.length;
    _status.message = `${payload.compendiumIds.length} Compendiums, ${payload.entries.length} Items`;
}

/**
 * Add item to in-memory cache (for sync lookups after refresh)
 * @param {Item} item
 * @param {Object<string, string>} translation
 */
function addToCache(item, translation) {
    if (!item?.uuid) return;
    _itemsByUuid.set(item.uuid, item);
    const keys = getCacheKeysForItem(item.name ?? '', translation);
    for (const k of keys) {
        if (k) _cache.set(k, item);
    }
}

/**
 * Build cache from compendia and world; persist to world setting; keep in-memory warm.
 * @param {Function} [onProgress] - (state) => void
 * @returns {Promise<{ compendiumCount: number, itemCount: number }>}
 */
export async function refreshCache(onProgress) {
    _status.building = true;
    _status.hasCache = false;
    _status.message = 'Building cache...';
    _cache.clear();
    _itemsByUuid.clear();
    _nameToUuid.clear();
    _recordsByUuid.clear();

    await loadTranslationFromFile();
    const translation = getTranslationMap();
    const compendiumIds = getConfiguredCompendiumIds();
    const entries = [];
    const seenUuids = new Set();

    const addItem = (item, source) => {
        if (!item || seenUuids.has(item.uuid)) return;
        seenUuids.add(item.uuid);
        entries.push(itemToRecord(item, source));
        addToCache(item, translation);
    };

    const yieldFrame = () => new Promise((r) => requestAnimationFrame(r));

    // 1. From compendia
    for (let i = 0; i < compendiumIds.length; i++) {
        const cid = compendiumIds[i];
        const state = {
            compendiumIndex: i + 1,
            compendiumCount: compendiumIds.length,
            itemCount: entries.length,
            message: `Scanning ${i + 1} of ${compendiumIds.length} compendiums, ${entries.length} items…`
        };
        _status.message = state.message;
        if (onProgress) onProgress(state);
        await yieldFrame();
        try {
            const pack = game.packs.get(cid);
            if (!pack || pack.documentName !== 'Item') continue;
            const index = await pack.getIndex();
            const itemIds = index && typeof index.keys === 'function' ? Array.from(index.keys()) : [];
            if (!itemIds.length) continue;
            for (let ii = 0; ii < itemIds.length; ii++) {
                const itemId = itemIds[ii];
                try {
                    const item = await pack.getDocument(itemId);
                    if (item) addItem(item, cid);
                } catch {
                    continue;
                }
                if (onProgress && ii > 0 && ii % 50 === 0) {
                    _status.message = `Scanning ${i + 1} of ${compendiumIds.length}, ${entries.length} items…`;
                    onProgress({ compendiumIndex: i + 1, compendiumCount: compendiumIds.length, itemCount: entries.length, message: _status.message });
                    await yieldFrame();
                }
            }
        } catch (err) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Cache: error loading compendium "${cid}"`, err?.message ?? null, true, false);
        }
    }

    // 2. From world
    const worldItems = game.items ?? [];
    for (const item of worldItems) {
        addItem(item, 'world');
    }

    // 3. Persist to world setting
    try {
        game.settings.set(MODULE.ID, 'itemCache', {
            version: ITEM_CACHE_VERSION,
            compendiumIds,
            builtAt: Date.now(),
            entries
        });
    } catch (e) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Cache: failed to persist', e?.message ?? null, true, false);
    }

    _status.building = false;
    _status.hasCache = true;
    _status.compendiumCount = compendiumIds.length;
    _status.itemCount = entries.length;
    _status.message = `${compendiumIds.length} compendiums, ${entries.length} items`;

    if (onProgress) {
        onProgress({
            compendiumIndex: compendiumIds.length,
            compendiumCount: compendiumIds.length,
            itemCount: entries.length,
            message: _status.message
        });
    }
    await yieldFrame();

    return { compendiumCount: compendiumIds.length, itemCount: entries.length };
}

/**
 * Get cache status for UI. Restores from persisted cache if we don't have one in memory.
 * @returns {{ hasCache: boolean, building: boolean, compendiumCount: number, itemCount: number, message: string }}
 */
export function getCacheStatus() {
    if (!_status.hasCache && !_status.building) {
        loadFromPersisted();
    }
    return { ..._status };
}

/**
 * Look up item by name. Uses in-memory cache if warm; otherwise fetches by uuid from persisted index.
 * @param {string} name - Item name (any variant)
 * @param {string} [typeFilter] - 'container' to filter by container type
 * @returns {Promise<Item|null>}
 */
export async function getFromCache(name, typeFilter) {
    if (_status.building) return null;
    if (!_status.hasCache) {
        loadFromPersisted();
        if (!_status.hasCache) return null;
    }
    const key = normalizeName(name);
    if (!key) return null;

    // In-memory warm path
    const cached = _cache.get(key);
    if (cached) {
        if (typeFilter === 'container') {
            const f = cached.flags?.artificer ?? cached.flags?.[MODULE.ID];
            const t = f?.[ARTIFICER_FLAG_KEYS.TYPE] ?? f?.type;
            const fam = f?.[ARTIFICER_FLAG_KEYS.FAMILY] ?? f?.family;
            const isContainer = t === 'container' || (t === 'Tool' && fam === 'Container');
            if (!isContainer) return null;
        }
        return cached;
    }

    // Persisted-only path: resolve uuid then fetch
    const uuid = _nameToUuid.get(key);
    if (!uuid) return null;
    try {
        const item = await fromUuid(uuid);
        if (!item) return null;
        if (typeFilter === 'container') {
            const f = item.flags?.artificer ?? item.flags?.[MODULE.ID];
            const t = f?.[ARTIFICER_FLAG_KEYS.TYPE] ?? f?.type;
            const fam = f?.[ARTIFICER_FLAG_KEYS.FAMILY] ?? f?.family;
            const isContainer = t === 'container' || (t === 'Tool' && fam === 'Container');
            if (!isContainer) return null;
        }
        return item;
    } catch {
        return null;
    }
}

/**
 * Get all records from persisted cache. NO compendium/fromUuid calls.
 * Use this for fast init: build ArtificerIngredient etc. from records.
 * @returns {Array<{ name: string, uuid: string, img?: string, type?: string, dndType?: string, family: string, tags?: string[], tier?: number, rarity?: string, source?: string, artificerType?: string|null, biomes?: string[] }>}
 */
export function getAllRecordsFromCache() {
    if (_status.building) return [];
    if (!_status.hasCache) {
        loadFromPersisted();
        if (!_status.hasCache) return [];
    }
    return Array.from(_recordsByUuid.values());
}

/**
 * Get all unique items from cache. When restored from persisted, fetches each by uuid.
 * ONLY use when full Item documents are required (e.g. adding to actor). Avoid on init.
 * @returns {Promise<Item[]>}
 */
export async function getAllItemsFromCache() {
    if (_status.building) return [];
    if (!_status.hasCache) {
        loadFromPersisted();
        if (!_status.hasCache) return [];
    }
    if (_itemsByUuid.size > 0) {
        return Array.from(_itemsByUuid.values());
    }
    const items = [];
    for (const uuid of _recordsByUuid.keys()) {
        try {
            const item = await fromUuid(uuid);
            if (item) items.push(item);
        } catch {
            continue;
        }
    }
    return items;
}

/**
 * Clear cache (in-memory and persisted)
 */
export function clearCache() {
    _cache.clear();
    _itemsByUuid.clear();
    _nameToUuid.clear();
    _recordsByUuid.clear();
    _status = {
        hasCache: false,
        building: false,
        compendiumCount: 0,
        itemCount: 0,
        message: ''
    };
    try {
        game.settings.set(MODULE.ID, 'itemCache', null);
    } catch {
        // ignore
    }
}
