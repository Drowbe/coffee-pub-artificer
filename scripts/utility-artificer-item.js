// ================================================================== 
// ===== ARTIFICER ITEM UTILITIES ===================================
// ================================================================== 

import { MODULE } from './const.js';

/**
 * Create a FoundryVTT Item with Artificer flags
 * @param {Object} itemData - D&D 5e item data structure
 * @param {Object} artificerData - Artificer-specific data (tags, family, tier, etc.)
 * @param {Object} options - Additional options
 * @param {string} options.type - Item type: 'ingredient', 'component', 'essence', or 'container'
 * @param {boolean} options.createInWorld - Create in world (default: true)
 * @param {Actor|null} options.actor - Optional actor to add item to
 * @returns {Promise<Item>} Created item
 */
export async function createArtificerItem(payload, artificerData, options = {}) {
    const { type, createInWorld = true, actor = null } = options;
    
    // Validate type
    if (!['ingredient', 'component', 'essence', 'container'].includes(type)) {
        throw new Error(`Invalid item type: ${type}. Must be 'ingredient', 'component', 'essence', or 'container'`);
    }
    
    // Validate artificer data
    validateArtificerData(artificerData, type);
    
    // Build item structure
    const itemStructure = {
        name: payload.name || 'Unnamed Item',
        type: payload.type || 'consumable',
        img: payload.img || '',
        system: buildItemSystem(payload),
        flags: {
            [MODULE.ID]: buildArtificerFlags(artificerData, type)
        }
    };
    
    // Create item
    let item;
    if (createInWorld) {
        try {
            const createdItems = await Item.createDocuments([itemStructure], {});
            item = createdItems[0];
        } catch (error) {
            console.error('Error creating item:', error);
            console.error('Item structure:', itemStructure);
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
 * Update an existing item with new data
 * @param {Item} item - Item to update
 * @param {Object} itemData - D&D 5e item data structure
 * @param {Object} artificerData - Artificer-specific data
 * @returns {Promise<Item>} Updated item
 */
export async function updateArtificerItem(item, itemData, artificerData) {
    // Determine type from existing flags or default
    const existingFlags = item.flags[MODULE.ID] || {};
    const type = existingFlags.type || 'ingredient';
    
    // Validate artificer data
    validateArtificerData(artificerData, type);
    
    // Build update data
    const updateData = {
        name: itemData.name,
        type: itemData.type,
        img: itemData.img,
        system: buildItemSystem(itemData),
        [`flags.${MODULE.ID}`]: buildArtificerFlags(artificerData, type)
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
 * Build Artificer flags structure
 * @param {Object} artificerData - Artificer data
 * @param {string} type - Item type
 * @returns {Object} Flags structure
 */
function buildArtificerFlags(artificerData, type) {
    const flags = {
        type: type,
        primaryTag: artificerData.primaryTag || '',
        secondaryTags: artificerData.secondaryTags || [],
        tier: artificerData.tier || 1,
        rarity: artificerData.rarity || 'Common'
    };
    
    // Type-specific flags
    if (type === 'ingredient' || type === 'container') {
        flags.family = artificerData.family || '';
        flags.quirk = artificerData.quirk || null;
        flags.biomes = artificerData.biomes || [];
    } else if (type === 'component') {
        flags.componentType = artificerData.componentType || '';
    } else if (type === 'essence') {
        flags.affinity = artificerData.affinity || '';
    }
    
    return flags;
}

/**
 * Validate artificer data
 * @param {Object} artificerData - Artificer data to validate
 * @param {string} type - Item type
 * @throws {Error} If validation fails
 */
export function validateArtificerData(artificerData, type) {
    if (!artificerData) {
        throw new Error('Artificer data is required');
    }
    
    // Validate required fields
    if (!artificerData.primaryTag) {
        throw new Error('primaryTag is required');
    }
    
    // Validate type-specific requirements
    if (type === 'ingredient' || type === 'container') {
        if (!artificerData.family) {
            throw new Error(`family is required for ${type}s`);
        }
        if (artificerData.secondaryTags && artificerData.secondaryTags.length > 2) {
            throw new Error(`${type}s can have at most 2 secondary tags`);
        }
    } else if (type === 'component') {
        if (!artificerData.componentType) {
            throw new Error('componentType is required for components');
        }
    } else if (type === 'essence') {
        if (!artificerData.affinity) {
            throw new Error('affinity is required for essences');
        }
    }
    
    // Validate tier
    if (artificerData.tier && (artificerData.tier < 1 || artificerData.tier > 10)) {
        throw new Error('tier must be between 1 and 10');
    }
}

/**
 * Extract artificer data from an item
 * @param {Item} item - Item to extract data from
 * @returns {Object} Artificer data
 */
export function extractArtificerData(item) {
    const flags = item.flags[MODULE.ID] || {};
    return {
        type: flags.type,
        primaryTag: flags.primaryTag,
        secondaryTags: flags.secondaryTags || [],
        tier: flags.tier || 1,
        rarity: flags.rarity || 'Common',
        family: flags.family || null,
        quirk: flags.quirk || null,
        biomes: flags.biomes || [],
        componentType: flags.componentType || null,
        affinity: flags.affinity || null
    };
}

/**
 * Check if an item is an artificer item
 * @param {Item} item - Item to check
 * @returns {boolean} True if item has artificer flags
 */
export function isArtificerItem(item) {
    return !!(item.flags[MODULE.ID]?.type);
}

/**
 * Get the artificer type of an item
 * @param {Item} item - Item to check
 * @returns {string|null} 'ingredient', 'component', 'essence', 'container', or null
 */
export function getArtificerType(item) {
    return item.flags[MODULE.ID]?.type || null;
}

