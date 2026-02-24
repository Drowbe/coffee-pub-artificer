// ================================================================== 
// ===== RECIPE MANAGER =============================================
// ================================================================== 

import { MODULE } from './const.js';
import { RecipeStorage } from './data/storage/storage-recipes.js';

/**
 * Manager for Recipes stored in journal entries
 * Handles loading, parsing, and managing recipe journal entries
 */
export class RecipeManager {
    constructor() {
        this._storage = new RecipeStorage();
    }

    /**
     * Initialize the manager
     * @returns {Promise<void>}
     */
    async initialize() {
        await this._storage.initialize();
    }

    /**
     * Get all recipes
     * @returns {Array<ArtificerRecipe>}
     */
    getAll() {
        return this._storage.getAll();
    }

    /**
     * Get recipe by ID
     * @param {string} id - Recipe UUID
     * @returns {ArtificerRecipe|null}
     */
    getById(id) {
        return this._storage.getById(id);
    }

    /**
     * Get recipes by category
     * @param {string} category - Recipe category
     * @returns {Array<ArtificerRecipe>}
     */
    getByCategory(category) {
        return this._storage.getByCategory(category);
    }

    /**
     * Get recipes by type
     * @param {string} type - Item type
     * @returns {Array<ArtificerRecipe>}
     */
    getByType(type) {
        return this._storage.getByType(type);
    }

    /**
     * Get recipes by skill
     * @param {string} skill - Crafting skill
     * @returns {Array<ArtificerRecipe>}
     */
    getBySkill(skill) {
        return this._storage.getBySkill(skill);
    }

    /**
     * Get recipes that actor can craft
     * @param {Actor} actor - Actor to check
     * @returns {Array<ArtificerRecipe>}
     */
    getCraftableBy(actor) {
        return this._storage.getCraftableBy(actor);
    }

    /**
     * Search recipes by criteria
     * @param {Object} criteria - Search criteria
     * @returns {Array<ArtificerRecipe>}
     */
    search(criteria) {
        return this._storage.search(criteria);
    }

    /**
     * Refresh recipe cache
     * @returns {Promise<void>}
     */
    async refresh() {
        await this._storage.refresh();
    }

    /**
     * Clean and adjust recipe journal pages to current schema (skillKit, no workstation, skillLevel 0–20).
     * Only world journals in the configured recipe folder are updated.
     * @param {Object} [options] - { dryRun: boolean }
     * @returns {Promise<{ updated: number, errors: Array<{ name: string, error: string }>, skipped: number }>}
     */
    async cleanRecipeJournalPages(options = {}) {
        return this._storage.cleanAndRewriteRecipePages(options);
    }
}

