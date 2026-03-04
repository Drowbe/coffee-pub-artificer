import { MODULE } from './const.js';

const GATHERING_MAPPING_URL = `modules/${MODULE.ID}/resources/gathering-mapping.json`;

const DEFAULT_MAPPING = {
    version: 1,
    states: {
        idle: {
            byBiome: {
                any: [
                    'images/gathering/herbalism-plant-bush-01.webp'
                ]
            }
        },
        active: {
            byBiome: {
                any: [
                    'images/gathering/herbalism-pile-dirt-01.webp'
                ]
            }
        }
    }
};

const BIOME_ALIASES = {
    meadow: 'grassland',
    plains: 'grassland'
};

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

export async function resolveGatheringImage({ state = 'idle', biomes = [] } = {}) {
    const mapping = await _loadMapping();
    const stateMap = mapping?.states?.[state]?.byBiome ?? {};

    const normalizedBiomes = [...new Set((Array.isArray(biomes) ? biomes : []).map(_normalizeBiomeKey).filter(Boolean))];
    const pool = [];
    for (const biome of normalizedBiomes) {
        pool.push(..._asStringArray(stateMap[biome]));
    }
    if (!pool.length) {
        pool.push(..._asStringArray(stateMap.any));
    }
    if (!pool.length) return '';

    const pick = pool[Math.floor(Math.random() * pool.length)] ?? '';
    return _toModulePath(pick);
}

export async function resolveGatheringImageForScene(scene, state = 'idle') {
    const flags = scene?.getFlag?.(MODULE.ID, 'scene') ?? {};
    const biomes = Array.isArray(flags.habitats) ? flags.habitats : (flags.habitats ? [flags.habitats] : []);
    return resolveGatheringImage({ state, biomes });
}
