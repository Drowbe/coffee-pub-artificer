// ================================================================== 
// ===== BLUEPRINT MANAGER ==========================================
// ================================================================== 

import { MODULE } from './const.js';
import { BlueprintStorage } from './data/storage/storage-blueprints.js';

/**
 * Manager for Blueprints stored in journal entries
 * Handles loading, parsing, and managing blueprint journal entries
 */
export class BlueprintManager {
    constructor() {
        this._storage = new BlueprintStorage();
    }

    /**
     * Initialize the manager
     * @returns {Promise<void>}
     */
    async initialize() {
        await this._storage.initialize();
    }

    /**
     * Get all blueprints
     * @returns {Array<ArtificerBlueprint>}
     */
    getAll() {
        return this._storage.getAll();
    }

    /**
     * Get blueprint by ID
     * @param {string} id - Blueprint UUID
     * @returns {ArtificerBlueprint|null}
     */
    getById(id) {
        return this._storage.getById(id);
    }

    /**
     * Get blueprints by status for actor
     * @param {Actor} actor - Actor to check
     * @param {string} status - Status: 'available', 'locked', 'in_progress', 'completed'
     * @returns {Array<ArtificerBlueprint>}
     */
    getByStatus(actor, status) {
        return this._storage.getByStatus(actor, status);
    }

    /**
     * Get blueprint progress for an actor
     * @param {string} blueprintId - Blueprint UUID
     * @param {Actor} actor - Actor document
     * @returns {Object|null}
     */
    getProgress(blueprintId, actor) {
        return this._storage.getProgress(blueprintId, actor);
    }

    /**
     * Search blueprints by criteria
     * @param {Object} criteria - Search criteria
     * @returns {Array<ArtificerBlueprint>}
     */
    search(criteria) {
        return this._storage.search(criteria);
    }

    /**
     * Refresh blueprint cache
     * @returns {Promise<void>}
     */
    async refresh() {
        await this._storage.refresh();
    }
}

