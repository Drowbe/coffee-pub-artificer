// ================================================================== 
// ===== BLUEPRINT STORAGE ==========================================
// ================================================================== 

import { MODULE } from '../../const.js';
import { ArtificerBlueprint } from '../models/model-blueprint.js';
import { BlueprintParser } from '../../parsers/parser-blueprint.js';

/**
 * BlueprintStorage - Manages loading blueprints from journal entries
 */
export class BlueprintStorage {
    constructor() {
        this._cache = new Map();
        this._initialized = false;
    }
    
    /**
     * Initialize storage - load blueprints from journal
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
     * Refresh cache - reload all blueprints
     * @returns {Promise<void>}
     */
    async refresh() {
        this._cache.clear();
        await this._loadFromJournals();
    }
    
    /**
     * Load blueprints from journal entries
     * @private
     * @returns {Promise<void>}
     */
    async _loadFromJournals() {
        let journalUuid;
        try {
            journalUuid = game.settings.get(MODULE.ID, 'blueprintJournal');
        } catch (error) {
            journalUuid = '';
        }
        if (!journalUuid) return;

        const journal = await fromUuid(journalUuid);
        if (!journal || journal.documentName !== 'JournalEntry') {
            console.warn(`Blueprint journal "${journalUuid}" not found. Blueprints will not be loaded.`);
            return;
        }
        
        // Get all pages from journal
        const pages = journal.pages.contents;
        
        for (const page of pages) {
            try {
                // Enrich HTML content (handles @UUID links, etc.)
                const enrichedHtml = await TextEditor.enrichHTML(page.text.content, {
                    async: true,
                    relativeTo: journal
                });
                
                // Parse blueprint from page
                const blueprint = await BlueprintParser.parseSinglePage(page, enrichedHtml);
                if (blueprint) {
                    this._cache.set(blueprint.id, blueprint);
                }
            } catch (error) {
                console.error(`Error loading blueprint from page "${page.name}":`, error);
            }
        }
    }
    
    /**
     * Get all blueprints
     * @returns {Array<ArtificerBlueprint>} All blueprints
     */
    getAll() {
        return Array.from(this._cache.values());
    }
    
    /**
     * Get blueprint by ID
     * @param {string} id - Blueprint UUID
     * @returns {ArtificerBlueprint|null} Blueprint or null
     */
    getById(id) {
        return this._cache.get(id) ?? null;
    }
    
    /**
     * Get blueprints by status for actor
     * @param {Actor} actor - Actor to check
     * @param {string} status - Status: 'available', 'locked', 'in_progress', 'completed'
     * @returns {Array<ArtificerBlueprint>} Matching blueprints
     */
    getByStatus(actor, status) {
        const all = this.getAll();
        
        switch (status) {
            case 'available':
                return all.filter(bp => {
                    const stageStatus = bp.getStageStatus(actor, 0);
                    return stageStatus.available;
                });
            
            case 'locked':
                return all.filter(bp => {
                    const stageStatus = bp.getStageStatus(actor, 0);
                    return !stageStatus.available && stageStatus.state !== 'completed';
                });
            
            case 'in_progress':
                return all.filter(bp => {
                    const progress = bp.getActorProgress(actor);
                    const hasCompleted = progress.stages.some(s => s.state === 'completed');
                    const hasActive = progress.stages.some(s => s.state === 'active' && s.stageNumber > 0);
                    return hasCompleted && hasActive;
                });
            
            case 'completed':
                return all.filter(bp => {
                    const progress = bp.getActorProgress(actor);
                    const lastStage = bp.stages[bp.stages.length - 1];
                    const lastStageProgress = progress.stages[lastStage.stageNumber - 1];
                    return lastStageProgress?.state === 'completed';
                });
            
            default:
                return all;
        }
    }
    
    /**
     * Get blueprint progress for actor
     * @param {string} blueprintId - Blueprint UUID
     * @param {Actor} actor - Actor document
     * @returns {Object|null} Progress data or null
     */
    getProgress(blueprintId, actor) {
        const blueprint = this.getById(blueprintId);
        if (!blueprint) return null;
        
        return blueprint.getActorProgress(actor);
    }
    
    /**
     * Search blueprints by criteria
     * @param {Object} criteria - Search criteria
     * @param {string} criteria.tag - Filter by tag
     * @param {string} criteria.skill - Filter by skill
     * @param {Actor} criteria.actor - Filter by status for actor
     * @param {string} criteria.status - Status filter (if actor provided)
     * @returns {Array<ArtificerBlueprint>} Matching blueprints
     */
    search(criteria = {}) {
        let results = this.getAll();
        
        if (criteria.tag) {
            results = results.filter(bp => bp.tags.includes(criteria.tag));
        }
        
        if (criteria.skill) {
            results = results.filter(bp => bp.skill === criteria.skill);
        }
        
        if (criteria.actor && criteria.status) {
            results = this.getByStatus(criteria.actor, criteria.status);
        }
        
        return results;
    }
}
