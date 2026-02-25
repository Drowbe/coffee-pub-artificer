// ================================================================== 
// ===== RECIPE STORAGE =============================================
// ================================================================== 

import { MODULE } from '../../const.js';
import { ArtificerRecipe } from '../models/model-recipe.js';
import { RecipeParser } from '../../parsers/parser-recipe.js';
import { buildRecipePageHtml } from '../../utility-artificer-recipe-import.js';
import { SKILL_LEVEL_MAX, CRAFTING_SKILLS } from '../../schema-recipes.js';
import { getPotionBrewingData } from '../potion-brewing-recipe-data.js';

/** JournalEntry document type for folder filtering */
const JOURNAL_TYPE = 'JournalEntry';

/**
 * Return the set of folder IDs that are the given folder or any descendant (for the given document type).
 * Used so that when "Artificer" is selected, we include journals in "Alchemist Recipes", "Herbalist Recipes", etc.
 * @param {string} folderId
 * @param {string} [documentType]
 * @returns {Set<string>}
 */
function getFolderIdAndDescendantIds(folderId, documentType = JOURNAL_TYPE) {
    const allowed = new Set([folderId]);
    if (!folderId || !game.folders) return allowed;
    const folders = game.folders.filter((f) => f.type === documentType);
    let added;
    do {
        added = 0;
        for (const f of folders) {
            if (f.folder?.id && allowed.has(f.folder.id) && !allowed.has(f.id)) {
                allowed.add(f.id);
                added++;
            }
        }
    } while (added > 0);
    return allowed;
}

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
        if (loadWorld && game.journal) {
            const journalName = (game.settings.get(MODULE.ID, 'recipeJournalName') ?? 'Artificer Recipes').trim();
            const folderId = game.settings.get(MODULE.ID, 'recipeJournalFolder') ?? '';
            for (const journal of game.journal) {
                if (!journal.uuid || (journal.name || '').trim() !== journalName) continue;
                if (folderId && journal.folder?.id !== folderId) continue;
                journalBatches.push({ uuid: journal.uuid, isWorld: true });
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

    /**
     * Clean and adjust recipe journal pages to current schema: skillKit (not Tool), no Workstation,
     * skillLevel 0–20 (scale from old 0–100 if present), valid skill, description present.
     * Only updates world journal pages in the configured recipe journal folder.
     * @param {Object} [options]
     * @param {boolean} [options.dryRun=false] - If true, do not write; only report what would be updated.
     * @returns {Promise<{ updated: number, errors: Array<{ name: string, error: string }>, skipped: number }>}
     */
    async cleanAndRewriteRecipePages(options = {}) {
        const dryRun = !!options.dryRun;
        const result = { updated: 0, errors: [], skipped: 0 };
        const journalName = (game.settings.get(MODULE.ID, 'recipeJournalName') ?? 'Artificer Recipes').trim();
        const folderId = game.settings.get(MODULE.ID, 'recipeJournalFolder') ?? '';
        if (!game.journal) {
            result.errors.push({ name: '', error: 'No journal collection available.' });
            return result;
        }
        let journals = game.journal.filter((j) => j.documentName === 'JournalEntry' && (j.name || '').trim() === journalName);
        if (folderId) {
            const allowedFolderIds = getFolderIdAndDescendantIds(folderId);
            journals = journals.filter((j) => j.folder?.id && allowedFolderIds.has(j.folder.id));
        }
        for (const journal of journals) {
            const pages = journal.pages?.contents ?? [];
            for (const page of pages) {
                if (page.type !== 'text') {
                    result.skipped++;
                    continue;
                }
                const rawContent = page.text?.content ?? page.text?.markdown ?? '';
                if (!rawContent?.trim()) {
                    result.skipped++;
                    continue;
                }
                try {
                    const recipe = await RecipeParser.parseSinglePage(page, rawContent, journal);
                    if (!recipe) {
                        result.skipped++;
                        continue;
                    }
                    // If stored skill level was in old 0–100 range, scale to 0–20
                    const skillLevelMatch = rawContent.match(/Skill Level:\s*<\/strong>\s*(\d+)/i);
                    if (skillLevelMatch) {
                        const rawNum = parseInt(skillLevelMatch[1], 10);
                        if (!isNaN(rawNum) && rawNum > SKILL_LEVEL_MAX) {
                            recipe.skillLevel = Math.min(SKILL_LEVEL_MAX, Math.max(0, Math.round((rawNum / 100) * SKILL_LEVEL_MAX)));
                        }
                    }
                    const data = recipe.serialize();
                    const html = buildRecipePageHtml(data);
                    if (!dryRun) {
                        await page.update({ text: { content: html } });
                    }
                    result.updated++;
                } catch (e) {
                    result.errors.push({
                        name: page.name ?? page.id ?? 'Unknown',
                        error: e?.message ?? String(e)
                    });
                }
            }
        }
        if (result.updated > 0 && !dryRun) {
            await this.refresh();
        }
        return result;
    }

    /**
     * RARITY → SKILLLEVEL per artificer-recipe.txt: common 0-3, uncommon 4-9, rare 10-14, very rare 15-19, legendary 20.
     * @param {string} rarity - common | uncommon | rare | very rare | legendary
     * @returns {number} skill level 0–20
     */
    static _skillLevelFromRarity(rarity) {
        const r = (rarity || '').toLowerCase().trim();
        if (r === 'common') return 1;
        if (r === 'uncommon') return 6;
        if (r === 'rare') return 12;
        if (r === 'very rare') return 17;
        if (r === 'legendary') return 20;
        return 1;
    }

    /**
     * SKILLLEVEL → SUCCESSDC per artificer-recipe.txt: 0-3→4, 4-9→8, 10-14→12, 15-19→16, 20→18.
     * @param {number} skillLevel
     * @returns {number}
     */
    static _successDCFromSkillLevel(skillLevel) {
        const n = Math.max(0, Math.min(20, Math.round(Number(skillLevel))));
        if (n <= 3) return 4;
        if (n <= 9) return 8;
        if (n <= 14) return 12;
        if (n <= 19) return 16;
        return 18;
    }

    /**
     * Apply Potion Brewing (GM Binder PDF) data to recipe journal pages: set RARITY, SKILLLEVEL, SUCCESSDC (and optionally Skill).
     * When a recipe folder is set, includes that folder and all subfolders and considers all journals in the tree (any name).
     * When no folder is set, uses the single recipe journal name. Lookup by recipe name or result name.
     * @param {Object} [options]
     * @param {boolean} [options.dryRun=false] - If true, do not write; only report what would be updated.
     * @returns {Promise<{ updated: number, skipped: number, notInData: number, skippedNames: string[], notInDataNames: string[], errors: Array<{ name: string, error: string }> }>}
     */
    async applyPotionBrewingData(options = {}) {
        const dryRun = !!options.dryRun;
        const result = { updated: 0, skipped: 0, notInData: 0, skippedNames: [], notInDataNames: [], errors: [] };
        const journalName = (game.settings.get(MODULE.ID, 'recipeJournalName') ?? 'Artificer Recipes').trim();
        const folderId = game.settings.get(MODULE.ID, 'recipeJournalFolder') ?? '';
        if (!game.journal) {
            result.errors.push({ name: '', error: 'No journal collection available.' });
            return result;
        }
        let journals;
        if (folderId) {
            const allowedFolderIds = getFolderIdAndDescendantIds(folderId);
            journals = game.journal.filter(
                (j) => j.documentName === 'JournalEntry' && j.folder?.id && allowedFolderIds.has(j.folder.id)
            );
        } else {
            journals = game.journal.filter((j) => j.documentName === 'JournalEntry' && (j.name || '').trim() === journalName);
        }
        const validSkills = new Set(Object.values(CRAFTING_SKILLS));
        for (const journal of journals) {
            const pages = journal.pages?.contents ?? [];
            for (const page of pages) {
                if (page.type !== 'text') {
                    result.skipped++;
                    result.skippedNames.push(`${page.name ?? page.id} (non-text page)`);
                    continue;
                }
                const rawContent = page.text?.content ?? page.text?.markdown ?? '';
                if (!rawContent?.trim()) {
                    result.skipped++;
                    result.skippedNames.push(`${page.name ?? page.id} (empty content)`);
                    continue;
                }
                try {
                    const recipe = await RecipeParser.parseSinglePage(page, rawContent, journal);
                    if (!recipe) {
                        result.skipped++;
                        result.skippedNames.push(`${page.name ?? page.id} (unparseable recipe)`);
                        continue;
                    }
                    const pdfData = getPotionBrewingData(recipe.name ?? '', recipe.resultItemName ?? '');
                    if (!pdfData) {
                        result.notInData++;
                        result.notInDataNames.push(recipe.name || recipe.resultItemName || page.name || page.id);
                        continue;
                    }
                    recipe.rarity = pdfData.rarity;
                    recipe.skillLevel = RecipeStorage._skillLevelFromRarity(pdfData.rarity);
                    recipe.successDC = RecipeStorage._successDCFromSkillLevel(recipe.skillLevel);
                    if (validSkills.has(pdfData.skill)) recipe.skill = pdfData.skill;
                    const data = recipe.serialize();
                    const html = buildRecipePageHtml(data);
                    if (!dryRun) {
                        await page.update({ text: { content: html } });
                    }
                    result.updated++;
                } catch (e) {
                    result.errors.push({
                        name: page.name ?? page.id ?? 'Unknown',
                        error: e?.message ?? String(e)
                    });
                }
            }
        }
        if (result.updated > 0 && !dryRun) {
            await this.refresh();
        }
        return result;
    }
}
