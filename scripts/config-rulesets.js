// ==================================================================
// ===== RULESET PATHS (skills + gathering JSON) ====================
// ==================================================================
// World settings point at JSON files; URLs are resolved for fetch().

import { MODULE } from './const.js';

/** Bundled default: skills / perks / rules benefits (drives crafting + skills UI). */
export const DEFAULT_SKILLS_RULESET_PATH = `modules/${MODULE.ID}/resources/skills-mapping.json`;

/** Bundled default: gather pin idle/active imagery by biome + family. */
export const DEFAULT_GATHERING_RULESET_PATH = `modules/${MODULE.ID}/resources/gathering-mapping.json`;

/**
 * Normalize a Data-path or URL for fetch().
 * @param {string} path - e.g. modules/coffee-pub-artificer/resources/skills-mapping.json
 * @returns {string}
 */
export function resolveRulesetUrl(path) {
    const p = String(path ?? '').trim();
    if (!p) return '';
    if (/^https?:\/\//i.test(p)) return p;
    const normalized = p.replace(/^\/+/, '');
    if (typeof foundry?.utils?.getRoute === 'function') {
        try {
            const route = foundry.utils.getRoute(normalized);
            if (route) return route;
        } catch {
            /* fall through */
        }
    }
    return normalized.startsWith('http') ? normalized : `/${normalized}`;
}

/**
 * Configured skills ruleset path (world setting or default).
 * @returns {string}
 */
export function getSkillsRulesetPath() {
    try {
        const v = game.settings?.get?.(MODULE.ID, 'skillsRulesetJson');
        if (v && String(v).trim()) return String(v).trim();
    } catch {
        /* settings not ready */
    }
    return DEFAULT_SKILLS_RULESET_PATH;
}

/**
 * Configured gathering mapping path (world setting or default).
 * @returns {string}
 */
export function getGatheringRulesetPath() {
    try {
        const v = game.settings?.get?.(MODULE.ID, 'gatheringRulesetJson');
        if (v && String(v).trim()) return String(v).trim();
    } catch {
        /* settings not ready */
    }
    return DEFAULT_GATHERING_RULESET_PATH;
}

/**
 * URL used to fetch the skills ruleset JSON.
 * @returns {string}
 */
export function getSkillsRulesetFetchUrl() {
    return resolveRulesetUrl(getSkillsRulesetPath());
}

/**
 * URL used to fetch the gathering mapping JSON.
 * @returns {string}
 */
export function getGatheringRulesetFetchUrl() {
    return resolveRulesetUrl(getGatheringRulesetPath());
}
