// ================================================================== 
// ===== WORKSTATION SCHEMA DEFINITIONS =============================
// ================================================================== 

/**
 * Workstation quality modifiers
 * @typedef {Object} WorkstationModifiers
 * @property {number} qualityBonus - Quality bonus to crafting results (0-100)
 * @property {number} stabilityBonus - Stability bonus to prevent failures
 * @property {number} recipeUnlockChance - Chance multiplier for recipe discovery
 * @property {number} essenceSynergyBonus - Bonus to essence combination effects
 */

/**
 * @typedef {Object} ArtificerWorkstation
 * @property {string} id - Unique identifier (UUID)
 * @property {string} name - Workstation name
 * @property {string} type - Workstation type (Smithy, AlchemistTable, ArcaneWorkbench, Cookfire, Tinker)
 * @property {WorkstationModifiers} modifiers - Quality and effect modifiers
 * @property {string[]} requiredSkills - Required skills to use (if any)
 * @property {number|null} requiredSkillLevel - Minimum skill level (if any)
 * @property {string} description - Workstation description
 * @property {string|null} image - Image path or UUID
 * @property {string} source - Source compendium pack UUID
 */

/**
 * Workstation Types
 * @enum {string}
 */
export const WORKSTATION_TYPES = {
    SMITHY: 'Smithy',
    ALCHEMIST_TABLE: 'AlchemistTable',
    ARCANE_WORKBENCH: 'ArcaneWorkbench',
    COOKFIRE: 'Cookfire',
    TINKER: 'Tinker'
};

