// ==================================================================
// ===== SKILL MANAGER ==============================================
// ==================================================================

import { MODULE } from './const.js';

const SKILLS_DETAILS_URL = 'modules/coffee-pub-artificer/resources/skills-details.json';

/** @type {{ skills: Array } | null } */
let _skillsDetailsCache = null;

/**
 * Load skills-details.json. Caches result.
 * @returns {Promise<{ skills: Array }>}
 */
async function _loadSkillsDetails() {
    if (_skillsDetailsCache) return _skillsDetailsCache;
    try {
        const res = await fetch(SKILLS_DETAILS_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        _skillsDetailsCache = data;
        return data;
    } catch (e) {
        console.warn('SkillManager: Could not load skills-details.json', e);
        _skillsDetailsCache = { schemaVersion: 1, skills: [] };
        return _skillsDetailsCache;
    }
}

const DEFAULT_POINTS = 7;

/**
 * Manager for actor skills stored in actor flags.
 * Tracks learned slots and points remaining (default 7).
 * Lazy-initializes data on first access; no migration needed.
 */
export class SkillManager {
    constructor() {
        // No cache needed - data stored in actor flags
    }

    /**
     * Ensure actor has skills data; lazy-init with defaults if missing.
     * @param {Actor} actor - Actor document
     * @returns {Promise<{ learnedSlots: string[], pointsRemaining: number }>}
     */
    async _ensureActorSkills(actor) {
        if (!actor) return { learnedSlots: [], pointsRemaining: DEFAULT_POINTS };
        const flags = actor.flags[MODULE.ID] ?? {};
        let data = flags.actorSkills ?? null;
        if (!data || !Array.isArray(data.learnedSlots) || typeof data.pointsRemaining !== 'number') {
            data = {
                learnedSlots: [],
                pointsRemaining: DEFAULT_POINTS
            };
            await actor.update({ [`flags.${MODULE.ID}.actorSkills`]: data });
        }
        return data;
    }

    /**
     * Get points remaining for an actor.
     * @param {Actor} actor - Actor document
     * @returns {Promise<number>}
     */
    async getPointsRemaining(actor) {
        const data = await this._ensureActorSkills(actor);
        return data.pointsRemaining;
    }

    /**
     * Get learned slot IDs for an actor.
     * @param {Actor} actor - Actor document
     * @returns {Promise<string[]>}
     */
    async getLearnedSlots(actor) {
        const data = await this._ensureActorSkills(actor);
        return [...(data.learnedSlots ?? [])];
    }

    /**
     * Check if actor has learned a slot.
     * @param {Actor} actor - Actor document
     * @param {string} slotID - Slot ID (e.g. herbalism-advanced-foraging)
     * @returns {Promise<boolean>}
     */
    async hasLearned(actor, slotID) {
        if (!actor || !slotID) return false;
        const learned = await this.getLearnedSlots(actor);
        return learned.includes(slotID);
    }

    /**
     * Find slot definition by slotID.
     * @param {string} slotID - Slot ID
     * @returns {Promise<{ skill: { id: string }, slot: object } | null>}
     */
    async _findSlot(slotID) {
        const { skills = [] } = await _loadSkillsDetails();
        for (const skill of skills) {
            const slots = skill.slots ?? [];
            const slot = slots.find((s) => (s.slotID ?? '') === slotID);
            if (slot) return { skill, slot };
        }
        return null;
    }

    /**
     * Find slotID for prerequisite by requirement name within the same skill.
     * @param {string} skillId - Skill ID (e.g. Herbalism)
     * @param {string} requirement - Requirement string (e.g. "Basic Foraging")
     * @returns {Promise<string | null>}
     */
    async _findPrereqSlotId(skillId, requirement) {
        if (!requirement) return null;
        const { skills = [] } = await _loadSkillsDetails();
        const skill = skills.find((s) => s.id === skillId);
        if (!skill) return null;
        const slot = (skill.slots ?? []).find((s) => s.name === requirement);
        return slot?.slotID ?? null;
    }

    /**
     * Learn a slot. Validates cost, prerequisites, and existence.
     * @param {Actor} actor - Actor document
     * @param {string} slotID - Slot ID
     * @returns {Promise<{ ok: boolean, reason?: string }>}
     */
    async learnSlot(actor, slotID) {
        if (!actor || !slotID) return { ok: false, reason: 'Actor or slotID missing' };
        const found = await this._findSlot(slotID);
        if (!found) return { ok: false, reason: `Unknown slot: ${slotID}` };
        const { slot } = found;
        const cost = slot.cost ?? 0;

        const data = await this._ensureActorSkills(actor);
        if (data.learnedSlots.includes(slotID)) return { ok: true }; // Already learned

        if (data.pointsRemaining < cost) {
            return { ok: false, reason: `Insufficient points (need ${cost}, have ${data.pointsRemaining})` };
        }

        const req = slot.requirement ?? '';
        if (req) {
            const prereqId = await this._findPrereqSlotId(found.skill.id, req);
            if (prereqId && !data.learnedSlots.includes(prereqId)) {
                return { ok: false, reason: `Prerequisite not met: ${req}` };
            }
        }

        const newLearned = [...data.learnedSlots, slotID];
        const newPoints = data.pointsRemaining - cost;
        await actor.update({
            [`flags.${MODULE.ID}.actorSkills`]: {
                learnedSlots: newLearned,
                pointsRemaining: newPoints
            }
        });
        return { ok: true };
    }

    /**
     * Unlearn a slot. Refunds points. No prerequisite check.
     * @param {Actor} actor - Actor document
     * @param {string} slotID - Slot ID
     * @returns {Promise<{ ok: boolean, reason?: string }>}
     */
    async unlearnSlot(actor, slotID) {
        if (!actor || !slotID) return { ok: false, reason: 'Actor or slotID missing' };
        const found = await this._findSlot(slotID);
        if (!found) return { ok: false, reason: `Unknown slot: ${slotID}` };
        const cost = found.slot.cost ?? 0;

        const data = await this._ensureActorSkills(actor);
        if (!data.learnedSlots.includes(slotID)) return { ok: true }; // Already unlearned

        const newLearned = data.learnedSlots.filter((id) => id !== slotID);
        const newPoints = data.pointsRemaining + cost;
        await actor.update({
            [`flags.${MODULE.ID}.actorSkills`]: {
                learnedSlots: newLearned,
                pointsRemaining: newPoints
            }
        });
        return { ok: true };
    }

    // -----------------------------------------------------------------
    // Legacy / Phase 4 stubs
    // -----------------------------------------------------------------

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

