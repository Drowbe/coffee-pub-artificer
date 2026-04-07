// ==================================================================
// ===== SKILLS RULES (crafting window integration) ================
// ==================================================================
// Loads the configured skills ruleset JSON (default: resources/skills-mapping.json)
// and derives crafting/gathering rules from each perk's optional rules.benefits.

import { MODULE } from './const.js';
import { postBlacksmithConsole } from './utils/blacksmith-console.js';
import { getSkillsRulesetFetchUrl, getSkillsRulesetPath } from './config-rulesets.js';

/** @type {{ schemaVersion: number, skills: Record<string, { perks: Record<string, object> }> } | null } */
let _skillsRulesCache = null;

/** @type {{ skills: Array<{ id: string, name: string, perks: Array<{ perkID: string, name: string, icon?: string, rules?: { benefits: Array } }> }> } | null } */
let _skillsDetailsCache = null;

/** @type {Promise<object>|null} */
let _skillsDetailsPromise = null;

/** Last successful load: enabled skill ids in JSON order (for sync fallbacks after first load). */
let _lastKnownEnabledCraftingSkillIds = null;

let _skillsRulesetErrorReported = false;

function _reportSkillsRulesetFailure(configPath, detail) {
    if (_skillsRulesetErrorReported) return;
    _skillsRulesetErrorReported = true;
    const title = `${MODULE.TITLE}: Skills ruleset failed`;
    const body = `Configured path: ${configPath}\n${detail}\n\nFix the file or update **Skills Ruleset JSON** in module settings, then change the setting or reload to retry.`;
    console.error(title, detail);
    const canBsLog =
        !!game.modules.get('coffee-pub-blacksmith')?.api?.utils?.postConsoleAndNotification ||
        !!globalThis.BlacksmithUtils?.postConsoleAndNotification;
    postBlacksmithConsole(MODULE.NAME, title, body, true, !!game.user?.isGM);
    if (!canBsLog && game.user?.isGM && typeof ui !== 'undefined') {
        ui.notifications?.error?.(`${title}. ${detail}`);
    }
}

/**
 * Enabled crafting skill ids from a loaded details document (JSON order).
 * @param {object} details
 * @returns {string[]}
 */
export function extractEnabledSkillIds(details) {
    return (details?.skills ?? [])
        .filter((s) => s && s.id && s.skillEnabled !== false)
        .map((s) => String(s.id).trim())
        .filter(Boolean);
}

/**
 * Crafting-kit display names from enabled skills: each skill's `skillKit` plus optional `extraKitNames`.
 * Used by the crafting window to recognize tool rows without a hardcoded kit list.
 * @param {object} details - Root document from skills mapping JSON
 * @returns {Set<string>}
 */
export function buildCraftingKitNameSet(details) {
    const set = new Set();
    for (const s of details?.skills ?? []) {
        if (!s || s.skillEnabled === false) continue;
        const k = String(s.skillKit ?? '').trim();
        if (k) set.add(k);
        const extras = s.extraKitNames;
        if (!Array.isArray(extras)) continue;
        for (const x of extras) {
            const n = String(x ?? '').trim();
            if (n) set.add(n);
        }
    }
    return set;
}

/**
 * Resolve gather UI / scene defaults from skills mapping + optional `gatherDefaults` block.
 * @param {object} details - Root document from skills mapping JSON
 * @returns {{ singleSkillIds: string[], gatherWindowSkillIds: string[], dc: number, harvestingSkillIds: string[] }}
 */
export function resolveGatherDefaults(details) {
    const enabled = extractEnabledSkillIds(details);
    const gd = details?.gatherDefaults ?? {};
    const clean = (arr) => (Array.isArray(arr) ? arr.map((s) => String(s).trim()).filter(Boolean) : []);

    const single = clean(gd.singleSkillIds).length ? clean(gd.singleSkillIds) : enabled.length ? [enabled[0]] : [];

    let windowSkills = clean(gd.gatherWindowSkillIds);
    if (!windowSkills.length) {
        windowSkills = enabled.slice(0, Math.min(2, Math.max(1, enabled.length)));
    }

    const dcRaw = Number(gd.dc);
    const dc = Number.isFinite(dcRaw) ? Math.max(1, Math.min(30, Math.floor(dcRaw))) : 10;

    let harvesting = clean(gd.harvestingSkillIds);
    if (!harvesting.length) {
        harvesting = [...enabled];
    }

    return {
        singleSkillIds: single,
        gatherWindowSkillIds: windowSkills.length ? windowSkills : [...single],
        dc,
        harvestingSkillIds: harvesting.length ? harvesting : [...single]
    };
}

