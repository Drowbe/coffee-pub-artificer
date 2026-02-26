// ==================================================================
// ===== SKILLS RULES (crafting window integration) ================
// ==================================================================
// Loads resources/skills-rules.json and exposes effective crafting
// rules for a skill + learned perk IDs (tier access, DC modifier, etc.).

const SKILLS_RULES_URL = 'modules/coffee-pub-artificer/resources/skills-rules.json';
const SKILLS_DETAILS_URL = 'modules/coffee-pub-artificer/resources/skills-details.json';

/** @type {{ schemaVersion: number, skills: Record<string, { perks: Record<string, object> }> } | null } */
let _skillsRulesCache = null;

/** @type {{ skills: Array<{ id: string, name: string, perks: Array<{ perkID: string, name: string, icon?: string }> }> } | null } */
let _skillsDetailsCache = null;

/**
 * Load skills-details.json. Caches result.
 * @returns {Promise<{ skills: Array }>}
 */
async function loadSkillsDetails() {
    if (_skillsDetailsCache) return _skillsDetailsCache;
    try {
        const res = await fetch(SKILLS_DETAILS_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        _skillsDetailsCache = data;
        return data;
    } catch (e) {
        console.warn('skills-rules: Could not load skills-details.json', e);
        _skillsDetailsCache = { schemaVersion: 1, skills: [] };
        return _skillsDetailsCache;
    }
}

/**
 * Load skills-rules.json. Caches result.
 * @returns {Promise<{ schemaVersion: number, skills: Record<string, { perks: Record<string, object> }> }>}
 */
export async function loadSkillsRules() {
    if (_skillsRulesCache) return _skillsRulesCache;
    try {
        const res = await fetch(SKILLS_RULES_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        _skillsRulesCache = data;
        return data;
    } catch (e) {
        console.warn('skills-rules: Could not load skills-rules.json', e);
        _skillsRulesCache = { schemaVersion: 1, skills: {} };
        return _skillsRulesCache;
    }
}

/**
 * Normalize skill key for lookup (rules use "Herbalism"; recipe may use "Herbalism" or "herbalism").
 * @param {string} skillId
 * @param {Record<string, unknown>} skills
 * @returns {string | null}
 */
function skillKey(skillId, skills) {
    if (!skillId || !skills) return null;
    if (skills[skillId]) return skillId;
    const lower = skillId.toLowerCase();
    const firstUpper = lower.charAt(0).toUpperCase() + lower.slice(1);
    if (skills[firstUpper]) return firstUpper;
    return null;
}

/**
 * Get learned perk IDs for a given skill (perkID must start with skillId lowercase + '-').
 * @param {string[]} learnedPerkIds - All learned perk IDs for the actor
 * @param {string} skillId - Skill id (e.g. "Herbalism")
 * @returns {string[]}
 */
export function getLearnedPerkIdsForSkill(learnedPerkIds, skillId) {
    if (!skillId || !Array.isArray(learnedPerkIds)) return [];
    const prefix = skillId.toLowerCase() + '-';
    return learnedPerkIds.filter((id) => typeof id === 'string' && id.startsWith(prefix));
}

/**
 * Effective crafting rules for a skill and set of learned perk IDs (for that skill).
 * Used by the crafting window for recipe visibility, DC, and ingredient consumption.
 *
 * @param {string} skillId - Skill id (e.g. "Herbalism")
 * @param {string[]} learnedPerkIdsForSkill - Learned perk IDs that belong to this skill
 * @returns {Promise<{
 *   canViewTier: (level: number) => boolean,
 *   hasExperimental: boolean,
 *   dcModifier: number,
 *   experimentalDcModifier: number,
 *   ingredientLossOnFail: 'all' | 'half',
 *   ingredientKeptOnSuccess: undefined | 'half'
 * }>}
 */
export async function getEffectiveCraftingRules(skillId, learnedPerkIdsForSkill) {
    const { skills = {} } = await loadSkillsRules();
    const key = skillKey(skillId, skills);
    const skillRules = key ? skills[key] : null;
    const perks = skillRules?.perks ?? {};

    /** @type {Array<[number, number]>} */
    const tierRanges = [];
    let dcModifier = 0;
    let hasExperimental = false;
    let experimentalDcModifier = 0;
    let ingredientLossOnFail = 'all';
    let ingredientKeptOnSuccess = undefined;

    for (const perkId of learnedPerkIdsForSkill) {
        const rule = perks[perkId];
        if (!rule || typeof rule !== 'object') continue;

        if (Array.isArray(rule.recipeTierAccess) && rule.recipeTierAccess.length >= 2) {
            const min = Number(rule.recipeTierAccess[0]);
            const max = Number(rule.recipeTierAccess[1]);
            if (!Number.isNaN(min) && !Number.isNaN(max)) tierRanges.push([min, max]);
        }
        if (typeof rule.craftingDCModifier === 'number') {
            dcModifier += rule.craftingDCModifier;
        }
        if (rule.experimentalCrafting && rule.experimentalCrafting.allowed === true) {
            hasExperimental = true;
            if (typeof rule.experimentalCrafting.dcModifier === 'number') {
                experimentalDcModifier = rule.experimentalCrafting.dcModifier;
            }
        }
        if (rule.ingredientLossOnFail === 'half') {
            ingredientLossOnFail = 'half';
        }
        if (rule.ingredientKeptOnSuccess === 'half') {
            ingredientKeptOnSuccess = 'half';
        }
    }

    const canViewTier = (level) => {
        if (hasExperimental) return true;
        const l = Number(level);
        if (Number.isNaN(l)) return false;
        return tierRanges.some(([min, max]) => l >= min && l <= max);
    };

    return {
        canViewTier,
        hasExperimental,
        dcModifier,
        experimentalDcModifier,
        ingredientLossOnFail,
        ingredientKeptOnSuccess
    };
}

/**
 * Get the perk required to view a recipe at the given skill and tier (for locked-recipe message).
 * Returns the lowest-tier perk that grants recipeTierAccess including the given level.
 * @param {string} skillId - Skill id (e.g. "Herbalism")
 * @param {number} skillLevel - Recipe skill level
 * @returns {Promise<{ skillName: string, perkName: string, iconClass: string } | null>}
 */
export async function getRequiredPerkForTier(skillId, skillLevel) {
    const { skills: rulesSkills = {} } = await loadSkillsRules();
    const key = skillKey(skillId, rulesSkills);
    const skillRules = key ? rulesSkills[key] : null;
    const perks = skillRules?.perks ?? {};
    const level = Number(skillLevel);
    if (Number.isNaN(level)) return null;

    /** @type {Array<{ perkID: string, min: number, max: number }>} */
    const tierPerks = [];
    for (const [perkId, rule] of Object.entries(perks)) {
        if (!rule || typeof rule !== 'object' || !Array.isArray(rule.recipeTierAccess) || rule.recipeTierAccess.length < 2) continue;
        const min = Number(rule.recipeTierAccess[0]);
        const max = Number(rule.recipeTierAccess[1]);
        if (Number.isNaN(min) || Number.isNaN(max) || level < min || level > max) continue;
        tierPerks.push({ perkID: perkId, min, max });
    }
    if (tierPerks.length === 0) return null;
    tierPerks.sort((a, b) => a.min - b.min || a.max - b.max);
    const required = tierPerks[0];
    const { skills: detailsSkills = [] } = await loadSkillsDetails();
    const skillDetail = detailsSkills.find((s) => (s.id ?? '') === key || (s.id ?? '').toLowerCase() === (skillId || '').toLowerCase());
    const perkDetail = skillDetail?.perks?.find((p) => (p.perkID ?? '') === required.perkID);
    if (!perkDetail) return null;
    const skillName = skillDetail.name ?? skillId ?? '';
    const perkName = perkDetail.name ?? required.perkID ?? '';
    let iconClass = (perkDetail.icon ?? 'fa-lock').toString().trim();
    if (!iconClass.startsWith('fa-')) iconClass = `fa-${iconClass}`;
    if (!iconClass.startsWith('fa-solid ') && !iconClass.startsWith('fa-brands ')) iconClass = `fa-solid ${iconClass}`;
    return { skillName, perkName, iconClass };
}
