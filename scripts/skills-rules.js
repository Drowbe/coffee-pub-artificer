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
 * Get the benefits array for a perk (each benefit has title, description, rule).
 * Supports legacy shape: single { title, description, rule } treated as one benefit.
 * @param {Record<string, object>} perks - perks map for a skill
 * @param {string} perkId - perk ID
 * @returns {Array<{ title?: string, description?: string, rule: object }>}
 */
function getPerkBenefits(perks, perkId) {
    const entry = perks[perkId];
    if (!entry || typeof entry !== 'object') return [];
    if (Array.isArray(entry.benefits) && entry.benefits.length > 0) {
        return entry.benefits.map((b) => ({
            title: b.title,
            description: b.description,
            rule: b.rule != null && typeof b.rule === 'object' ? b.rule : {}
        }));
    }
    if (entry.rule !== undefined) {
        return [{ title: entry.title, description: entry.description, rule: entry.rule }];
    }
    return [];
}

/**
 * Yield each rule object from all benefits of the given learned perks (for accumulation).
 * @param {Record<string, object>} perks - perks map for a skill
 * @param {string[]} learnedPerkIdsForSkill - learned perk IDs
 * @returns {IterableIterator<object>}
 */
function* iterateRulesFromPerks(perks, learnedPerkIdsForSkill) {
    for (const perkId of learnedPerkIdsForSkill) {
        for (const benefit of getPerkBenefits(perks, perkId)) {
            if (benefit.rule && typeof benefit.rule === 'object') yield benefit.rule;
        }
    }
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
 * Get component skill level ranges the actor can gather (from componentSkillAccess in perks).
 * Used when picking components on a successful gather: only components whose skill level
 * is 0 or within one of these ranges are eligible. Actors can always get level 0 components.
 *
 * @param {string} skillId - Skill id (e.g. "Herbalism")
 * @param {string[]} learnedPerkIdsForSkill - Learned perk IDs that belong to this skill
 * @returns {Promise<Array<[number, number]>>} Array of [min, max] inclusive ranges (e.g. [[0, 3], [4, 9]])
 */
export async function getEffectiveComponentSkillAccess(skillId, learnedPerkIdsForSkill) {
    const { skills = {} } = await loadSkillsRules();
    const key = skillKey(skillId, skills);
    const skillRules = key ? skills[key] : null;
    const perks = skillRules?.perks ?? {};
    const ranges = [];
    for (const rule of iterateRulesFromPerks(perks, learnedPerkIdsForSkill)) {
        if (Array.isArray(rule.componentSkillAccess) && rule.componentSkillAccess.length >= 2) {
            const min = Number(rule.componentSkillAccess[0]);
            const max = Number(rule.componentSkillAccess[1]);
            if (!Number.isNaN(min) && !Number.isNaN(max)) ranges.push([min, max]);
        }
    }
    return ranges;
}

/**
 * Effective gathering/harvesting rules for a skill and set of learned perk IDs.
 * Used by Roll for Components: roll bonus (summed) and yield multiplier (max).
 *
 * @param {string} skillId - Skill id (e.g. "Herbalism")
 * @param {string[]} learnedPerkIdsForSkill - Learned perk IDs that belong to this skill
 * @returns {Promise<{ gatheringRollBonus: number, gatheringYieldMultiplier: number }>}
 */
export async function getEffectiveGatheringRules(skillId, learnedPerkIdsForSkill) {
    const { skills = {} } = await loadSkillsRules();
    const key = skillKey(skillId, skills);
    const skillRules = key ? skills[key] : null;
    const perks = skillRules?.perks ?? {};
    let gatheringRollBonus = 0;
    let gatheringYieldMultiplier = 1;
    for (const rule of iterateRulesFromPerks(perks, learnedPerkIdsForSkill)) {
        if (typeof rule.gatheringRollBonus === 'number') gatheringRollBonus += rule.gatheringRollBonus;
        if (typeof rule.gatheringYieldMultiplier === 'number' && rule.gatheringYieldMultiplier > gatheringYieldMultiplier) {
            gatheringYieldMultiplier = rule.gatheringYieldMultiplier;
        }
    }
    return { gatheringRollBonus, gatheringYieldMultiplier };
}

/**
 * Get human-readable list of perks (and benefits) that apply to gathering for chat display.
 * Only includes benefits whose rule has gatheringRollBonus or gatheringYieldMultiplier.
 *
 * @param {string} skillId - Skill id (e.g. "Herbalism")
 * @param {string[]} learnedPerkIdsForSkill - Learned perk IDs that belong to this skill
 * @returns {Promise<Array<{ perkTitle: string, benefitTitle: string, description: string }>>}
 */
export async function getAppliedGatheringPerksForDisplay(skillId, learnedPerkIdsForSkill) {
    const { skills = {} } = await loadSkillsRules();
    const key = skillKey(skillId, skills);
    const skillRules = key ? skills[key] : null;
    const perks = skillRules?.perks ?? {};
    const out = [];
    for (const perkId of learnedPerkIdsForSkill) {
        const entry = perks[perkId];
        if (!entry || typeof entry !== 'object') continue;
        const perkTitle = entry.title ?? perkId;
        for (const benefit of getPerkBenefits(perks, perkId)) {
            const rule = benefit.rule;
            if (!rule || typeof rule !== 'object') continue;
            const hasGathering = typeof rule.gatheringRollBonus === 'number' || typeof rule.gatheringYieldMultiplier === 'number';
            if (!hasGathering) continue;
            out.push({
                perkTitle: String(perkTitle ?? ''),
                benefitTitle: String(benefit.title ?? ''),
                description: String(benefit.description ?? '')
            });
        }
    }
    return out;
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

    for (const rule of iterateRulesFromPerks(perks, learnedPerkIdsForSkill)) {
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
    for (const perkId of Object.keys(perks)) {
        for (const benefit of getPerkBenefits(perks, perkId)) {
            const rule = benefit.rule;
            if (!rule || typeof rule !== 'object' || !Array.isArray(rule.recipeTierAccess) || rule.recipeTierAccess.length < 2) continue;
            const min = Number(rule.recipeTierAccess[0]);
            const max = Number(rule.recipeTierAccess[1]);
            if (Number.isNaN(min) || Number.isNaN(max) || level < min || level > max) continue;
            tierPerks.push({ perkID: perkId, min, max });
        }
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

/**
 * Get human-readable list of perks that will apply when crafting this recipe (for Details pane).
 * @param {string} skillId - Recipe skill (e.g. "Herbalism")
 * @param {string[]} learnedPerkIdsForSkill - Actor's learned perk IDs for this skill
 * @param {number} recipeSkillLevel - Recipe's skillLevel
 * @returns {Promise<Array<{ perkName: string, effect: string }>>}
 */
export async function getAppliedPerksForCraft(skillId, learnedPerkIdsForSkill, recipeSkillLevel) {
    const rules = await getEffectiveCraftingRules(skillId, learnedPerkIdsForSkill);
    const level = Number(recipeSkillLevel);
    const withinTier = !Number.isNaN(level) && rules.canViewTier(level);
    const isExperimental = rules.hasExperimental && !withinTier;

    const { skills: detailsSkills = [] } = await loadSkillsDetails();
    const key = skillKey(skillId, (await loadSkillsRules()).skills ?? {});
    const skillDetail = detailsSkills.find((s) => (s.id ?? '') === key || (s.id ?? '').toLowerCase() === (skillId || '').toLowerCase());
    const perkNameById = /** @type {Map<string, string>} */ (new Map());
    if (skillDetail?.perks) {
        for (const p of skillDetail.perks) {
            const id = p.perkID ?? '';
            if (id) perkNameById.set(id, p.name ?? id);
        }
    }

    /** @type {Array<{ perkName: string, effect: string }>} */
    const out = [];
    const { skills = {} } = await loadSkillsRules();
    const skillRules = key ? skills[key] : null;
    const perks = skillRules?.perks ?? {};

    /** @type {Map<string, string[]>} */
    const effectsByPerk = new Map();

    for (const perkId of learnedPerkIdsForSkill) {
        const perkName = perkNameById.get(perkId) ?? perkId;
        if (!effectsByPerk.has(perkName)) effectsByPerk.set(perkName, []);

        for (const benefit of getPerkBenefits(perks, perkId)) {
            const rule = benefit.rule;
            if (!rule || typeof rule !== 'object') continue;

            if (typeof rule.craftingDCModifier === 'number' && rule.craftingDCModifier !== 0 && withinTier) {
                const sign = rule.craftingDCModifier >= 0 ? '+' : '';
                effectsByPerk.get(perkName).push(`${sign}${rule.craftingDCModifier} DC when within tier`);
            }
            if (rule.ingredientLossOnFail === 'half') {
                effectsByPerk.get(perkName).push('On failure: lose only half the ingredients');
            }
            if (rule.ingredientKeptOnSuccess === 'half') {
                effectsByPerk.get(perkName).push('On success: keep half the ingredients');
            }
            if (rule.experimentalCrafting?.allowed && typeof rule.experimentalCrafting.dcModifier === 'number' && rule.experimentalCrafting.dcModifier !== 0 && isExperimental) {
                const sign = rule.experimentalCrafting.dcModifier >= 0 ? '+' : '';
                effectsByPerk.get(perkName).push(`${sign}${rule.experimentalCrafting.dcModifier} DC (experimental attempt)`);
            }
        }
    }

    for (const [name, effects] of effectsByPerk) {
        if (effects.length) out.push({ perkName: name, effect: effects.join('; ') });
    }
    return out;
}
