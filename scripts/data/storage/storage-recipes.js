// ================================================================== 
// ===== RECIPE STORAGE =============================================
// ================================================================== 

import { MODULE } from '../../const.js';
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
     * Load recipes from configured sources: world folder and compendiums.
     * Deduplicates by core document ID (journal.id + page.id) so Compendium.X.Item.abc and Item.abc
     * are treated as the same. Load order and source filter respect recipeStorageSource.
     * @private
     * @returns {Promise<void>}
     */
    async _loadFromJournals() {
        const source = game.settings.get(MODULE.ID, 'recipeStorageSource') ?? 'compendia-then-world';
        const loadCompendia = source === 'compendia-only' || source === 'compendia-then-world' || source === 'world-then-compendia';
        const loadWorld = source === 'world-only' || source === 'compendia-then-world' || source === 'world-then-compendia';

        const journalBatches = []; // [{ uuid, isWorld }]
        if (loadWorld) {
            const folderId = game.settings.get(MODULE.ID, 'recipeJournalFolder') ?? '';
            if (folderId && game.journal) {
                for (const journal of game.journal) {
                    if (journal.folder?.id === folderId && journal.uuid) {
                        journalBatches.push({ uuid: journal.uuid, isWorld: true });
                    }
                }
            }
        }
        if (loadCompendia) {
            try {
                const num = Math.max(0, Math.min(10, parseInt(game.settings.get(MODULE.ID, 'numRecipeCompendiums'), 10) || 0));
                for (let i = 1; i <= num; i++) {
                    const cid = game.settings.get(MODULE.ID, `recipeCompendium${i}`) ?? 'none';
                    if (!cid || cid === 'none') continue;
                    const pack = game.packs.get(cid);
                    if (!pack || pack.documentName !== 'JournalEntry') continue;
                    const docs = await pack.getDocuments();
                    for (const doc of docs) {
                        if (doc?.uuid) journalBatches.push({ uuid: doc.uuid, isWorld: false });
                    }
                }
            } catch (e) {
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Recipe compendiums load error', e?.message ?? String(e), true, false);
            }
        }

        const order = source === 'world-then-compendia' ? 'world-first' : 'compendia-first';
        const worldJournals = journalBatches.filter(b => b.isWorld);
        const compendiumJournals = journalBatches.filter(b => !b.isWorld);
        const ordered = order === 'world-first'
            ? [...worldJournals, ...compendiumJournals]
            : [...compendiumJournals, ...worldJournals];

        const coreIdSeen = new Set();
        for (const { uuid } of ordered) {
            try {
                const journal = await fromUuid(uuid);
                if (!journal || journal.documentName !== 'JournalEntry') continue;
                const journalId = journal.id ?? '';
                const pages = journal.pages?.contents ?? [];
                for (const page of pages) {
                    try {
                        if (page.type !== 'text') continue;
                        const coreId = `${journalId}_${page.id ?? ''}`;
                        if (coreIdSeen.has(coreId)) continue;
                        coreIdSeen.add(coreId);
                        const rawContent = page.text?.content ?? page.text?.markdown ?? '';
                        const recipe = await RecipeParser.parseSinglePage(page, rawContent, journal);
                        if (recipe) this._cache.set(recipe.id, recipe);
                    } catch (error) {
                        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Error loading recipe from page "${page.name}"`, error?.message ?? String(error), true, false);
                    }
                }
            } catch (error) {
                BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Recipe journal "${uuid}" not found or error`, error?.message ?? String(error), true, false);
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
