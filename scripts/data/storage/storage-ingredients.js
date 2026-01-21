// ================================================================== 
// ===== INGREDIENT STORAGE =========================================
// ================================================================== 

import { MODULE } from '../../const.js';
import { ArtificerIngredient } from '../models/model-ingredient.js';

/**
 * IngredientStorage - Manages loading ingredients from compendiums and journals
 * Implements hybrid storage: Compendiums for defaults, Journals for world-specific
 */
export class IngredientStorage {
    constructor() {
        this._cache = new Map();
        this._initialized = false;
    }
    
    /**
     * Initialize storage - load ingredients from all sources
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this._initialized) return;
        
        await this.refresh();
        this._initialized = true;
    }
    
    /**
     * Check if storage is initialized
     * @returns {boolean}
     */
    get isInitialized() {
        return this._initialized;
    }
    
    /**
     * Refresh cache - reload all ingredients
     * @returns {Promise<void>}
     */
    async refresh() {
        this._cache.clear();
        
        // Load from compendiums
        await this._loadFromCompendiums();
        
        // Load from journals (if configured)
        await this._loadFromJournals();
    }
    
    /**
     * Load ingredients from compendium packs
     * Only loads from compendiums configured in settings
     * @private
     * @returns {Promise<void>}
     */
    async _loadFromCompendiums() {
        // Get configured compendiums from settings
        const configuredCompendiums = this._getConfiguredCompendiums();
        
        if (configuredCompendiums.length === 0) {
            // No compendiums configured, skip loading
            return;
        }
        
        // Load from each configured compendium in priority order
        for (const compendiumId of configuredCompendiums) {
            try {
                const pack = game.packs.get(compendiumId);
                if (!pack || pack.documentName !== 'Item') {
                    continue; // Skip invalid or non-Item compendiums
                }
                
                // Use index to get item IDs without fully loading items
                const index = pack.index;
                if (!index || index.size === 0) {
                    continue; // Skip empty packs
                }
                
                // Load items individually to avoid bulk initialization errors
                const itemIds = Array.from(index.keys());
                
                for (const itemId of itemIds) {
                    try {
                        // Load individual item
                        const item = await pack.getDocument(itemId);
                        
                        if (!item) {
                            continue;
                        }
                        
                        // Check if item has artificer flags before processing
                        if (!item?.flags?.artificer) {
                            continue; // Skip items without artificer flags
                        }
                        
                        // Only process ingredients (not components or essences)
                        if (item.flags.artificer.type !== 'ingredient') {
                            continue;
                        }
                        
                        const ingredient = ArtificerIngredient.fromItem(item);
                        if (ingredient) {
                            // Store by UUID
                            this._cache.set(ingredient.id, ingredient);
                        }
                    } catch (error) {
                        // Skip items that fail to load or process
                        // This is expected for malformed items (e.g., midi-qol errors)
                        continue;
                    }
                }
            } catch (error) {
                // Error at pack level - log and continue
                console.warn(`Error processing compendium "${compendiumId}":`, error.message);
                continue;
            }
        }
    }
    
    /**
     * Get configured compendium IDs from settings (in priority order)
     * @private
     * @returns {string[]} Array of compendium IDs
     */
    _getConfiguredCompendiums() {
        const compendiums = [];
        
        // Get number of compendiums configured
        let numCompendiums = 1;
        try {
            numCompendiums = game.settings.get(MODULE.ID, 'numIngredientCompendiums') || 1;
        } catch (error) {
            // Setting not registered yet, return empty array
            return [];
        }
        
        // Get compendiums in priority order
        for (let i = 1; i <= numCompendiums; i++) {
            try {
                const compendiumId = game.settings.get(MODULE.ID, `ingredientCompendium${i}`);
                if (compendiumId && compendiumId !== 'none' && compendiumId !== '') {
                    compendiums.push(compendiumId);
                }
            } catch (error) {
                // Setting not registered yet, skip
                continue;
            }
        }
        
        return compendiums;
    }
    
    /**
     * Load ingredients from journal entries (if configured)
     * @private
     * @returns {Promise<void>}
     */
    async _loadFromJournals() {
        // TODO: If we decide to support custom ingredients in journals
        // This would parse journal entries similar to recipes/blueprints
        // For now, ingredients are only in compendiums
    }
    
    /**
     * Get all ingredients
     * @returns {Array<ArtificerIngredient>} All ingredients
     */
    getAll() {
        return Array.from(this._cache.values());
    }
    
    /**
     * Get ingredient by ID
     * @param {string} id - Ingredient UUID
     * @returns {ArtificerIngredient|null} Ingredient or null
     */
    getById(id) {
        return this._cache.get(id) ?? null;
    }
    
    /**
     * Get ingredients by family
     * @param {string} family - Ingredient family
     * @returns {Array<ArtificerIngredient>} Matching ingredients
     */
    getByFamily(family) {
        return this.getAll().filter(ing => ing.family === family);
    }
    
    /**
     * Get ingredients by tag
     * @param {string} tag - Tag to search for
     * @returns {Array<ArtificerIngredient>} Ingredients with the tag
     */
    getByTag(tag) {
        return this.getAll().filter(ing => ing.getAllTags().includes(tag));
    }
    
    /**
     * Search ingredients by criteria
     * @param {Object} criteria - Search criteria
     * @param {string} criteria.family - Filter by family
     * @param {string} criteria.tag - Filter by tag
     * @param {number} criteria.tier - Filter by tier
     * @param {string} criteria.rarity - Filter by rarity
     * @returns {Array<ArtificerIngredient>} Matching ingredients
     */
    search(criteria = {}) {
        let results = this.getAll();
        
        if (criteria.family) {
            results = results.filter(ing => ing.family === criteria.family);
        }
        
        if (criteria.tag) {
            results = results.filter(ing => ing.getAllTags().includes(criteria.tag));
        }
        
        if (criteria.tier !== undefined) {
            results = results.filter(ing => ing.tier === criteria.tier);
        }
        
        if (criteria.rarity) {
            results = results.filter(ing => ing.rarity === criteria.rarity);
        }
        
        return results;
    }
}
