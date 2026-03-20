import { MODULE } from './const.js';
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

function _reportGatheringMappingFailure(configPath, detail) {
    if (_gatheringMappingErrorReported) return;
    _gatheringMappingErrorReported = true;
    const title = `${MODULE.TITLE}: Gathering ruleset failed`;
    const body = `Configured path: ${configPath}\n${detail}\n\nFix the file or update **Gathering Ruleset JSON** in module settings, then use Reload (or change the setting) to retry.`;
    console.error(title, detail);
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, title, body, true, !!game.user?.isGM);
    } else if (game.user?.isGM && typeof ui !== 'undefined') {
        ui.notifications?.error(`${title}. ${detail}`);
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
                return await _loadMappingDocument();
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
