// ================================================================== 
// ===== ARTIFICER ITEM UTILITIES ===================================
// ================================================================== 

import { MODULE } from './const.js';
import { getFromCache } from './cache/cache-items.js';
import { normalizePunctuationForStorage } from './utils/helpers.js';
import {
    ARTIFICER_TYPES,
    LEGACY_TYPE_TO_ARTIFICER_TYPE,
    LEGACY_FAMILY_TO_FAMILY,
    FAMILIES_BY_TYPE,
    ARTIFICER_FLAG_KEYS
} from './schema-artificer-item.js';
import { OFFICIAL_BIOMES } from './schema-ingredients.js';

/**
 * Get configured compendium IDs from settings (in priority order)
 * @returns {string[]}
 */
function getConfiguredCompendiumIds() {
    const compendiums = [];
    let numCompendiums = 1;
    try {
        numCompendiums = game.settings.get(MODULE.ID, 'numIngredientCompendiums') ?? 1;
    } catch {
        return [];
    }
    for (let i = 1; i <= numCompendiums; i++) {
        try {
            const id = game.settings.get(MODULE.ID, `ingredientCompendium${i}`);
            if (id && id !== 'none' && id !== '') compendiums.push(id);
        } catch {
            continue;
        }
    }
    return compendiums;
}

/**
 * Resolve an item by name. Search order is controlled by itemLookupOrder setting:
 * - compendia-first: compendia first, then world
 * - world-first: world first, then compendia
 * - compendia-only: compendia only
 * @param {string} name - Item name (exact match, trimmed)
 * @param {string} [type] - Optional filter: 'container' for container-type only
 * @returns {Promise<Item|null>}
 */
