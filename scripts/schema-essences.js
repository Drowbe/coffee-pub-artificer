// ================================================================== 
// ===== ESSENCE SCHEMA DEFINITIONS =================================
// ================================================================== 

/**
 * @typedef {Object} ArtificerEssence
 * @property {string} id - Unique identifier (UUID)
 * @property {string} name - Display name
 * @property {string} affinity - Essence affinity/element (Heat, Cold, Electric, Light, Shadow, Time, Mind, Life, Death, etc.)
 * @property {string[]} tags - Essence tags
 * @property {number} tier - Tier level
 * @property {string} rarity - Rarity level
 * @property {string} description - Flavor text description
 * @property {string|null} image - Image path or UUID
 * @property {string} source - Source compendium pack UUID
 */

/**
 * Essence Affinities
 * @enum {string}
 */
export const ESSENCE_AFFINITIES = {
    HEAT: 'Heat',
    COLD: 'Cold',
    ELECTRIC: 'Electric',
    LIGHT: 'Light',
    SHADOW: 'Shadow',
    TIME: 'Time',
    MIND: 'Mind',
    LIFE: 'Life',
    DEATH: 'Death'
};

