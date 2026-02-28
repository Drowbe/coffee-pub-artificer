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
import { normalizeItemsPunctuation } from './utility-artificer-item.js';
import { getEffectiveCraftingRules as getEffectiveCraftingRulesImpl, getLearnedPerkIdsForSkill } from './skills-rules.js';

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
     * Normalize typographic punctuation (curly/smart apostrophes and quotes) on world items.
     * Updates name, system.description.value, and artificer quirk/traits to straight ASCII.
     * @param {Object} [options] - { dryRun: boolean }
     * @returns {Promise<{ updated: number, skipped: number, errors: Array<{ name: string, error: string }> }>}
     */
    async normalizeItemsPunctuation(options = {}) {
        return normalizeItemsPunctuation(options);
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

    /**
     * Get effective crafting rules for a skill given all learned perk IDs (filters to that skill).
     * Used by the crafting window for recipe visibility, DC, and ingredient consumption.
     * @param {string} skillId - Skill id (e.g. "Herbalism")
     * @param {string[]} learnedPerkIds - All learned perk IDs for the actor
     * @returns {Promise<{ canViewTier: (level: number) => boolean, hasExperimental: boolean, experimentalCraftingTypes: string[], experimentalRandomComponents: number, dcModifier: number, experimentalRollBonus: number, ingredientLossOnFail: 'all'|'half', ingredientKeptOnSuccess: undefined|'half' }>}
     */
    async getEffectiveCraftingRules(skillId, learnedPerkIds) {
        const forSkill = getLearnedPerkIdsForSkill(learnedPerkIds ?? [], skillId);
        return getEffectiveCraftingRulesImpl(skillId, forSkill);
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

