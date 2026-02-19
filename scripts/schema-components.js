// ================================================================== 
// ===== COMPONENT SCHEMA DEFINITIONS ===============================
// ================================================================== 

/**
 * @typedef {Object} ArtificerComponent
 * @property {string} id - Unique identifier (UUID)
 * @property {string} name - Display name
 * @property {string} type - Component type (Metal, Alchemical, Monster, Arcane, Structural)
 * @property {string[]} tags - Component tags (Refined, Alloy, Stabilized, Binding, Reactive, Haft, Plate, etc.)
 * @property {number} skillLevel - Minimum crafting skill level required (1+)
 * @property {number} [tier] - Tier level (optional)
 * @property {string} rarity - Rarity level
 * @property {string} description - Flavor text description
 * @property {string|null} image - Image path or UUID
 * @property {string} source - Source compendium pack UUID
 */

/**
 * Component Types - Refinement/processing categories for Component-type items.
 * Describes how the material was processed or its role in crafting. Use when family is Mineral,
 * CreaturePart, Environmental, etc. (Essence family uses affinity instead.)
 *
 * - Metal: Metallic refined materials (iron bar, copper wire, steel plate)
 * - Alchemical: Chemically processed (extracts, powders, tinctures)
 * - Monster: Creature-derived (bones, scales, venom sacs)
 * - Arcane: Magically infused (enchanted crystals, resonant gems)
 * - Structural: Structural/binding materials (hafts, plates, bindings)
 *
 * @enum {string}
 */
export const COMPONENT_TYPES = {
    METAL: 'Metal',
    ALCHEMICAL: 'Alchemical',
    MONSTER: 'Monster',
    ARCANE: 'Arcane',
    STRUCTURAL: 'Structural'
};