/**
 * After a successful skills load, returns cached enabled ids; otherwise null.
 * @returns {string[]|null}
 */
export function getLastKnownEnabledCraftingSkillIds() {
    return _lastKnownEnabledCraftingSkillIds ? [..._lastKnownEnabledCraftingSkillIds] : null;
}

/**
 * Sync fallback for recipe/blueprint models before the first successful skills load.
 * After load, prefers first enabled id from the mapping.
 * @returns {string}
 */
export function getSyncFallbackRecipeSkillId() {
    if (_lastKnownEnabledCraftingSkillIds?.length) return _lastKnownEnabledCraftingSkillIds[0];
    return 'Alchemy';
}

/**
 * All enabled crafting skill ids from the configured mapping (async).
 * @returns {Promise<string[]>}
 */
export async function getEnabledCraftingSkillIds() {
    const d = await loadSkillsDetails();
    return extractEnabledSkillIds(d);
}

/**
 * Build the rules lookup (skillId -> perks -> perkID -> { title, benefits }) from skills mapping JSON.
 * Used so existing code that expects loadSkillsRules() to return that shape continues to work.
 * @param {{ skills: Array }} details
 * @returns {{ schemaVersion: number, skills: Record<string, { perks: Record<string, object> }> }}
 */
function buildRulesFromDetails(details) {
    const skills = details?.skills ?? [];
    const out = { schemaVersion: 1, skills: {} };
    for (const skill of skills) {
        const skillId = skill?.id;
        if (!skillId || !skill.perks) continue;
        const perksMap = {};
        for (const perk of skill.perks) {
            const perkID = perk?.perkID;
            const benefits = perk?.rules?.benefits;
            if (!perkID) continue;
            if (!Array.isArray(benefits) || benefits.length === 0) {
                perksMap[perkID] = { title: perk.name ?? perkID, benefits: [] };
                continue;
            }
            perksMap[perkID] = {
                title: perk.name ?? perkID,
                benefits: benefits.map((b) => ({
                    title: b.title,
                    description: b.description,
                    rule: b.rule != null && typeof b.rule === 'object' ? b.rule : {}
                }))
            };
        }
        if (Object.keys(perksMap).length) out.skills[skillId] = { perks: perksMap };
    }
    return out;
}

/** Drop cached skills JSON and derived rules (e.g. after settings change). */
export function invalidateSkillsRulesCaches() {
    _skillsDetailsPromise = null;
    _skillsDetailsCache = null;
    _skillsRulesCache = null;
    _lastKnownEnabledCraftingSkillIds = null;
    _skillsRulesetErrorReported = false;
}

/**
 * Load and parse skills mapping JSON. No silent fallback — throws after GM notification.
 * @returns {Promise<object>}
 */
