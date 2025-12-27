// ================================================================== 
// ===== SKILL MANAGER ==============================================
// ================================================================== 

import { MODULE } from './const.js';

/**
 * Manager for Player Skills stored in actor flags
 * Handles skill progression, XP tracking, and skill checks
 */
export class SkillManager {
    constructor() {
        // No cache needed - data stored in actor flags
    }

    /**
     * Get skill data for an actor
     * @param {Actor} actor - Actor document
     * @returns {Promise<ActorSkillData>}
     */
    async getActorSkills(actor) {
        // TODO: Phase 4 - Load from actor flags
        return {
            skills: {},
            tagDiscoveries: {},
            unlockedRecipes: [],
            blueprintProgress: {}
        };
    }

    /**
     * Get skill level for an actor
     * @param {Actor} actor - Actor document
     * @param {string} skill - Skill name
     * @returns {Promise<number>}
     */
    async getSkillLevel(actor, skill) {
        // TODO: Phase 4 - Load from actor flags
        return 0;
    }

    /**
     * Add XP to a skill for an actor
     * @param {Actor} actor - Actor document
     * @param {string} skill - Skill name
     * @param {number} xp - XP to add
     * @returns {Promise<void>}
     */
    async addSkillXP(actor, skill, xp) {
        // TODO: Phase 4 - Update actor flags
    }

    /**
     * Check if actor has required skill level
     * @param {Actor} actor - Actor document
     * @param {string} skill - Skill name
     * @param {number} requiredLevel - Required level
     * @returns {Promise<boolean>}
     */
    async hasSkillLevel(actor, skill, requiredLevel) {
        // TODO: Phase 4 - Check actor flags
        return false;
    }
}

