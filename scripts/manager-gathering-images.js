import { MODULE } from './const.js';

const GATHERING_MAPPING_URL = `modules/${MODULE.ID}/resources/gathering-mapping.json`;

const DEFAULT_MAPPING = {
    version: 2,
    states: {
        idle: {
            byBiome: {
                any: {
                    anyFamily: [],
                    byFamily: {
                        plant: ['images/gathering/herbalism-plant-bush-01.webp']
                    }
                }
            }
        },
        active: {
            byBiome: {
                any: {
                    anyFamily: ['images/gathering/herbalism-pile-dirt-01.webp'],
                    byFamily: {}
                }
            }
        }
    }
};

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

let _mappingPromise = null;

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

async function _loadMapping() {
    if (_mappingPromise) return _mappingPromise;
    _mappingPromise = (async () => {
        try {
            const res = await fetch(GATHERING_MAPPING_URL, { cache: 'no-store' });
            if (!res.ok) return DEFAULT_MAPPING;
            const text = await res.text();
            if (!text?.trim()) return DEFAULT_MAPPING;
            const parsed = JSON.parse(text);
            return parsed && typeof parsed === 'object' ? parsed : DEFAULT_MAPPING;
        } catch {
            return DEFAULT_MAPPING;
        }
    })();
    return _mappingPromise;
}

export async function resolveGatheringImage({ state = 'idle', biomes = [], families = [] } = {}) {
    const mapping = await _loadMapping();
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