async function _loadSkillsDocument() {
    const configPath = getSkillsRulesetPath();
    const url = getSkillsRulesetFetchUrl();
    if (!url) {
        const msg = 'Could not resolve a URL for the skills ruleset (empty path?).';
        _reportSkillsRulesetFailure(configPath, msg);
        throw new Error(msg);
    }
    let res;
    try {
        res = await fetch(url, { cache: 'no-store' });
    } catch (e) {
        const msg = `Network error while loading: ${e?.message ?? String(e)}`;
        _reportSkillsRulesetFailure(configPath, msg);
        throw e;
    }
    if (!res.ok) {
        const msg = `HTTP ${res.status} ${res.statusText || ''}`.trim();
        _reportSkillsRulesetFailure(configPath, msg);
        throw new Error(msg);
    }
    const text = await res.text();
    if (!text?.trim()) {
        const msg = 'File is empty.';
        _reportSkillsRulesetFailure(configPath, msg);
        throw new Error(msg);
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch (e) {
        const msg = `Invalid JSON: ${e?.message ?? String(e)}`;
        _reportSkillsRulesetFailure(configPath, msg);
        throw e;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        const msg = 'Root value must be a JSON object.';
        _reportSkillsRulesetFailure(configPath, msg);
        throw new Error(msg);
    }
    if (!Array.isArray(parsed.skills)) {
        const msg = 'Missing or invalid "skills" array.';
        _reportSkillsRulesetFailure(configPath, msg);
        throw new Error(msg);
    }
    _lastKnownEnabledCraftingSkillIds = extractEnabledSkillIds(parsed);
    _skillsRulesetErrorReported = false;
    return parsed;
}

/**
 * Load skills mapping JSON. Caches result. Rejects on load/parse failure (no fake empty document).
 * @returns {Promise<{ skills: Array, gatherDefaults?: object, schemaVersion?: number }>}
 */
export async function loadSkillsDetails() {
    if (_skillsDetailsCache) return _skillsDetailsCache;
    if (!_skillsDetailsPromise) {
        _skillsDetailsPromise = (async () => {
            try {
                const data = await _loadSkillsDocument();
                _skillsDetailsCache = data;
                return data;
            } catch (e) {
                _skillsDetailsPromise = null;
                throw e;
            }
        })();
    }
    return _skillsDetailsPromise;
}

/**
 * Load rules derived from skills mapping JSON. Caches result.
 * Rules come from each perk's optional rules.benefits in the details file.
 * @returns {Promise<{ schemaVersion: number, skills: Record<string, { perks: Record<string, object> }> }>}
 */
export async function loadSkillsRules() {
    if (_skillsRulesCache) return _skillsRulesCache;
    const details = await loadSkillsDetails();
    _skillsRulesCache = buildRulesFromDetails(details);
    return _skillsRulesCache;
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
 * Used by Roll for Components: roll bonus (summed), yield multiplier (max), and on-fail consolation (componentAutoGather).
 *
 * @param {string} skillId - Skill id (e.g. "Herbalism")
 * @param {string[]} learnedPerkIdsForSkill - Learned perk IDs that belong to this skill
 * @returns {Promise<{ gatheringRollBonus: number, gatheringYieldMultiplier: number, componentAutoGather?: string }>}
 */
export async function getEffectiveGatheringRules(skillId, learnedPerkIdsForSkill) {
    const { skills = {} } = await loadSkillsRules();
    const key = skillKey(skillId, skills);
    const skillRules = key ? skills[key] : null;
    const perks = skillRules?.perks ?? {};
    let gatheringRollBonus = 0;
    let gatheringYieldMultiplier = 1;
    /** @type {string|undefined} */
    let componentAutoGather = undefined;
    for (const rule of iterateRulesFromPerks(perks, learnedPerkIdsForSkill)) {
        if (typeof rule.gatheringRollBonus === 'number') gatheringRollBonus += rule.gatheringRollBonus;
        if (typeof rule.gatheringYieldMultiplier === 'number' && rule.gatheringYieldMultiplier > gatheringYieldMultiplier) {
            gatheringYieldMultiplier = rule.gatheringYieldMultiplier;
        }
        if (typeof rule.componentAutoGather === 'string' && rule.componentAutoGather.trim()) {
            componentAutoGather = rule.componentAutoGather.trim();
        }
    }
    return { gatheringRollBonus, gatheringYieldMultiplier, componentAutoGather };
}

/**
 * Get human-readable perk title(s) that grant componentAutoGather (for consolation card when gather fails).
 * @param {string} skillId - Skill id (e.g. "Herbalism")
 * @param {string[]} learnedPerkIdsForSkill - Learned perk IDs that belong to this skill
 * @returns {Promise<string[]>} Perk titles (e.g. ["Gentle Hand of the Grove"])
 */
export async function getComponentAutoGatherPerkNames(skillId, learnedPerkIdsForSkill) {
    const { skills = {} } = await loadSkillsRules();
    const key = skillKey(skillId, skills);
    const skillRules = key ? skills[key] : null;
    const perks = skillRules?.perks ?? {};
    const names = [];
    for (const perkId of learnedPerkIdsForSkill) {
        const entry = perks[perkId];
        if (!entry || typeof entry !== 'object') continue;
        for (const benefit of getPerkBenefits(perks, perkId)) {
            if (typeof benefit.rule?.componentAutoGather === 'string' && benefit.rule.componentAutoGather.trim()) {
                const title = (entry.title ?? perkId).trim();
                if (title && !names.includes(title)) names.push(title);
                break;
            }
        }
    }
    return names;
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
 *   experimentalCraftingTypes: string[],
 *   experimentalRandomComponents: number,
 *   dcModifier: number,
 *   experimentalRollBonus: number,
 *   ingredientLossOnFail: 'all' | 'half',
 *   ingredientKeptOnSuccess: undefined | 'half',
 *   craftingTimeMultiplier: number,
 *   similarIngredientSubstitutions: number,
 *   criticalCraftingEnabled: boolean,
 *   criticalSuccessOutputMultiplier: number,
 *   criticalFailureDamageFormula: string | null,
 *   randomTier0PotionOnFailChance: number,
 *   poisonPotencyBonus: number,
 *   poisonYieldBonusChance: number,
 *   poisonFumbleDamageMultiplier: number,
 *   poisonDeliveryTagAccess: string[],
 *   barterPersuasionBonus: number
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
    /** @type {Set<string>} */
    const experimentalCraftingTypesSet = new Set();
    let experimentalRandomComponents = 0;
    let experimentalRollBonus = 0;
    let ingredientLossOnFail = 'all';
    let ingredientKeptOnSuccess = undefined;
    let craftingTimeMultiplier = 1;
    let similarIngredientSubstitutions = 0;
    let criticalCraftingEnabled = false;
    let criticalSuccessOutputMultiplier = 1;
    let criticalFailureDamageFormula = null;
    let randomTier0PotionOnFailChance = 0;
    let poisonPotencyBonus = 0;
    let poisonYieldBonusChance = 0;
    let poisonFumbleDamageMultiplier = 1;
    const poisonDeliveryTagAccessSet = new Set();
    let barterPersuasionBonus = 0;

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
            const ct = rule.experimentalCrafting.craftingType;
            if (typeof ct === 'string' && ct.trim()) experimentalCraftingTypesSet.add(ct.trim().toLowerCase());
        }
        if (typeof rule.experimentalCraftingRandomComponents === 'number' && rule.experimentalCraftingRandomComponents > experimentalRandomComponents) {
            experimentalRandomComponents = rule.experimentalCraftingRandomComponents;
        }
        if (typeof rule.experimentalCraftingDCModifier === 'number') {
            experimentalRollBonus += rule.experimentalCraftingDCModifier;
        }
        if (rule.ingredientLossOnFail === 'half') {
            ingredientLossOnFail = 'half';
        }
        if (rule.ingredientKeptOnSuccess === 'half') {
            ingredientKeptOnSuccess = 'half';
        }
        if (typeof rule.craftingTimeMultiplier === 'number' && Number.isFinite(rule.craftingTimeMultiplier) && rule.craftingTimeMultiplier > 0) {
            craftingTimeMultiplier = Math.min(craftingTimeMultiplier, rule.craftingTimeMultiplier);
        }
        if (typeof rule.similarIngredientSubstitutions === 'number' && Number.isFinite(rule.similarIngredientSubstitutions)) {
            similarIngredientSubstitutions = Math.max(similarIngredientSubstitutions, Math.floor(rule.similarIngredientSubstitutions));
        }
        if (rule.criticalCrafting?.enabled === true) {
            criticalCraftingEnabled = true;
            const mult = Number(rule.criticalCrafting.critSuccessOutputMultiplier);
            if (Number.isFinite(mult) && mult > criticalSuccessOutputMultiplier) {
                criticalSuccessOutputMultiplier = Math.floor(mult);
            }
            const dmg = String(rule.criticalCrafting.critFailureDamageFormula ?? '').trim();
            if (dmg) criticalFailureDamageFormula = dmg;
        }
        if (typeof rule.randomTier0PotionOnFailChance === 'number' && Number.isFinite(rule.randomTier0PotionOnFailChance)) {
            randomTier0PotionOnFailChance = Math.max(randomTier0PotionOnFailChance, Math.max(0, Math.min(1, Number(rule.randomTier0PotionOnFailChance))));
        }
        if (typeof rule.poisonPotencyBonus === 'number' && Number.isFinite(rule.poisonPotencyBonus)) {
            poisonPotencyBonus += Number(rule.poisonPotencyBonus);
        }
        if (typeof rule.poisonYieldBonusChance === 'number' && Number.isFinite(rule.poisonYieldBonusChance)) {
            poisonYieldBonusChance = Math.max(poisonYieldBonusChance, Math.max(0, Math.min(1, Number(rule.poisonYieldBonusChance))));
        }
        if (typeof rule.poisonFumbleDamageMultiplier === 'number' && Number.isFinite(rule.poisonFumbleDamageMultiplier) && rule.poisonFumbleDamageMultiplier > 0) {
            poisonFumbleDamageMultiplier = Math.min(poisonFumbleDamageMultiplier, Number(rule.poisonFumbleDamageMultiplier));
        }
        if (Array.isArray(rule.poisonDeliveryTagAccess)) {
            for (const tag of rule.poisonDeliveryTagAccess) {
                const v = String(tag ?? '').trim().toLowerCase();
                if (v) poisonDeliveryTagAccessSet.add(v);
            }
        }
        if (typeof rule.barterPersuasionBonus === 'number' && Number.isFinite(rule.barterPersuasionBonus)) {
            barterPersuasionBonus += Number(rule.barterPersuasionBonus);
        }
    }

    const experimentalCraftingTypes = Array.from(experimentalCraftingTypesSet);

    const canViewTier = (level) => {
        if (hasExperimental) return true;
        const l = Number(level);
        if (Number.isNaN(l)) return false;
        return tierRanges.some(([min, max]) => l >= min && l <= max);
    };

    const inTier = (level) => {
        const l = Number(level);
        if (Number.isNaN(l)) return false;
        return tierRanges.some(([min, max]) => l >= min && l <= max);
    };

    return {
        canViewTier,
        inTier,
        hasExperimental,
        experimentalCraftingTypes,
        experimentalRandomComponents,
        dcModifier,
        experimentalRollBonus,
        ingredientLossOnFail,
        ingredientKeptOnSuccess,
        craftingTimeMultiplier,
        similarIngredientSubstitutions,
        criticalCraftingEnabled,
        criticalSuccessOutputMultiplier,
        criticalFailureDamageFormula,
        randomTier0PotionOnFailChance,
        poisonPotencyBonus,
        poisonYieldBonusChance,
        poisonFumbleDamageMultiplier,
        poisonDeliveryTagAccess: Array.from(poisonDeliveryTagAccessSet),
        barterPersuasionBonus
    };
}

