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
     * Load recipes from all configured sources: tagged world journals, folder, and compendiums.
     * @private
     * @returns {Promise<void>}
     */
    async _loadFromJournals() {
        const journalUuids = new Set();

        // 1. Tagged world journals (flag: flags[MODULE.ID].recipeJournal === true)
        if (game.journal) {
            for (const journal of game.journal) {
                if (journal.flags?.[MODULE.ID]?.recipeJournal === true) {
                    journalUuids.add(journal.uuid);
                }
            }
        }

        // 2. Folder: all world journals in the configured folder
        try {
            const folderId = game.settings.get(MODULE.ID, 'recipeJournalFolder') ?? '';
            if (folderId && game.journal) {
                for (const journal of game.journal) {
                    if (journal.folder?.id === folderId) {
                        journalUuids.add(journal.uuid);
                    }
                }
            }
        } catch (e) {
            // ignore
        }

        // 3. Legacy single journal (if set and not already covered)
        try {
            const singleUuid = game.settings.get(MODULE.ID, 'recipeJournal') ?? '';
            if (singleUuid) journalUuids.add(singleUuid);
        } catch (e) {
            // ignore
        }

        // 4. Compendiums: JournalEntry packs, each journal in the pack
        try {
            const num = Math.max(0, Math.min(10, parseInt(game.settings.get(MODULE.ID, 'numRecipeCompendiums'), 10) || 0));
            for (let i = 1; i <= num; i++) {
                const cid = game.settings.get(MODULE.ID, `recipeCompendium${i}`) ?? 'none';
                if (!cid || cid === 'none') continue;
                const pack = game.packs.get(cid);
                if (!pack || pack.documentName !== 'JournalEntry') continue;
                const docs = await pack.getDocuments();
                for (const doc of docs) {
                    if (doc?.uuid) journalUuids.add(doc.uuid);
                }
            }
        } catch (e) {
            postDebug(MODULE.NAME, 'Recipe compendiums load error', e?.message ?? String(e));
        }

        for (const journalUuid of journalUuids) {
            try {
                const journal = await fromUuid(journalUuid);
                if (!journal || journal.documentName !== 'JournalEntry') continue;
                const pages = journal.pages?.contents ?? [];
                for (const page of pages) {
                    try {
                        if (page.type !== 'text') continue;
                        const rawContent = page.text?.content ?? page.text?.markdown ?? '';
                        const recipe = await RecipeParser.parseSinglePage(page, rawContent);
                        if (recipe) this._cache.set(recipe.id, recipe);
                    } catch (error) {
                        postError(MODULE.NAME, `Error loading recipe from page "${page.name}"`, error?.message ?? String(error));
                    }
                }
            } catch (error) {
                postDebug(MODULE.NAME, `Recipe journal "${journalUuid}" not found or error`, error?.message ?? String(error));
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
