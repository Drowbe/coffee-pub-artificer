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
 * Tracks learned perks and points remaining (default 7).
 * Lazy-initializes data on first access; migrates legacy learnedSlots → learnedPerks.
 */
export class SkillManager {
    constructor() {
        // No cache needed - data stored in actor flags
    }

    /**
     * Ensure actor has skills data; lazy-init with defaults if missing.
     * Migrates legacy learnedSlots to learnedPerks on first read.
     * @param {Actor} actor - Actor document
     * @returns {Promise<{ learnedPerks: string[], pointsRemaining: number }>}
     */
    async _ensureActorSkills(actor) {
        if (!actor) return { learnedPerks: [], pointsRemaining: DEFAULT_POINTS };
        const flags = actor.flags[MODULE.ID] ?? {};
        let data = flags.actorSkills ?? null;
        const hasNew = data && Array.isArray(data.learnedPerks) && typeof data.pointsRemaining === 'number';
        const hasLegacy = data && Array.isArray(data.learnedSlots);
        if (!hasNew) {
            if (hasLegacy) {
                data = {
                    learnedPerks: [...(data.learnedSlots ?? [])],
                    pointsRemaining: typeof data.pointsRemaining === 'number' ? data.pointsRemaining : DEFAULT_POINTS
                };
                await actor.update({ [`flags.${MODULE.ID}.actorSkills`]: data });
            } else {
                data = {
                    learnedPerks: [],
                    pointsRemaining: DEFAULT_POINTS
                };
                await actor.update({ [`flags.${MODULE.ID}.actorSkills`]: data });
            }
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
     * Get learned perk IDs for an actor.
     * @param {Actor} actor - Actor document
     * @returns {Promise<string[]>}
     */
    async getLearnedPerks(actor) {
        const data = await this._ensureActorSkills(actor);
        return [...(data.learnedPerks ?? [])];
    }

    /**
     * Check if actor has learned a perk.
     * @param {Actor} actor - Actor document
     * @param {string} perkID - Perk ID (e.g. herbalism-advanced-foraging)
     * @returns {Promise<boolean>}
     */
    async hasLearned(actor, perkID) {
        if (!actor || !perkID) return false;
        const learned = await this.getLearnedPerks(actor);
        return learned.includes(perkID);
    }

    /**
     * Find perk definition by perkID.
     * @param {string} perkID - Perk ID
     * @returns {Promise<{ skill: { id: string }, perk: object } | null>}
     */
    async _findPerk(perkID) {
        const { skills = [] } = await _loadSkillsDetails();
        for (const skill of skills) {
            const perks = skill.perks ?? [];
            const perk = perks.find((p) => (p.perkID ?? '') === perkID);
            if (perk) return { skill, perk };
        }
        return null;
    }

    /**
     * Get perkIDs that depend on this perk (i.e. have this perk as prerequisite).
     * @param {string} perkID - Perk ID
     * @returns {Promise<string[]>}
     */
    async getDependentPerkIds(perkID) {
        const found = await this._findPerk(perkID);
        if (!found) return [];
        const perkName = found.perk.name ?? '';
        if (!perkName) return [];
        const { skills = [] } = await _loadSkillsDetails();
        const dependents = [];
        for (const skill of skills) {
            for (const p of skill.perks ?? []) {
                if ((p.requirement ?? '') === perkName) {
                    const id = p.perkID ?? '';
                    if (id) dependents.push(id);
                }
            }
        }
        return dependents;
    }

    /**
     * Find perkID for prerequisite by requirement name within the same skill.
     * @param {string} skillId - Skill ID (e.g. Herbalism)
     * @param {string} requirement - Requirement string (e.g. "Basic Foraging")
     * @returns {Promise<string | null>}
     */
    async _findPrereqPerkId(skillId, requirement) {
        if (!requirement) return null;
        const { skills = [] } = await _loadSkillsDetails();
        const skill = skills.find((s) => s.id === skillId);
        if (!skill) return null;
        const perk = (skill.perks ?? []).find((p) => p.name === requirement);
        return perk?.perkID ?? null;
    }

    /**
     * Learn a perk. Validates cost, prerequisites, and existence.
     * @param {Actor} actor - Actor document
     * @param {string} perkID - Perk ID
     * @returns {Promise<{ ok: boolean, reason?: string }>}
     */
    async learnPerk(actor, perkID) {
        if (!actor || !perkID) return { ok: false, reason: 'Actor or perkID missing' };
        const found = await this._findPerk(perkID);
        if (!found) return { ok: false, reason: `Unknown perk: ${perkID}` };
        const { perk } = found;
        const cost = perk.cost ?? 0;

        const data = await this._ensureActorSkills(actor);
        if (data.learnedPerks.includes(perkID)) return { ok: true }; // Already learned

        if (data.pointsRemaining < cost) {
            return { ok: false, reason: `Insufficient points (need ${cost}, have ${data.pointsRemaining})` };
        }

        const req = perk.requirement ?? '';
        if (req) {
            const prereqId = await this._findPrereqPerkId(found.skill.id, req);
            if (prereqId && !data.learnedPerks.includes(prereqId)) {
                return { ok: false, reason: `Prerequisite not met: ${req}` };
            }
        }

        const newLearned = [...data.learnedPerks, perkID];
        const newPoints = data.pointsRemaining - cost;
        await actor.update({
            [`flags.${MODULE.ID}.actorSkills`]: {
                learnedPerks: newLearned,
                pointsRemaining: newPoints
            }
        });
        return { ok: true };
    }

    /**
     * Revoke multiple perks at once (e.g. when kit is removed). Unlearns each and refunds points.
     * @param {Actor} actor - Actor document
     * @param {string[]} perkIDs - Perk IDs to revoke
     * @returns {Promise<void>}
     */
    async revokePerks(actor, perkIDs) {
        if (!actor || !Array.isArray(perkIDs) || perkIDs.length === 0) return;
        const data = await this._ensureActorSkills(actor);
        const toRevoke = perkIDs.filter((id) => data.learnedPerks.includes(id));
        if (toRevoke.length === 0) return;
        let refund = 0;
        for (const perkID of toRevoke) {
            const found = await this._findPerk(perkID);
            if (found) refund += found.perk.cost ?? 0;
        }
        const newLearned = data.learnedPerks.filter((id) => !toRevoke.includes(id));
        const newPoints = data.pointsRemaining + refund;
        await actor.update({
            [`flags.${MODULE.ID}.actorSkills`]: {
                learnedPerks: newLearned,
                pointsRemaining: newPoints
            }
        });
    }

    /**
     * Unlearn a perk. Refunds points. No prerequisite check.
     * @param {Actor} actor - Actor document
     * @param {string} perkID - Perk ID
     * @returns {Promise<{ ok: boolean, reason?: string }>}
     */
    async unlearnPerk(actor, perkID) {
        if (!actor || !perkID) return { ok: false, reason: 'Actor or perkID missing' };
        const found = await this._findPerk(perkID);
        if (!found) return { ok: false, reason: `Unknown perk: ${perkID}` };
        const cost = found.perk.cost ?? 0;

        const data = await this._ensureActorSkills(actor);
        if (!data.learnedPerks.includes(perkID)) return { ok: true }; // Already unlearned

        const newLearned = data.learnedPerks.filter((id) => id !== perkID);
        const newPoints = data.pointsRemaining + cost;
        await actor.update({
            [`flags.${MODULE.ID}.actorSkills`]: {
                learnedPerks: newLearned,
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
