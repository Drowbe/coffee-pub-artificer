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
 * The environment vocabulary, as `{key, label}` pairs.
 *
 * OWNED BY BLACKSMITH. `api.geography.ENVIRONMENTS` is the source of truth; this array
 * is only the fallback for a Blacksmith too old to have it. The two differ in CASE --
 * theirs is lowercase -- which is safe precisely because nothing compares a stored
 * biome directly any more. Every read goes through `normalizeBiome`, so a world that
 * upgrades Blacksmith mid-campaign flips canonical form and its existing uppercase
 * data still resolves.
 *
 * DELETE THIS FALLBACK once a Blacksmith version floor is declared in module.json.
 * Carrying two canonical forms indefinitely is the cost of not having one.
 */
const FALLBACK_ENVIRONMENTS = Object.freeze([
    { key: 'MOUNTAIN', label: 'Mountain' },
    { key: 'ARCTIC', label: 'Arctic' },
    { key: 'PLANAR', label: 'Planar' },
    { key: 'COASTAL', label: 'Coastal' },
    { key: 'SWAMP', label: 'Swamp' },
    { key: 'DESERT', label: 'Desert' },
    { key: 'UNDERDARK', label: 'Underdark' },
    { key: 'FOREST', label: 'Forest' },
    { key: 'UNDERWATER', label: 'Underwater' },
    { key: 'GRASSLAND', label: 'Grassland' },
    { key: 'URBAN', label: 'Urban' },
    { key: 'HILL', label: 'Hill' }
]);

/** Blacksmith's vocabulary, or null when unavailable. Never throws; we are a consumer. */
function blacksmithEnvironments() {
    const environments = game?.modules?.get('coffee-pub-blacksmith')?.api?.geography?.ENVIRONMENTS;
    return Array.isArray(environments) && environments.length ? environments : null;
}

// Index cache, keyed on the SOURCE ARRAY IDENTITY rather than a boolean. Blacksmith's
// api is not present at module evaluation, so the first call in a session legitimately
// resolves to the fallback and a later one to theirs -- caching a "did we check yet"
// flag would pin whichever answer came first.
let _cachedSource = null;
let _cachedIndex = null;

function vocabulary() {
    const source = blacksmithEnvironments() ?? FALLBACK_ENVIRONMENTS;
    if (_cachedSource !== source) {
        _cachedSource = source;
        _cachedIndex = new Map(source.map((entry) => [String(entry.key).toLowerCase(), entry]));
    }
    return { source, index: _cachedIndex };
}

/**
 * The environment vocabulary as `{key, label}` pairs, in declaration order.
 *
 * A FUNCTION, NOT A CONST, and that is the whole point. `game` does not exist when this
 * module is evaluated, so a module-scope constant derived from the API would capture the
 * fallback permanently. Anything that needs the vocabulary at module scope -- an importer
 * declaration's `values` list, for instance -- must resolve it at `ready` instead.
 *
 * @returns {ReadonlyArray<{key: string, label: string}>}
 */
export function getBiomeVocabulary() {
    return vocabulary().source;
}

/** Just the keys, for a `values` list or a membership check. Resolve at `ready`. */
export function getBiomeKeys() {
    return vocabulary().source.map((entry) => entry.key);
}

/** The display label for a biome, or null when it is not in the vocabulary. */
export function getBiomeLabel(value) {
    const entry = vocabulary().index.get(String(value ?? '').trim().toLowerCase());
    return entry ? entry.label : null;
}

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
    const entry = vocabulary().index.get(value.trim().toLowerCase());
    return entry ? entry.key : null;
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

