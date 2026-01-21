// ================================================================== 
// ===== INGREDIENT MANAGER =========================================
// ================================================================== 

import { MODULE } from './const.js';
import { IngredientStorage } from './data/storage/storage-ingredients.js';

/**
 * Manager for Ingredients stored in compendium packs (FoundryVTT Items)
 * Handles loading, searching, and retrieving ingredients from compendiums
 */
export class IngredientManager {
    constructor() {
        this._storage = new IngredientStorage();
    }

    /**
     * Initialize the manager
     * @returns {Promise<void>}
     */
    async initialize() {
        await this._storage.initialize();
    }

    /**
     * Get all ingredients
     * @returns {Array<ArtificerIngredient>}
     */
    getAll() {
        return this._storage.getAll();
    }

    /**
     * Get ingredient by ID
     * @param {string} id - Ingredient ID
     * @returns {ArtificerIngredient|null}
     */
    getById(id) {
        return this._storage.getById(id);
    }

    /**
     * Get ingredients by family
     * @param {string} family - Ingredient family
     * @returns {Array<ArtificerIngredient>}
     */
    getByFamily(family) {
        return this._storage.getByFamily(family);
    }

    /**
     * Get ingredients by tag
     * @param {string} tag - Tag to search for
     * @returns {Array<ArtificerIngredient>}
     */
    getByTag(tag) {
        return this._storage.getByTag(tag);
    }

    /**
     * Search ingredients by criteria
     * @param {Object} criteria - Search criteria
     * @returns {Array<ArtificerIngredient>}
     */
    search(criteria) {
        return this._storage.search(criteria);
    }

    /**
     * Refresh ingredient cache
     * @returns {Promise<void>}
     */
    async refresh() {
        await this._storage.refresh();
    }
}

