// ================================================================== 
// ===== RECIPE STORAGE =============================================
// ================================================================== 

import { MODULE } from '../../const.js';
import { postDebug, postError } from '../../utils/helpers.js';
import { ArtificerRecipe } from '../models/model-recipe.js';
import { RecipeParser } from '../../parsers/parser-recipe.js';

/**
 * RecipeStorage - Manages loading recipes from journal entries
 */
export class RecipeStorage {
    constructor() {
        this._cache = new Map();
        this._initialized = false;
    }
    
    /**
     * Initialize storage - load recipes from journal
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
     * Refresh cache - reload all recipes
     * @returns {Promise<void>}
     */
    async refresh() {
        this._cache.clear();
        await this._loadFromJournals();
    }
    
    /**
     * Load recipes from journal entries
     * @private
     * @returns {Promise<void>}
     */
    async _loadFromJournals() {
        let journalUuid;
        try {
            journalUuid = game.settings.get(MODULE.ID, 'recipeJournal');
        } catch (error) {
            journalUuid = '';
        }
        if (!journalUuid) return;

        const journal = await fromUuid(journalUuid);
        if (!journal || journal.documentName !== 'JournalEntry') {
            postDebug(MODULE.NAME, `Recipe journal "${journalUuid}" not found. Recipes will not be loaded.`);
            return;
        }
        
        // Get all pages from journal
        const pages = journal.pages.contents;
        
        for (const page of pages) {
            try {
                if (page.type !== 'text') continue;
                // Use RAW content for parsing—enriched HTML turns @UUID into links, breaking regex
                const rawContent = page.text?.content ?? page.text?.markdown ?? '';
                const recipe = await RecipeParser.parseSinglePage(page, rawContent);
                if (recipe) {
                    this._cache.set(recipe.id, recipe);
                }
            } catch (error) {
                postError(MODULE.NAME, `Error loading recipe from page "${page.name}"`, error?.message ?? String(error));
            }
        }
    }
    
    /**
     * Get all recipes
     * @returns {Array<ArtificerRecipe>} All recipes
     */
    getAll() {
        return Array.from(this._cache.values());
    }
    
    /**
     * Get recipe by ID
     * @param {string} id - Recipe UUID
     * @returns {ArtificerRecipe|null} Recipe or null
     */
    getById(id) {
        return this._cache.get(id) ?? null;
    }
    
    /**
     * Get recipes by category
     * @param {string} category - Recipe category
     * @returns {Array<ArtificerRecipe>} Matching recipes
     */
    getByCategory(category) {
        return this.getAll().filter(recipe => recipe.category === category);
    }
    
    /**
     * Get recipes by type
     * @param {string} type - Item type
     * @returns {Array<ArtificerRecipe>} Matching recipes
     */
    getByType(type) {
        return this.getAll().filter(recipe => recipe.type === type);
    }
    
    /**
     * Get recipes by skill
     * @param {string} skill - Crafting skill
     * @returns {Array<ArtificerRecipe>} Matching recipes
     */
    getBySkill(skill) {
        return this.getAll().filter(recipe => recipe.skill === skill);
    }
    
    /**
     * Get recipes that actor can craft
     * @param {Actor} actor - Actor to check
     * @returns {Array<ArtificerRecipe>} Craftable recipes
     */
    getCraftableBy(actor) {
        return this.getAll().filter(recipe => {
            const canCraft = recipe.canCraft(actor);
            return canCraft.canCraft;
        });
    }
    
    /**
     * Search recipes by criteria
     * @param {Object} criteria - Search criteria
     * @param {string} criteria.category - Filter by category
     * @param {string} criteria.type - Filter by type
     * @param {string} criteria.skill - Filter by skill
     * @param {string} criteria.tag - Filter by tag
     * @param {Actor} criteria.actor - Filter by craftable by actor
     * @returns {Array<ArtificerRecipe>} Matching recipes
     */
    search(criteria = {}) {
        let results = this.getAll();
        
        if (criteria.category) {
            results = results.filter(recipe => recipe.category === criteria.category);
        }
        
        if (criteria.type) {
            results = results.filter(recipe => recipe.type === criteria.type);
        }
        
        if (criteria.skill) {
            results = results.filter(recipe => recipe.skill === criteria.skill);
        }
        
        if (criteria.tag) {
            results = results.filter(recipe => (recipe.traits || recipe.tags || []).includes(criteria.tag));
        }
        
        if (criteria.actor) {
            results = results.filter(recipe => {
                const canCraft = recipe.canCraft(criteria.actor);
                return canCraft.canCraft;
            });
        }
        
        return results;
    }
}
