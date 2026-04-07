import { MODULE } from './const.js';
import { postBlacksmithConsole } from './utils/blacksmith-console.js';
import { getGatheringRulesetFetchUrl, getGatheringRulesetPath } from './config-rulesets.js';

const BIOME_ALIASES = {
    meadow: 'grassland',
    plains: 'grassland'
};
const FAMILY_ALIASES = Object.freeze({
    gem: 'mineral',
    gems: 'mineral',
    mineral: 'mineral',
    minerals: 'mineral',
    ore: 'mineral',
    rocks: 'mineral',
    rock: 'mineral',
    plant: 'plant',
    plants: 'plant',
    environmental: 'environmental',
    essence: 'environmental',
    creaturepart: 'creature parts',
    creatureparts: 'creature parts',
    creature_parts: 'creature parts',
    creature: 'creature parts'
});

/** @type {Promise<object>|null} */
let _mappingPromise = null;
/** Avoid spamming the same failure; cleared on successful load or cache invalidation. */
let _gatheringMappingErrorReported = false;

/** Rarity keys for discovery DC offsets (must match scene flags + gather manager). */
const _GATHER_RARITY_KEYS = ['common', 'uncommon', 'rare', 'very rare', 'legendary'];

/**
 * Built-in gather runtime defaults (merged with optional `runtimeDefaults` from gathering ruleset JSON).
 * @type {Readonly<{
 *   pinAnimationTimeoutMs: number,
 *   discoveryMinPointSeparationPx: number,
 *   pinDefaultImage: string,
 *   pinSize: number,
 *   soundExploreSuccess: string,
 *   soundExploreFail: string,
 *   soundPopulate: string,
 *   soundClear: string,
 *   discoveryRadiusUnits: number,
 *   discoveryRarityOffsets: Readonly<Record<string, number>>
 * }>}
 */
export const BUILTIN_GATHER_RUNTIME_DEFAULTS = Object.freeze({
    pinAnimationTimeoutMs: 5000,
    discoveryMinPointSeparationPx: 90,
    pinDefaultImage: 'fa-solid fa-seedling',
    pinSize: 100,
    soundExploreSuccess: 'interface-notification-10',
    soundExploreFail: 'interface-error-03',
    soundPopulate: 'fanfare-success-2',
    soundClear: 'interface-button-10',
    discoveryRadiusUnits: 60,
    discoveryRarityOffsets: Object.freeze({
        common: 0,
        uncommon: 3,
        rare: 6,
        'very rare': 10,
        legendary: 14
    })
});

/** @type {typeof BUILTIN_GATHER_RUNTIME_DEFAULTS|null} */
let _gatherRuntimeMerged = null;

function _num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function _mergeGatherRuntimeInternal(overrides) {
    const b = BUILTIN_GATHER_RUNTIME_DEFAULTS;
    const o = overrides && typeof overrides === 'object' && !Array.isArray(overrides) ? overrides : {};
    const ro =
        o.discoveryRarityOffsets && typeof o.discoveryRarityOffsets === 'object' && !Array.isArray(o.discoveryRarityOffsets)
            ? o.discoveryRarityOffsets
            : {};
    const mergedOffsets = { ...b.discoveryRarityOffsets };
    for (const key of _GATHER_RARITY_KEYS) {
        if (Object.prototype.hasOwnProperty.call(ro, key)) {
            const n = Number(ro[key]);
            if (Number.isFinite(n)) mergedOffsets[key] = n;
        }
    }
    return Object.freeze({
        pinAnimationTimeoutMs: Math.max(100, Math.floor(_num(o.pinAnimationTimeoutMs, b.pinAnimationTimeoutMs))),
        discoveryMinPointSeparationPx: Math.max(1, Math.floor(_num(o.discoveryMinPointSeparationPx, b.discoveryMinPointSeparationPx))),
        pinDefaultImage: typeof o.pinDefaultImage === 'string' && o.pinDefaultImage.trim() ? o.pinDefaultImage.trim() : b.pinDefaultImage,
        pinSize: Math.max(16, Math.floor(_num(o.pinSize, b.pinSize))),
        soundExploreSuccess:
            typeof o.soundExploreSuccess === 'string' && o.soundExploreSuccess.trim()
                ? o.soundExploreSuccess.trim()
                : b.soundExploreSuccess,
        soundExploreFail:
            typeof o.soundExploreFail === 'string' && o.soundExploreFail.trim() ? o.soundExploreFail.trim() : b.soundExploreFail,
        soundPopulate:
            typeof o.soundPopulate === 'string' && o.soundPopulate.trim() ? o.soundPopulate.trim() : b.soundPopulate,
        soundClear: typeof o.soundClear === 'string' && o.soundClear.trim() ? o.soundClear.trim() : b.soundClear,
        discoveryRadiusUnits: Math.max(5, Math.floor(_num(o.discoveryRadiusUnits, b.discoveryRadiusUnits))),
        discoveryRarityOffsets: Object.freeze(mergedOffsets)
    });
}

/** Resolved builtin-only runtime (same shape as merged). */
const _builtinGatherRuntimeResolved = _mergeGatherRuntimeInternal(null);

/**
 * Effective gather runtime (builtin + last successful ruleset `runtimeDefaults`). Before first successful load, returns builtins only.
 * @returns {typeof BUILTIN_GATHER_RUNTIME_DEFAULTS}
 */
export function getGatherRuntimeDefaultsSync() {
    return _gatherRuntimeMerged ?? _builtinGatherRuntimeResolved;
}

/**
 * Preload gathering ruleset (mapping + runtime defaults). Safe to call multiple times.
 * @returns {Promise<object>}
 */
export async function preloadGatheringMapping() {
    return _loadMapping();
}

