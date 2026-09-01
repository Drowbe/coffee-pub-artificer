// ==================================================================
// ===== SCENE GATHER PROFILE =======================================
// ==================================================================
// The effective gathering settings for a scene: the GM's value where they set
// one, the default where they did not.
//
// WHY THIS EXISTS. The form and the gather path each computed their own defaults,
// and they DISAGREED. `manager-scene.js` fell back to every component family when
// the flag was empty, so an unconfigured scene displayed all six ticked;
// `_getSceneGatherSettings` read the same flag with no fallback and yielded
// nothing. The form said "all", the engine said "none", and nothing reported the
// disagreement -- a scene that looked fully configured found no components, which
// is indistinguishable from a scene where there was nothing to find.
//
// SYNCHRONOUS AND PURE, DELIBERATELY. The Scene Config tab is injected during a
// render hook that must not await (see `_injectArtificerTab`), so the ruleset-derived
// harvesting defaults are passed IN rather than loaded here. Loading the ruleset is
// the caller's problem; deciding what a scene effectively has is this module's, and
// keeping them apart is what lets both callers share one answer.
//
// IF NAMED PROFILES EVER RETURN, THIS IS WHERE THEY GO. A `profile` text field used
// to exist on the Scene Config tab and was read by nothing, so it was deleted -- that
// was a judgement about a dead control, not about the idea. A real implementation
// would resolve a named preset here, between the stored flags and the defaults, and
// every caller would pick it up without changing: that is the point of there being one
// resolver. Nothing else in the module would need to know.
//
// THERE IS NO `enabled` HERE. Installing the module is the opt-in; asking again per
// scene asked the same question twice. What makes a scene gatherable is having a
// habitat and something that can be found there.
// ==================================================================

import { ARTIFICER_TYPES, FAMILIES_BY_TYPE } from '../schema-artificer-item.js';
import { normalizeCheckboxList, getSceneHabitats } from '../utils/helpers.js';

/** Clamp to an integer range, falling back when the value is not a number at all. */
function clampInt(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.floor(number))) : fallback;
}

/**
 * The default component families: all of them.
 *
 * This is a design choice rather than a derivation. A scene nobody has configured
 * should yield whatever its habitat supports, because the alternative is a GM
 * setting a habitat and finding nothing, with no indication why.
 */
export function defaultComponentTypes() {
    return [...(FAMILIES_BY_TYPE[ARTIFICER_TYPES.COMPONENT] ?? [])];
}

/**
 * Everything the gather path and the Scene Config tab need for one scene.
 *
 * @param {Scene|null} scene
 * @param {string[]} [harvestingDefaults] Ruleset-derived skill ids, supplied by the caller.
 * @returns {{
 *   habitats: string[], componentTypes: string[], harvestingSkills: string[],
 *   discoveryDC: number, discoveryBaseDC: number, harvestDC: number,
 *   discoveryOffsets: Record<string, number>, gatherSpots: number, discoveryRadiusUnits: number,
 *   isConfigurable: boolean, isTuned: boolean
 * }}
 */
export function resolveSceneGatherProfile(scene, harvestingDefaults = []) {
    const flags = scene?.getFlag?.('coffee-pub-artificer', 'scene') ?? {};

    // Habitat is Blacksmith's. Empty means the scene genuinely has none.
    const habitats = getSceneHabitats(scene);

    const storedTypes = normalizeCheckboxList(flags.componentTypes);
    const componentTypes = storedTypes.length ? storedTypes : defaultComponentTypes();

    const storedSkills = normalizeCheckboxList(flags.harvestingSkills);
    const harvestingSkills = storedSkills.length
        ? storedSkills
        : normalizeCheckboxList(harvestingDefaults);

    // `defaultDC` is a LEGACY key that no form field writes -- the form writes
    // `discoveryBaseDC` and `harvestDC`. Kept as a fallback because worlds predating
    // the split may still carry it: the writer retired it, the reader keeps it.
    const legacyDC = Number(flags.defaultDC);
    const legacyFallback = Number.isFinite(legacyDC) ? clampInt(legacyDC, 0, 20, 5) : 5;

    const discoveryDC = clampInt(flags.discoveryDC, 0, 20, legacyFallback);
    const discoveryBaseDC = clampInt(flags.discoveryBaseDC, 0, 20, discoveryDC);
    const harvestDC = clampInt(flags.harvestDC, 0, 20, legacyFallback);

    const discoveryOffsets = {
        common: clampInt(flags.discoveryOffsetCommon, 0, 30, 0),
        uncommon: clampInt(flags.discoveryOffsetUncommon, 0, 30, 3),
        rare: clampInt(flags.discoveryOffsetRare, 0, 30, 6),
        veryRare: clampInt(flags.discoveryOffsetVeryRare, 0, 30, 10),
        legendary: clampInt(flags.discoveryOffsetLegendary, 0, 30, 14)
    };

    const gatherSpots = clampInt(flags.gatherSpots, 1, 30, 1);
    const rawRadius = Number(flags.discoveryRadiusUnits);
    const discoveryRadiusUnits = Number.isFinite(rawRadius)
        ? Math.max(5, Math.min(300, Math.round(rawRadius / 5) * 5))
        : 60;

    return {
        habitats,
        componentTypes,
        harvestingSkills,
        discoveryDC,
        discoveryBaseDC,
        harvestDC,
        discoveryOffsets,
        gatherSpots,
        discoveryRadiusUnits,

        // CAN this scene yield anything. Habitat is the only real precondition --
        // component types always resolve to something, so the question reduces to
        // whether Blacksmith knows where this scene is.
        isConfigurable: habitats.length > 0,

        // HAS a GM deliberately tuned this scene. Different question, and the one the
        // scene-directory badge should answer: a GM wants to see which scenes they
        // have touched, not which ones are capable of gathering -- which, now that
        // every scene with a habitat is, would mark almost all of them.
        isTuned: normalizeCheckboxList(flags.componentTypes).length > 0
            || normalizeCheckboxList(flags.harvestingSkills).length > 0
            || Number.isFinite(Number(flags.discoveryBaseDC))
            || Number.isFinite(Number(flags.harvestDC))
            || Number.isFinite(Number(flags.gatherSpots))
    };
}
