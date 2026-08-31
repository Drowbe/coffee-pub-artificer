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
 * Official D&D 5e biomes/habitats (source of truth).
 * Use only these values for flags.biomes.
 *
 * MOVING TO BLACKSMITH. Scene geography takes ownership of this vocabulary and will
 * expose it as `{key, label}` pairs in lowercase. When that lands, this array is
 * replaced by their constant and `normalizeBiome` below returns lowercase without
 * another site changing -- which is the entire reason the helpers exist.
 */
export const OFFICIAL_BIOMES = [
    'MOUNTAIN', 'ARCTIC', 'PLANAR', 'COASTAL', 'SWAMP', 'DESERT',
    'UNDERDARK', 'FOREST', 'UNDERWATER', 'GRASSLAND', 'URBAN', 'HILL'
];

/** Case-folded index into OFFICIAL_BIOMES. Rebuilt with the vocabulary, not per call. */
const BIOME_BY_FOLDED = new Map(OFFICIAL_BIOMES.map((biome) => [biome.toLowerCase(), biome]));

/**
 * A biome in the vocabulary's own spelling, or null if it is not in the vocabulary.
 *
 * NEVER COMPARE STORED BIOMES DIRECTLY. Habitat is a join key -- scene habitats are
 * matched against item biome flags -- and the two sides are written by different
 * paths at different times, so a case-sensitive comparison between them fails
 * silently and partially. It does not throw and it does not empty the result: an
 * item with NO biomes stays eligible everywhere, so the join keeps returning a
 * plausible, wrong subset. Normalize on read at every edge instead. The edge is the
 * only place that cannot be stale -- item data that no migration reached still
 * arrives here, and so does a persisted cache built before the vocabulary changed.
 *
 * @param {unknown} value
 * @returns {string|null} The canonical spelling, or null.
 */
export function normalizeBiome(value) {
    if (typeof value !== 'string') return null;
    return BIOME_BY_FOLDED.get(value.trim().toLowerCase()) ?? null;
}

/** Whether a value names a biome, in any case. */
export function isOfficialBiome(value) {
    return normalizeBiome(value) !== null;
}

/**
 * A list of biomes in canonical spelling, unknown entries dropped and duplicates
 * collapsed -- two spellings of one biome must not survive as two entries.
 * @param {unknown} values
 * @returns {string[]}
 */
export function normalizeBiomeList(values) {
    if (!Array.isArray(values)) return [];
    const seen = new Set();
    for (const value of values) {
        const biome = normalizeBiome(value);
        if (biome) seen.add(biome);
    }
    return [...seen];
}

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