/**
 * Get the icon class for a learned perk that grants experimental crafting for this skill.
 * Used to show that perk's icon on recipe rows that are attemptable only via experimental (e.g. Experimental Botanist).
 * @param {string} skillId - Skill id (e.g. "Herbalism")
 * @param {string[]} learnedPerkIdsForSkill - Actor's learned perk IDs for this skill
 * @returns {Promise<string|null>} iconClass (e.g. "fa-solid fa-flask") or null
 */
export async function getExperimentalPerkIconClass(skillId, learnedPerkIdsForSkill) {
    const { skills = {} } = await loadSkillsRules();
    const key = skillKey(skillId, skills);
    const skillRules = key ? skills[key] : null;
    const perks = skillRules?.perks ?? {};
    const skillLower = (skillId ?? '').toString().trim().toLowerCase();
    for (const perkId of learnedPerkIdsForSkill) {
        for (const benefit of getPerkBenefits(perks, perkId)) {
            const rule = benefit.rule;
            if (!rule?.experimentalCrafting || rule.experimentalCrafting.allowed !== true) continue;
            const ct = (rule.experimentalCrafting.craftingType ?? '').toString().trim().toLowerCase();
            if (ct && ct !== skillLower) continue;
            const { skills: detailsSkills = [] } = await loadSkillsDetails();
            const skillDetail = detailsSkills.find((s) => (s.id ?? '').toLowerCase() === (key ?? '').toLowerCase() || (s.id ?? '').toLowerCase() === skillLower);
            const perkDetail = skillDetail?.perks?.find((p) => (p.perkID ?? '') === perkId);
            if (!perkDetail?.icon) return null;
            let iconClass = (perkDetail.icon ?? '').toString().trim();
            if (!iconClass.startsWith('fa-')) iconClass = `fa-${iconClass}`;
            if (!iconClass.startsWith('fa-solid ') && !iconClass.startsWith('fa-brands ')) iconClass = `fa-solid ${iconClass}`;
            return iconClass;
        }
    }
    return null;
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
    const withinTier = !Number.isNaN(level) && rules.inTier(level);
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
            if (rule.experimentalCrafting && rule.experimentalCrafting.allowed === true && isExperimental) {
                const ct = (rule.experimentalCrafting.craftingType ?? '').toString().trim().toLowerCase();
                const skillLower = (skillId ?? '').toString().trim().toLowerCase();
                if (!ct || ct === skillLower) {
                    effectsByPerk.get(perkName).push('Experimental crafting (above tier)');
                }
            }
            if (typeof rule.experimentalCraftingRandomComponents === 'number' && rule.experimentalCraftingRandomComponents > 0 && isExperimental) {
                const n = rule.experimentalCraftingRandomComponents;
                effectsByPerk.get(perkName).push(n === 1 ? '1 wrong component (remove to succeed)' : `${n} wrong components (remove to succeed)`);
            }
            if (typeof rule.experimentalCraftingDCModifier === 'number' && rule.experimentalCraftingDCModifier !== 0 && isExperimental) {
                const sign = rule.experimentalCraftingDCModifier >= 0 ? '+' : '';
                effectsByPerk.get(perkName).push(`${sign}${rule.experimentalCraftingDCModifier} roll bonus (experimental attempt)`);
            }
            if (typeof rule.craftingTimeMultiplier === 'number' && Number.isFinite(rule.craftingTimeMultiplier) && rule.craftingTimeMultiplier > 0 && rule.craftingTimeMultiplier < 1) {
                const pct = Math.round((1 - rule.craftingTimeMultiplier) * 100);
                effectsByPerk.get(perkName).push(`-${pct}% crafting time`);
            }
            if (typeof rule.similarIngredientSubstitutions === 'number' && rule.similarIngredientSubstitutions > 0) {
                const n = Math.floor(rule.similarIngredientSubstitutions);
                effectsByPerk.get(perkName).push(n === 1 ? '1 trait-based ingredient substitution' : `${n} trait-based ingredient substitutions`);
            }
            if (rule.criticalCrafting?.enabled === true) {
                const mult = Number(rule.criticalCrafting.critSuccessOutputMultiplier) || 2;
                const dmg = String(rule.criticalCrafting.critFailureDamageFormula ?? '1d10').trim();
                effectsByPerk.get(perkName).push(`Nat 20: auto success x${Math.max(2, Math.floor(mult))} output; Nat 1: auto fail and ${dmg} self-damage`);
            }
            if (typeof rule.randomTier0PotionOnFailChance === 'number' && Number.isFinite(rule.randomTier0PotionOnFailChance) && rule.randomTier0PotionOnFailChance > 0) {
                const pct = Math.round(Math.max(0, Math.min(1, Number(rule.randomTier0PotionOnFailChance))) * 100);
                effectsByPerk.get(perkName).push(`${pct}% chance to gain a random tier-0 potion on failed craft`);
            }
            if (typeof rule.poisonPotencyBonus === 'number' && Number.isFinite(rule.poisonPotencyBonus) && rule.poisonPotencyBonus !== 0) {
                const sign = rule.poisonPotencyBonus >= 0 ? '+' : '';
                effectsByPerk.get(perkName).push(`${sign}${rule.poisonPotencyBonus} poison potency`);
            }
            if (typeof rule.poisonYieldBonusChance === 'number' && Number.isFinite(rule.poisonYieldBonusChance) && rule.poisonYieldBonusChance > 0) {
                const pct = Math.round(Math.max(0, Math.min(1, Number(rule.poisonYieldBonusChance))) * 100);
                effectsByPerk.get(perkName).push(`${pct}% chance for +1 extra poison output`);
            }
            if (typeof rule.poisonFumbleDamageMultiplier === 'number' && Number.isFinite(rule.poisonFumbleDamageMultiplier) && rule.poisonFumbleDamageMultiplier > 0 && rule.poisonFumbleDamageMultiplier < 1) {
                const pct = Math.round((1 - Number(rule.poisonFumbleDamageMultiplier)) * 100);
                effectsByPerk.get(perkName).push(`${pct}% reduced critical-fumble self-damage (poisoncraft)`);
            }
            if (Array.isArray(rule.poisonDeliveryTagAccess) && rule.poisonDeliveryTagAccess.length > 0) {
                effectsByPerk.get(perkName).push(`Delivery access: ${rule.poisonDeliveryTagAccess.join(', ')}`);
            }
            if (typeof rule.barterPersuasionBonus === 'number' && Number.isFinite(rule.barterPersuasionBonus) && rule.barterPersuasionBonus !== 0) {
                const sign = rule.barterPersuasionBonus >= 0 ? '+' : '';
                effectsByPerk.get(perkName).push(`${sign}${rule.barterPersuasionBonus} persuasion when shopping`);
            }
        }
    }

    for (const [name, effects] of effectsByPerk) {
        if (effects.length) out.push({ perkName: name, effect: effects.join('; ') });
    }
    return out;
}
