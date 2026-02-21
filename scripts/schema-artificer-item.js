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
 * Derive D&D 5e item type and subtype from Artificer type + family.
 * Used by the create/edit form to automate item type (no manual selection).
 * @param {string} artificerType - ARTIFICER_TYPES value (Component | Creation | Tool)
 * @param {string} family - Family within type (e.g. Plant, Potion, Apparatus)
 * @returns {{ type: string, subtype?: string, toolType?: string }}
 */
export function deriveItemTypeFromArtificer(artificerType, family) {
    const map = {
        [ARTIFICER_TYPES.COMPONENT]: {
            Plant: { type: 'consumable', subtype: 'food' },
            CreaturePart: { type: 'consumable', subtype: 'trinket' },
            Gem: { type: 'consumable', subtype: 'trinket' },
            Mineral: { type: 'consumable', subtype: 'trinket' },
            Environmental: { type: 'consumable', subtype: 'trinket' },
            Essence: { type: 'consumable', subtype: 'trinket' }
        },
        [ARTIFICER_TYPES.CREATION]: {
            Potion: { type: 'consumable', subtype: 'potion' },
            Poison: { type: 'consumable', subtype: 'poison' },
            Food: { type: 'consumable', subtype: 'food' },
            Material: { type: 'loot', subtype: 'material' }
        },
        [ARTIFICER_TYPES.TOOL]: {
            Apparatus: { type: 'tool', toolType: '' },
            Container: { type: 'container' }
        }
    };
    const byType = map[artificerType];
    const entry = byType?.[family] ?? { type: 'consumable', subtype: 'trinket' };
    return entry;
}

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
 * Namespaced flag keys to avoid confusion with item.type, item.system, etc.
 * Readers support both namespaced (artificerX) and legacy (x) keys for backward compatibility.
 */
export const ARTIFICER_FLAG_KEYS = {
    TYPE: 'artificerType',
    FAMILY: 'artificerFamily',
    TRAITS: 'artificerTraits',
    SKILL_LEVEL: 'artificerSkillLevel',
    BIOMES: 'artificerBiomes',
    QUIRK: 'artificerQuirk',
    AFFINITY: 'artificerAffinity'
};

/**
 * @typedef {Object} ArtificerItemFlags
 * @property {string} [artificerType] - ARTIFICER_TYPES value (Component | Creation | Tool)
 * @property {string} [artificerFamily] - Family within type (e.g. Plant, Potion, Apparatus)
 * @property {string[]} [artificerTraits] - Modifier traits (do not repeat type/family)
 * @property {number} [artificerSkillLevel] - Minimum crafting skill level (1+)
 * @property {string[]} [artificerBiomes] - Biomes (components only)
 * @property {string} [artificerAffinity] - Essence Affinity (Heat|Cold|Electric|...). Essence family only.
 * @property {string} [artificerQuirk] - Optional quirk (e.g. Found in Battlefields). Components only.
 * @property {string} [type] - (legacy) Use artificerType
 * @property {string} [family] - (legacy) Use artificerFamily
 * @property {string[]} [traits] - (legacy) Use artificerTraits
 * @property {number} [skillLevel] - (legacy) Use artificerSkillLevel
 * @property {string[]} [biomes] - (legacy) Use artificerBiomes
 * @property {string} [affinity] - (legacy) Use artificerAffinity
 * @property {string} [quirk] - (legacy) Use artificerQuirk
 */