function _reportGatheringMappingFailure(configPath, detail) {
    if (_gatheringMappingErrorReported) return;
    _gatheringMappingErrorReported = true;
    const title = `${MODULE.TITLE}: Gathering ruleset failed`;
    const body = `Configured path: ${configPath}\n${detail}\n\nFix the file or update **Gathering Ruleset JSON** in module settings, then use Reload (or change the setting) to retry.`;
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
 * Clear cached gathering mapping (e.g. after world setting change).
 * Next resolve will fetch again.
 */
export function invalidateGatheringMappingCache() {
    _mappingPromise = null;
    _gatheringMappingErrorReported = false;
}

function _normalizeBiomeKey(raw) {
    const biome = String(raw ?? '').trim().toLowerCase();
    if (!biome) return '';
    return BIOME_ALIASES[biome] ?? biome;
}

function _toModulePath(path) {
    const value = String(path ?? '').trim();
    if (!value) return '';
    if (/^(https?:\/\/|\/|modules\/)/i.test(value)) return value.replace(/^\//, '');
    if (value.startsWith('images/')) return `modules/${MODULE.ID}/${value}`;
    return `modules/${MODULE.ID}/images/gathering/${value}`;
}

function _asStringArray(value) {
    if (!Array.isArray(value)) return [];
    return value.map((v) => String(v ?? '').trim()).filter(Boolean);
}

function _normalizeFamily(raw) {
    const value = String(raw ?? '').trim().toLowerCase();
    if (!value) return '';
    return FAMILY_ALIASES[value] ?? value;
}

function _normalizeFamilies(families = []) {
    return [...new Set((Array.isArray(families) ? families : [families]).map(_normalizeFamily).filter(Boolean))];
}

function _collectImagesFromBucket(bucket, families = []) {
    if (Array.isArray(bucket)) {
        return _asStringArray(bucket);
    }

    const byFamily = bucket?.byFamily ?? {};
    const anyFamily = _asStringArray(bucket?.anyFamily);
    const normalizedFamilies = _normalizeFamilies(families);
    if (!normalizedFamilies.length) {
        if (anyFamily.length) return anyFamily;
        const combined = [];
        for (const values of Object.values(byFamily)) {
            combined.push(..._asStringArray(values));
        }
        return combined;
    }

    const selected = [];
    for (const family of normalizedFamilies) {
        selected.push(..._asStringArray(byFamily?.[family]));
    }
    if (selected.length) return selected;
    if (anyFamily.length) return anyFamily;
    const combined = [];
    for (const values of Object.values(byFamily)) {
        combined.push(..._asStringArray(values));
    }
    return combined;
}

/**
 * Load and parse gathering mapping JSON. No silent fallback — throws on failure after notifying GM once.
 * @returns {Promise<object>}
 */
async function _loadMappingDocument() {
    const configPath = getGatheringRulesetPath();
    const url = getGatheringRulesetFetchUrl();
    if (!url) {
        const msg = 'Could not resolve a URL for the gathering ruleset (empty path?).';
        _reportGatheringMappingFailure(configPath, msg);
        throw new Error(msg);
    }
    let res;
    try {
        res = await fetch(url, { cache: 'no-store' });
    } catch (e) {
        const msg = `Network error while loading: ${e?.message ?? String(e)}`;
        _reportGatheringMappingFailure(configPath, msg);
        throw e;
    }
    if (!res.ok) {
        const msg = `HTTP ${res.status} ${res.statusText || ''}`.trim();
        _reportGatheringMappingFailure(configPath, msg);
        throw new Error(msg);
    }
    const text = await res.text();
    if (!text?.trim()) {
        const msg = 'File is empty.';
        _reportGatheringMappingFailure(configPath, msg);
        throw new Error(msg);
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch (e) {
        const msg = `Invalid JSON: ${e?.message ?? String(e)}`;
        _reportGatheringMappingFailure(configPath, msg);
        throw e;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        const msg = 'Root value must be a JSON object.';
        _reportGatheringMappingFailure(configPath, msg);
        throw new Error(msg);
    }
    _gatheringMappingErrorReported = false;
    return parsed;
}

async function _loadMapping() {
    if (!_mappingPromise) {
        _mappingPromise = (async () => {
            try {
                const parsed = await _loadMappingDocument();
                _gatherRuntimeMerged = _mergeGatherRuntimeInternal(parsed.runtimeDefaults);
                return parsed;
            } catch (e) {
                _mappingPromise = null;
                throw e;
            }
        })();
    }
    return _mappingPromise;
}

export async function resolveGatheringImage({ state = 'idle', biomes = [], families = [] } = {}) {
    let mapping;
    try {
        mapping = await _loadMapping();
    } catch {
        return '';
    }
    const stateMap = mapping?.states?.[state]?.byBiome ?? {};

    const normalizedBiomes = [...new Set((Array.isArray(biomes) ? biomes : []).map(_normalizeBiomeKey).filter(Boolean))];
    const pool = [];
    for (const biome of normalizedBiomes) {
        pool.push(..._collectImagesFromBucket(stateMap[biome], families));
    }
    if (!pool.length) {
        pool.push(..._collectImagesFromBucket(stateMap.any, families));
    }
    if (!pool.length) return '';

    const pick = pool[Math.floor(Math.random() * pool.length)] ?? '';
    return _toModulePath(pick);
}

export async function resolveGatheringImageForScene(scene, state = 'idle', options = {}) {
    const flags = scene?.getFlag?.(MODULE.ID, 'scene') ?? {};
    const biomes = Array.isArray(flags.habitats) ? flags.habitats : (flags.habitats ? [flags.habitats] : []);
    const families = options?.families ?? [];
    return resolveGatheringImage({ state, biomes, families });
}
