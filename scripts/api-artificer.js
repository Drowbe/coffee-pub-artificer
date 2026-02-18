// ================================================================== 
// ===== MODULE API =================================================
// ================================================================== 

import { MODULE } from './const.js';
import { IngredientManager } from './manager-ingredients.js';
import { ComponentManager } from './manager-components.js';
import { EssenceManager } from './manager-essences.js';
import { RecipeManager } from './manager-recipes.js';
import { BlueprintManager } from './manager-blueprints.js';
import { WorkstationManager } from './manager-workstations.js';
import { SkillManager } from './manager-skills.js';
import { getTagManager } from './systems/tag-manager.js';
import { runArtificerMigration } from './migrations/migrate-artificer-flags.js';

/**
 * Module API - Public interface for external access
 */
export class ArtificerAPI {
    constructor() {
        // Initialize managers
        this.ingredients = new IngredientManager();
        this.components = new ComponentManager();
        this.essences = new EssenceManager();
        this.recipes = new RecipeManager();
        this.blueprints = new BlueprintManager();
        this.workstations = new WorkstationManager();
        this.skills = new SkillManager();
        this.tags = getTagManager();
    }

    /**
     * One-time migration: convert legacy item flags (primaryTag, secondaryTags, quirk) to TYPE > FAMILY > TRAITS.
     * Back up your world before running. Idempotent (skips items already migrated).
     * @param {Object} [options] - { includeCompendia: string[] } optional compendium pack IDs to migrate
     * @returns {Promise<{ migrated: number, errors: string[], skipped: number }>}
     */
    async runMigration(options = {}) {
        return runArtificerMigration(options);
    }

    /**
     * Initialize all managers
     * @returns {Promise<void>}
     */
    async initialize() {
        await Promise.all([
            this.ingredients.initialize(),
            this.components.initialize(),
            this.essences.initialize(),
            this.recipes.initialize(),
            this.blueprints.initialize(),
            this.workstations.initialize()
        ]);
    }
}

// Create singleton instance
let apiInstance = null;

/**
 * Get the module API instance
 * @returns {ArtificerAPI}
 */
export function getAPI() {
    if (!apiInstance) {
        apiInstance = new ArtificerAPI();
    }
    return apiInstance;
}

// Export managers for direct access if needed
export { IngredientManager, ComponentManager, EssenceManager, RecipeManager, BlueprintManager, WorkstationManager, SkillManager };

