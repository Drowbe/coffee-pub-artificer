// ================================================================== 
// ===== INGREDIENT SCHEMA DEFINITIONS ==============================
// ================================================================== 

/**
 * @typedef {Object} ArtificerIngredient
 * @property {string} id - Unique identifier (UUID)
 * @property {string} name - Display name
 * @property {string} family - Ingredient family (Herbs, Minerals, Gems, Creature Parts, Environmental)
 * @property {number} skillLevel - Minimum crafting skill level required (1+)
 * @property {number} [tier] - Tier level (optional; may be deprecated in favor of rarity/skillLevel)
 * @property {string} rarity - Rarity level (Common, Uncommon, Rare, Very Rare, Legendary)
 * @property {string} primaryTag - Primary tag (always visible, determines category)
 * @property {string[]} secondaryTags - Secondary tags (1-2 tags, revealed after 3 uses)
 * @property {string|null} quirk - Optional quirk (rare, volatile, soothing, etc.) - revealed after 5 uses
 * @property {string[]} biomes - Biomes where this ingredient can be found
 * @property {string} description - Flavor text description
 * @property {string|null} image - Image path or UUID
 * @property {string} source - Source compendium pack UUID
 */

/**
 * Ingredient Families
 * @enum {string}
 */
export const INGREDIENT_FAMILIES = {
    HERBS: 'Herbs',
    MINERALS: 'Minerals',
    GEMS: 'Gems',
    CREATURE_PARTS: 'CreatureParts',
    ENVIRONMENTAL: 'Environmental'
};

/**
 * Ingredient Rarities
 * @enum {string}
 */
/** D&D 5e standard rarities (source of truth) */
export const INGREDIENT_RARITIES = {
    COMMON: 'Common',
    UNCOMMON: 'Uncommon',
    RARE: 'Rare',
    VERY_RARE: 'Very Rare',
    LEGENDARY: 'Legendary'
};

