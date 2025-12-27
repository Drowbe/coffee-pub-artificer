// ================================================================== 
// ===== COMPONENT SCHEMA DEFINITIONS ===============================
// ================================================================== 

/**
 * @typedef {Object} ArtificerComponent
 * @property {string} id - Unique identifier (UUID)
 * @property {string} name - Display name
 * @property {string} type - Component type (Metal, Alchemical, Monster, Arcane, Structural)
 * @property {string[]} tags - Component tags (Refined, Alloy, Stabilized, Binding, Reactive, Haft, Plate, etc.)
 * @property {number} tier - Tier level
 * @property {string} rarity - Rarity level
 * @property {string} description - Flavor text description
 * @property {string|null} image - Image path or UUID
 * @property {string} source - Source compendium pack UUID
 */

/**
 * Component Types
 * @enum {string}
 */
export const COMPONENT_TYPES = {
    METAL: 'Metal',
    ALCHEMICAL: 'Alchemical',
    MONSTER: 'Monster',
    ARCANE: 'Arcane',
    STRUCTURAL: 'Structural'
};