export async function resolveItemByName(name, type) {
    if (!name || typeof name !== 'string') return null;
    const targetName = name.trim();

    // Use cache if available (purposeful refresh by GM)
    const cached = await getFromCache(targetName, type);
    if (cached) return cached;

    const lookupOrder = game.settings.get(MODULE.ID, 'itemLookupOrder') ?? 'compendia-first';

    const searchCompendia = async () => {
        const compendiumIds = getConfiguredCompendiumIds();
        for (const compendiumId of compendiumIds) {
            try {
                const pack = game.packs.get(compendiumId);
                if (!pack || pack.documentName !== 'Item') continue;
                const index = await pack.getIndex();
                const raw = index?.contents ?? index?.index ?? index?.entries ?? (Array.isArray(index) ? index : []);
                const entries = Array.isArray(raw) ? raw : [];
                const entry = entries.find((c) => (c?.name ?? '').trim() === targetName);
                if (!entry) continue;
                const item = await pack.getDocument(entry._id ?? entry.id);
                if (!item) continue;
                if (type === 'container') {
                    const f = item.flags?.artificer ?? item.flags?.[MODULE.ID];
                    const t = f?.[ARTIFICER_FLAG_KEYS.TYPE] ?? f?.type;
                    const fam = f?.[ARTIFICER_FLAG_KEYS.FAMILY] ?? f?.family;
                    const isContainer = t === 'container' || (t === ARTIFICER_TYPES.TOOL && fam === 'Container');
                    if (!isContainer) continue;
                }
                return item;
            } catch (err) {
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Error searching compendium "${compendiumId}" for "${targetName}"`, err?.message ?? null, true, false);
                continue;
            }
        }
        return null;
    };

    const searchWorld = () => {
        const items = game.items ?? [];
        for (const i of items) {
            if ((i.name ?? '').trim() !== targetName) continue;
            if (type === 'container') {
                const f = i.flags?.artificer ?? i.flags?.[MODULE.ID];
                const t = f?.[ARTIFICER_FLAG_KEYS.TYPE] ?? f?.type;
                const fam = f?.[ARTIFICER_FLAG_KEYS.FAMILY] ?? f?.family;
                const isContainer = t === 'container' || (t === ARTIFICER_TYPES.TOOL && fam === 'Container');
                if (!isContainer) continue;
            }
            return i;
        }
        return null;
    };

    if (lookupOrder === 'compendia-only') {
        return searchCompendia();
    }
    if (lookupOrder === 'world-first') {
        const found = searchWorld();
        return found ?? searchCompendia();
    }
    // compendia-first (default)
    const fromCompendium = await searchCompendia();
    return fromCompendium ?? searchWorld();
}

/**
 * Create a FoundryVTT Item with Artificer flags (TYPE > FAMILY > TRAITS).
 * @param {Object} itemData - D&D 5e item data structure
 * @param {Object} artificerData - { type, family, traits, skillLevel, rarity, biomes?, affinity? }
 * @param {Object} options - { createInWorld, actor }
 * @returns {Promise<Item>} Created item
 */
export async function createArtificerItem(payload, artificerData, options = {}) {
    const { createInWorld = true, actor = null } = options;
    const type = artificerData.type || ARTIFICER_TYPES.COMPONENT;

    validateArtificerData(artificerData);

    const itemStructure = {
        name: payload.name || 'Unnamed Item',
        type: payload.type || 'consumable',
        img: payload.img || '',
        system: buildItemSystem(payload),
        flags: {
            [MODULE.ID]: buildArtificerFlags(artificerData)
        }
    };
    
    // Create item
    let item;
    if (createInWorld) {
        try {
            const createdItems = await Item.createDocuments([itemStructure], {});
            item = createdItems[0];
        } catch (error) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Error creating item', error?.message ?? String(error), true, false);
            throw new Error(`Failed to create item: ${error.message}`);
        }
    } else {
        // For compendium creation, we'd need compendium reference
        throw new Error('Compendium creation not yet implemented');
    }
    
    // Optionally add to actor
    if (actor && item) {
        await actor.createEmbeddedDocuments('Item', [item.toObject()]);
    }
    
    return item;
}

/**
 * Add a crafted item to an actor. If the actor already has an item with the same name and type
 * that has a quantity (stackable), increment its quantity by 1. Otherwise create a new item.
 * @param {Actor} actor
 * @param {Object} itemData - Item data (e.g. from item.toObject()), with _id removed
 * @returns {Promise<Item|null>} The existing (updated) or newly created item
 */
export async function addCraftedItemToActor(actor, itemData) {
    if (!actor || !itemData) return null;
    const name = (itemData.name || '').trim();
    const type = itemData.type || 'consumable';
    const existing = actor.items.find((i) => (i.name || '').trim() === name && (i.type || '') === type);
    if (existing) {
        const q = existing.system?.quantity;
        if (typeof q === 'number' && q >= 0) {
            await existing.update({ 'system.quantity': q + 1 });
            return existing;
        }
    }
    const obj = foundry.utils.duplicate(itemData);
    delete obj._id;
    if (obj.id !== undefined) delete obj.id;
    const created = await actor.createEmbeddedDocuments('Item', [obj]);
    return created?.[0] ?? null;
}

/**
 * Update an existing item with new data
 * @param {Item} item - Item to update
 * @param {Object} itemData - D&D 5e item data structure
 * @param {Object} artificerData - Artificer-specific data
 * @returns {Promise<Item>} Updated item
 */
export async function updateArtificerItem(item, itemData, artificerData) {
    validateArtificerData(artificerData);

    const updateData = {
        name: itemData.name,
        type: itemData.type,
        img: itemData.img,
        system: buildItemSystem(itemData),
        [`flags.${MODULE.ID}`]: buildArtificerFlags(artificerData)
    };

    return await item.update(updateData);
}

/**
 * Build D&D 5e item system data
 * Preserves full payload.system when present (activities, uses, consumableType, etc.)
 * so items retain healing, poison, magical, and cross-module properties.
 * @param {Object} payload - Full item payload (may include system)
 * @returns {Object} System data structure
 */
function buildItemSystem(payload) {
    const hasSystem = payload?.system && typeof payload.system === 'object' && Object.keys(payload.system).length > 0;

    // Base defaults (from flat fields or minimal structure)
    const descriptionValue = payload.description ?? payload.system?.description?.value ?? '';
    const weight = payload.weight ?? payload.system?.weight ?? 0;
    const priceVal = payload.price ?? payload.system?.price?.value ?? payload.system?.price ?? 0;
    const rarityRaw = payload.rarity ?? payload.system?.rarity ?? 'common';
    const rarity = typeof rarityRaw === 'string' ? rarityRaw.toLowerCase() : 'common';

    const defaults = {
        description: {
            value: descriptionValue,
            chat: payload.system?.description?.chat ?? '',
            unidentified: payload.system?.description?.unidentified ?? ''
        },
        source: {
            value: payload.system?.source?.value ?? payload.system?.source?.custom ?? '',
            custom: payload.system?.source?.custom ?? payload.system?.source?.value ?? 'Artificer',
            license: payload.system?.source?.license ?? ''
        },
        quantity: payload.system?.quantity ?? 1,
        weight,
        price: typeof priceVal === 'object' ? priceVal : { value: priceVal, denomination: 'gp' },
        rarity,
        identified: payload.system?.identified ?? true
    };

    if (payload.type === 'consumable' || (hasSystem && (payload.system.consumableType || payload.system.type?.value))) {
        // D&D 5e 5.5 schema mappings (import JSON uses legacy names; we convert)
        const consumableType = payload.system?.type?.value ?? payload.system?.consumableType ?? 'other';
        const autoDestroy = payload.system?.uses?.autoDestroy ?? payload.system?.destroyOnEmpty ?? true;
        const isMagical = payload.system?.consumptionMagical ?? (Array.isArray(payload.system?.properties) && payload.system.properties.includes('mgc'));
        // foodType → type.subtype when consumableType is "food"
        const foodType = payload.system?.foodType ?? '';
        const subtype = payload.system?.type?.subtype ?? (consumableType === 'food' ? foodType : '');
        defaults.type = {
            value: consumableType,
            subtype,
            baseItem: payload.system?.type?.baseItem ?? ''
        };
        // recoveryPeriod → uses.recovery (D&D 5e uses recovery array, not recoveryPeriod)
        const recoveryPeriod = payload.system?.recoveryPeriod ?? payload.system?.uses?.recovery?.[0]?.period ?? 'none';
        const recoveryPeriodNorm = String(recoveryPeriod).toLowerCase().replace(/\s+/g, '');
        const recoveryPeriodMap = {
            none: 'none',
            never: 'none',
            longrest: 'longRest',
            shortrest: 'shortRest',
            dawn: 'dawn'
        };
        const recoveryPeriodVal = recoveryPeriodMap[recoveryPeriodNorm] ?? 'none';
        const usesIn = payload.system?.uses ?? {};
        defaults.uses = {
            value: usesIn.value ?? 1,
            max: usesIn.max ?? 1,
            per: usesIn.per ?? 'charges',
            autoDestroy,
            recovery: usesIn.recovery ?? [{ period: recoveryPeriodVal }]
        };
        defaults.activities = Array.isArray(payload.system?.activities) ? [...payload.system.activities] : [];
        // Magical: D&D 5e uses properties set with "mgc"
        const existingProps = Array.isArray(payload.system?.properties) ? payload.system.properties : [];
        defaults.properties = isMagical && !existingProps.includes('mgc') ? [...existingProps, 'mgc'] : existingProps.length ? existingProps : (isMagical ? ['mgc'] : []);
    }

    // If payload has full system, deep merge (payload.system wins for nested objects)
    let system;
    if (hasSystem) {
        system = deepMergeSystem(defaults, payload.system);
    } else {
        system = defaults;
    }

    // Explicitly ensure source.value, source.custom, and source.license are set (Configure Source dialog)
    const sourceValue = payload.system?.source?.value ?? payload.system?.source?.custom ?? '';
    const sourceCustom = payload.system?.source?.custom ?? payload.system?.source?.value ?? 'Artificer';
    const sourceLicense = payload.system?.source?.license ?? '';
    system.source = {
        ...(typeof system.source === 'object' ? system.source : {}),
        value: sourceValue || system.source?.value || '',
        custom: sourceCustom || system.source?.custom || 'Artificer',
        license: sourceLicense || system.source?.license || ''
    };

    return system;
}

/**
 * Deep merge payload.system into defaults; preserves activities, uses, and nested structures
 * @param {Object} defaults - Base structure
 * @param {Object} incoming - Incoming system data from payload
 * @returns {Object} Merged system
 */
function deepMergeSystem(defaults, incoming) {
    const result = { ...defaults };
    for (const key of Object.keys(incoming)) {
        const inc = incoming[key];
        if (inc === null || inc === undefined) continue;
        if (Array.isArray(inc)) {
            result[key] = [...inc];
        } else if (typeof inc === 'object' && inc !== null && !(inc instanceof Date) && !Array.isArray(inc)) {
            result[key] = deepMergeSystem(result[key] ?? {}, inc);
        } else {
            result[key] = inc;
        }
    }
    return result;
}

/**
 * Build Artificer flags (namespaced keys: artificerType, artificerFamily, etc.).
 * @param {Object} artificerData - { type, family, traits, skillLevel, rarity, biomes?, affinity? }
 * @returns {Object} Flags structure
 */
function buildArtificerFlags(artificerData) {
    const type = artificerData.type || ARTIFICER_TYPES.COMPONENT;
    const flags = {
        [ARTIFICER_FLAG_KEYS.TYPE]: type,
        [ARTIFICER_FLAG_KEYS.FAMILY]: artificerData.family || '',
        [ARTIFICER_FLAG_KEYS.TRAITS]: Array.isArray(artificerData.traits) ? artificerData.traits : [],
        [ARTIFICER_FLAG_KEYS.SKILL_LEVEL]: Math.max(1, parseInt(artificerData.skillLevel, 10) || 1)
    };
    if (type === ARTIFICER_TYPES.COMPONENT) {
        if (Array.isArray(artificerData.biomes)) {
            flags[ARTIFICER_FLAG_KEYS.BIOMES] = artificerData.biomes.filter(b => OFFICIAL_BIOMES.includes(b));
        }
        if (artificerData.quirk) flags[ARTIFICER_FLAG_KEYS.QUIRK] = String(artificerData.quirk).trim();
    }
    if (artificerData.affinity) flags[ARTIFICER_FLAG_KEYS.AFFINITY] = artificerData.affinity;
    return flags;
}

/**
 * Validate artificer data (TYPE > FAMILY > TRAITS).
 * @param {Object} artificerData - { type, family, traits, skillLevel, rarity, ... }
 * @throws {Error} If validation fails
 */
export function validateArtificerData(artificerData) {
    if (!artificerData) throw new Error('Artificer data is required');

    const type = artificerData.type || ARTIFICER_TYPES.COMPONENT;
    if (!Object.values(ARTIFICER_TYPES).includes(type)) {
        throw new Error(`type must be one of: ${Object.values(ARTIFICER_TYPES).join(', ')}`);
    }

    const families = FAMILIES_BY_TYPE[type];
    if (families && !families.includes(artificerData.family)) {
        if (artificerData.family) {
            throw new Error(`family must be one of: ${families.join(', ')}`);
        }
        throw new Error('family is required');
    }

    if (Array.isArray(artificerData.traits) && artificerData.traits.length > 20) {
        throw new Error('traits: at most 20 allowed');
    }

    const sl = artificerData.skillLevel != null ? parseInt(artificerData.skillLevel, 10) : 1;
    if (Number.isNaN(sl) || sl < 1) throw new Error('skillLevel must be at least 1');
}

/**
 * Get artificer type from flags (supports namespaced artificerType and legacy type).
 * @param {Object} flags - flags[MODULE.ID]
 * @returns {string|null} Component | Creation | Tool | null
 */
export function getArtificerTypeFromFlags(flags) {
    if (!flags) return null;
    const t = flags[ARTIFICER_FLAG_KEYS.TYPE] ?? flags.type;
    if (Object.values(ARTIFICER_TYPES).includes(t)) return t;
    return LEGACY_TYPE_TO_ARTIFICER_TYPE[t] ?? null;
}

/**
 * Get family from flags (supports namespaced artificerFamily and legacy family).
 * @param {Object} flags - flags[MODULE.ID]
 * @returns {string|null}
 */
export function getFamilyFromFlags(flags) {
    if (!flags) return null;
    const fam = flags[ARTIFICER_FLAG_KEYS.FAMILY] ?? flags.family;
    if (fam && !flags.primaryTag) {
        return LEGACY_FAMILY_TO_FAMILY[fam] ?? fam;
    }
    return LEGACY_FAMILY_TO_FAMILY[fam] ?? fam ?? null;
}

/**
 * Get traits array from flags (supports namespaced artificerTraits and legacy primaryTag/secondaryTags/quirk).
 * @param {Object} flags - flags[MODULE.ID]
 * @returns {string[]}
 */
export function getTraitsFromFlags(flags) {
    if (!flags) return [];
    const arr = flags[ARTIFICER_FLAG_KEYS.TRAITS] ?? flags.traits;
    if (Array.isArray(arr)) return arr;
    const primary = flags.primaryTag ? [flags.primaryTag] : [];
    const secondary = Array.isArray(flags.secondaryTags) ? flags.secondaryTags : [];
    const q = flags[ARTIFICER_FLAG_KEYS.QUIRK] ?? flags.quirk;
    const quirk = q ? [q] : [];
    return [...primary, ...secondary, ...quirk].filter(Boolean);
}

/**
 * Extract artificer data from an item (normalized; supports namespaced and legacy flags).
 * @param {Item} item - Item to extract data from
 * @returns {Object} Artificer data (type, family, traits, skillLevel, rarity, biomes, quirk, affinity)
 */
export function extractArtificerData(item) {
    const flags = item.flags[MODULE.ID] || {};
    const rawBiomes = flags[ARTIFICER_FLAG_KEYS.BIOMES] ?? flags.biomes ?? [];
    return {
        type: getArtificerTypeFromFlags(flags) || ARTIFICER_TYPES.COMPONENT,
        family: getFamilyFromFlags(flags) || '',
        traits: getTraitsFromFlags(flags),
        skillLevel: flags[ARTIFICER_FLAG_KEYS.SKILL_LEVEL] ?? flags.skillLevel ?? 1,
        rarity: (item.system?.rarity ?? 'Common').trim() || 'Common',
        biomes: Array.isArray(rawBiomes) ? rawBiomes.filter(b => OFFICIAL_BIOMES.includes(b)) : [],
        quirk: (flags[ARTIFICER_FLAG_KEYS.QUIRK] ?? flags.quirk) || null,
        affinity: (flags[ARTIFICER_FLAG_KEYS.AFFINITY] ?? flags.affinity) || null
    };
}

/**
 * Check if an item is an artificer item (has type in flags, including legacy).
 * @param {Item} item - Item to check
 * @returns {boolean}
 */
export function isArtificerItem(item) {
    const f = item.flags[MODULE.ID];
    if (!f) return false;
    const t = f[ARTIFICER_FLAG_KEYS.TYPE] ?? f.type;
    return !!(t && (Object.values(ARTIFICER_TYPES).includes(t) || LEGACY_TYPE_TO_ARTIFICER_TYPE[t]));
}

/**
 * Get the artificer type of an item (Component | Creation | Tool or legacy equivalent).
 * @param {Item} item - Item to check
 * @returns {string|null}
 */
export function getArtificerType(item) {
    return getArtificerTypeFromFlags(item.flags[MODULE.ID] || null);
}

/**
 * Build update payload to normalize typographic punctuation on one item (name, description, artificer quirk/traits).
 * @param {Item} item
 * @returns {Object|null} Update payload or null if nothing to change
 */
function buildItemPunctuationUpdatePayload(item) {
    const updates = {};
    const nameNorm = normalizePunctuationForStorage(item.name);
    if (nameNorm !== (item.name || '')) updates.name = nameNorm;

    const descPath = 'system.description.value';
    const descRaw = foundry.utils.getProperty(item, descPath);
    if (descRaw != null && typeof descRaw === 'string') {
        const descNorm = normalizePunctuationForStorage(descRaw);
        if (descNorm !== descRaw) updates[descPath] = descNorm;
    }

    const flagKey = item.flags[MODULE.ID] ? MODULE.ID : 'artificer';
    const flags = item.flags[flagKey] || {};
    const quirkRaw = flags[ARTIFICER_FLAG_KEYS.QUIRK] ?? flags.quirk;
    if (quirkRaw != null && typeof quirkRaw === 'string') {
        const quirkNorm = normalizePunctuationForStorage(quirkRaw);
        if (quirkNorm !== quirkRaw) updates[`flags.${flagKey}.artificerQuirk`] = quirkNorm;
    }
    const traitsRaw = flags[ARTIFICER_FLAG_KEYS.TRAITS] ?? flags.traits;
    if (Array.isArray(traitsRaw) && traitsRaw.length > 0) {
        const traitsNorm = traitsRaw.map((t) => (typeof t === 'string' ? normalizePunctuationForStorage(t) : t));
        if (traitsNorm.some((t, i) => t !== traitsRaw[i])) {
            updates[`flags.${flagKey}.artificerTraits`] = traitsNorm;
        }
    }

    return Object.keys(updates).length ? updates : null;
}

/**
 * Normalize typographic punctuation (curly/smart apostrophes and quotes) on world items that have Artificer data.
 * Updates name, system.description.value, and artificer quirk/traits to straight ASCII.
 * Only items with Artificer flags (type in flags) are processed.
 * @param {Object} [options]
 * @param {boolean} [options.dryRun=false] - If true, do not write; only report counts.
 * @returns {Promise<{ updated: number, skipped: number, errors: Array<{ name: string, error: string }> }>}
 */
export async function normalizeItemsPunctuation(options = {}) {
    const dryRun = !!options.dryRun;
    const result = { updated: 0, skipped: 0, errors: [] };
    if (!game.items?.size) return result;

    for (const item of game.items) {
        if (!isArtificerItem(item)) {
            result.skipped++;
            continue;
        }
        const payload = buildItemPunctuationUpdatePayload(item);
        if (!payload) {
            result.skipped++;
            continue;
        }
        try {
            if (!dryRun) await item.update(payload);
            result.updated++;
        } catch (e) {
            result.errors.push({ name: item.name ?? item.id ?? 'Unknown', error: e?.message ?? String(e) });
        }
    }
    return result;
}

