// ================================================================== 
// ===== INGREDIENT SCHEMA DEFINITIONS ==============================
// ================================================================== 

/**
 * @typedef {Object} ArtificerIngredient
 * Uses unified hierarchy: type (Component), family (Plant|Mineral|...), traits (string[]).
 * @property {string} id - Unique identifier (UUID)
 * @property {string} name - Display name
 * @property {string} family - Family (Plant, Mineral, Gem, CreaturePart, Environmental)
 * @property {string[]} traits - Modifier traits (Floral, Medicinal, etc.)
 * @property {number} skillLevel - Minimum crafting skill level required (1+)
 * @property {string} rarity - Rarity level (Common, Uncommon, Rare, Very Rare, Legendary)
 * @property {string[]} biomes - Biomes where this ingredient can be found
 * @property {string} description - Flavor text description
 * @property {string|null} image - Image path or UUID
 * @property {string} source - Source compendium pack UUID
 */

/**
 * Legacy ingredient family values (pre-migration). Use FAMILIES_BY_TYPE[Component] and FAMILY_LABELS from schema-artificer-item.js for new data.
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

