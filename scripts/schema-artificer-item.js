// ==================================================================
// ===== UNIFIED ARTIFICER ITEM SCHEMA (TYPE > FAMILY > TRAITS) =====
// ==================================================================

/**
 * Top-level Artificer item type.
 * @enum {string}
 */
export const ARTIFICER_TYPES = {
    COMPONENT: 'Component',
    CREATION: 'Creation',
    TOOL: 'Tool'
};

/**
 * Families per TYPE. Family is the identity within the type.
 * Display labels (e.g. "Creature Part") may differ from value (e.g. "CreaturePart").
 */
export const FAMILIES_BY_TYPE = {
    [ARTIFICER_TYPES.COMPONENT]: [
        'CreaturePart',
        'Environmental',
        'Essence',
        'Gem',
        'Mineral',
        'Plant'
    ],
    [ARTIFICER_TYPES.CREATION]: [
        'Food',
        'Material',
        'Poison',
        'Potion'
    ],
    [ARTIFICER_TYPES.TOOL]: [
        'Apparatus',
        'Container'
    ]
};

/** Human-readable family labels (for UI). */
export const FAMILY_LABELS = {
    CreaturePart: 'Creature Part',
    Environmental: 'Environmental',
    Essence: 'Essence',
    Gem: 'Gem',
    Mineral: 'Mineral',
    Plant: 'Plant',
    Food: 'Food',
    Material: 'Material',
    Poison: 'Poison',
    Potion: 'Potion',
    Apparatus: 'Apparatus',
    Container: 'Container'
};

/**
 * Legacy item type (pre-migration) to ARTIFICER_TYPES.
 */
export const LEGACY_TYPE_TO_ARTIFICER_TYPE = {
    ingredient: 'Component',
    component: 'Component',
    essence: 'Component',
    apparatus: 'Tool',
    container: 'Tool',
    resultContainer: 'Tool',
    tool: 'Tool'
};

/**
 * Legacy family values (e.g. from INGREDIENT_FAMILIES) to new family value.
 */
export const LEGACY_FAMILY_TO_FAMILY = {
    Herbs: 'Plant',
    Minerals: 'Mineral',
    Gems: 'Gem',
    CreatureParts: 'CreaturePart',
    Environmental: 'Environmental'
};

/**
 * @typedef {Object} ArtificerItemFlags
 * @property {string} type - ARTIFICER_TYPES value (Component | Creation | Tool)
 * @property {string} family - Family within type (e.g. Plant, Potion, Apparatus)
 * @property {string[]} traits - Modifier traits (do not repeat type/family)
 * @property {number} skillLevel - Minimum crafting skill level (1+)
 * @property {string} [rarity] - Rarity
 * @property {string[]} [biomes] - Biomes (components)
 * @property {string} [componentType] - Metal|Alchemical|Monster|Arcane|Structural (optional, for Component)
 * @property {string} [affinity] - Essence affinity (optional, for Essence family)
 */
