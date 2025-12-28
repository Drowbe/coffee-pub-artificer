// ================================================================== 
// ===== ARTIFICER ITEM UTILITIES ===================================
// ================================================================== 

import { MODULE } from './const.js';

/**
 * Create a FoundryVTT Item with Artificer flags
 * @param {Object} itemData - D&D 5e item data structure
 * @param {Object} artificerData - Artificer-specific data (tags, family, tier, etc.)
 * @param {Object} options - Additional options
 * @param {string} options.type - Item type: 'ingredient', 'component', or 'essence'
 * @param {boolean} options.createInWorld - Create in world (default: true)
 * @param {Actor|null} options.actor - Optional actor to add item to
 * @returns {Promise<Item>} Created item
 */
export async function createArtificerItem(itemData, artificerData, options = {}) {
    const { type, createInWorld = true, actor = null } = options;
    
    // Validate type
    if (!['ingredient', 'component', 'essence'].includes(type)) {
        throw new Error(`Invalid item type: ${type}. Must be 'ingredient', 'component', or 'essence'`);
    }
    
    // Validate artificer data
    validateArtificerData(artificerData, type);
    
    // Build item structure
    const itemStructure = {
        name: itemData.name || 'Unnamed Item',
        type: itemData.type || 'consumable', // Default to consumable for ingredients
        img: itemData.img || '',
        system: buildItemSystem(itemData),
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
 * @param {Object} itemData - Item data
 * @returns {Object} System data structure
 */
function buildItemSystem(itemData) {
    // Base structure for D&D 5e items - minimal required fields
    const system = {
        description: {
            value: itemData.description || '',
            chat: '',
            unidentified: ''
        },
        source: {
            value: ''
        },
        quantity: 1,
        weight: itemData.weight || 0,
        price: itemData.price || 0,
        rarity: (itemData.rarity || 'common').toLowerCase(),
        identified: true
    };
    
    // Add type-specific system data
    if (itemData.type === 'consumable') {
        system.consumableType = itemData.consumableType || 'other';
        system.uses = {
            value: 1,
            max: 1,
            per: 'none'
        };
    }
    
    // For other types, D&D 5e system will add default structure
    // We keep it minimal to avoid validation errors
    
    return system;
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
    if (type === 'ingredient') {
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
    if (type === 'ingredient') {
        if (!artificerData.family) {
            throw new Error('family is required for ingredients');
        }
        if (artificerData.secondaryTags && artificerData.secondaryTags.length > 2) {
            throw new Error('ingredients can have at most 2 secondary tags');
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
 * @returns {string|null} 'ingredient', 'component', 'essence', or null
 */
export function getArtificerType(item) {
    return item.flags[MODULE.ID]?.type || null;
}

