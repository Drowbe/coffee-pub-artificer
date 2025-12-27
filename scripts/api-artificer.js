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

