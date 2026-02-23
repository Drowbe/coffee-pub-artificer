// ================================================================== 
// ===== INGREDIENT STORAGE =========================================
// ================================================================== 

import { MODULE } from '../../const.js';
import { ArtificerIngredient } from '../models/model-ingredient.js';
import { getCacheStatus, getAllRecordsFromCache } from '../../cache/cache-items.js';

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
     * Refresh cache - reload all ingredients.
     * If the item cache exists (GM has clicked Refresh Cache), we populate from it and do not scan compendia.
     * If no item cache, we do not scan compendia (to avoid slow load); we only load from world when applicable, and notify the GM to build the cache.
     */
    async refresh() {
        this._cache.clear();
        const cacheStatus = getCacheStatus();
        const source = game.settings.get(MODULE.ID, 'ingredientStorageSource') ?? 'compendia-only';
        const needsCompendia = source === 'compendia-only' || source === 'compendia-then-world' || source === 'world-then-compendia';

        if (cacheStatus.hasCache && !cacheStatus.building) {
            // Use persisted records ONLY — no fromUuid/compendium hits on load
            const records = getAllRecordsFromCache();
            for (const record of records) {
                const ingredient = ArtificerIngredient.fromRecord(record);
                if (ingredient) this._cache.set(ingredient.id, ingredient);
            }
            await this._loadFromJournals();
            return;
        }

        if (needsCompendia) {
            ui.notifications?.info?.(`Artificer: Item cache not built. Open Artificer Crafting Station and click "Refresh Cache" to populate ingredients from compendiums.`, { permanent: false });
        }

        if (source === 'world-only') {
            await this._loadFromWorld();
        } else if (source === 'compendia-then-world' || source === 'world-then-compendia') {
            await this._loadFromWorld();
        }

        await this._loadFromJournals();
    }

    /**
     * Get cache key by ingredient name (for dedup when merging sources)
     * @private
     */
    _getKeyByName(name) {
        for (const [k, v] of this._cache.entries()) {
            if ((v.name ?? '').trim() === (name ?? '').trim()) return k;
        }
        return null;
    }
    
    /**
     * Load ingredients from compendium packs
     * Only loads from compendiums configured in settings
     * @private
     * @param {Function} [skipIf] - Optional: (name) => boolean; skip item if true
     * @returns {Promise<void>}
     */
    async _loadFromCompendiums(skipIf = null) {
        const configuredCompendiums = this._getConfiguredCompendiums();
        if (configuredCompendiums.length === 0) return;

        for (const compendiumId of configuredCompendiums) {
            try {
                const pack = game.packs.get(compendiumId);
                if (!pack || pack.documentName !== 'Item') continue;

                const index = pack.index;
                if (!index || index.size === 0) continue;

                const itemIds = Array.from(index.keys());
                for (const itemId of itemIds) {
                    try {
                        const item = await pack.getDocument(itemId);
                        if (!item) continue;

                        const artificerData = item.flags?.artificer ?? item.flags?.[MODULE.ID];
                        if (!artificerData || artificerData.type !== 'ingredient') continue;

                        if (skipIf?.(item.name)) continue;

                        const ingredient = ArtificerIngredient.fromItem(item);
                        if (ingredient) this._cache.set(ingredient.id, ingredient);
                    } catch {
                        continue;
                    }
                }
            } catch (error) {
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Error processing compendium "${compendiumId}"`, error?.message ?? null, true, false);
            }
        }
    }

    /**
     * Load ingredients from world items (game.items)
     * @private
     * @param {Function} [skipIf] - Optional: (name) => boolean; skip item if true
     * @returns {Promise<void>}
     */
    async _loadFromWorld(skipIf = null) {
        const items = game.items ?? [];
        for (const item of items) {
            const artificerData = item.flags?.artificer ?? item.flags?.[MODULE.ID];
            if (!artificerData || artificerData.type !== 'ingredient') continue;

            if (skipIf?.(item.name)) continue;

            const ingredient = ArtificerIngredient.fromItem(item);
            if (ingredient) this._cache.set(ingredient.id, ingredient);
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
