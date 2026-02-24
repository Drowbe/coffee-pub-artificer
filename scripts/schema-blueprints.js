// ================================================================== 
// ===== BLUEPRINT SCHEMA DEFINITIONS ===============================
// ================================================================== 

/**
 * Blueprint stage requirement
 * @typedef {Object} BlueprintStageRequirement
 * @property {string} type - Type: 'ingredient', 'component', or 'essence'
 * @property {string} name - Name reference
 * @property {number} quantity - Required quantity
 */

/**
 * Blueprint stage
 * @typedef {Object} BlueprintStage
 * @property {number} stageNumber - Stage number (1, 2, 3, etc.)
 * @property {string} name - Stage name/description
 * @property {string} state - Stage state: 'active', 'completed', 'failed', 'hidden'
 * @property {BlueprintStageRequirement[]} requirements - Required materials
 * @property {string} description - Stage description/instructions
 */

/**
 * @typedef {Object} ArtificerBlueprint
 * @property {string} id - Unique identifier (UUID)
 * @property {string} name - Blueprint name
 * @property {string} narrative - Narrative hook/story element
 * @property {string} skill - Required skill (see CRAFTING_SKILLS in schema-recipes.js)
 * @property {number} skillLevel - Minimum skill level required (0–20). Default 1.
 * @property {BlueprintStage[]} stages - Multi-stage requirements
 * @property {string} resultItemUuid - UUID of resulting item (Item document UUID)
 * @property {string[]} tags - Blueprint tags
 * @property {string} description - Blueprint description
 * @property {string} source - Source journal UUID
 * @property {string} journalPageId - Journal page ID within source journal
 */

/**
 * Blueprint Stage States
 * @enum {string}
 */
export const BLUEPRINT_STAGE_STATES = {
    ACTIVE: 'active',
    COMPLETED: 'completed',
    FAILED: 'failed',
    HIDDEN: 'hidden'
};

