// ==================================================================
// ===== PROCESS DEFINITIONS ========================================
// ==================================================================
// A process is four things and no behaviour: a name, three level positions
// each with a label and a colour, an animation to play, and whether it can
// destabilise at full intensity.
//
// WHY THIS FILE EXISTS. `heat` and `grind` were hardcoded in six places --
// PROCESS_TYPES, HEAT_LEVELS, GRIND_LEVELS, a boolean CSS class, a sound path,
// and a pile of `processType === 'heat' ? a : b` ternaries. Ferment, smith and
// inscribe are wanted, and none of their vocabularies fit either branch.
//
// THIS IS THE SEAM, NOT THE DESTINATION. Step 3c makes a Process an Artificer
// ITEM, authored by a GM. When it lands, `getProcess()` starts resolving from
// the item cache and everything downstream is unchanged, because nothing
// downstream reads the constants any more -- it reads a definition.
//
// See documentation/plans/plan-recipe-data-model.md, "a Process is an item".
// ==================================================================

import { MODULE } from '../const.js';
import { getAllRecordsFromCache } from '../cache/cache-items.js';
import { ARTIFICER_TYPES, PROCESS_FAMILY } from '../schema-artificer-item.js';
import { postBlacksmithConsole } from '../utils/blacksmith-console.js';
import { PROCESS_LEVEL_MIN, PROCESS_LEVEL_MAX } from '../schema-recipes.js';

/**
 * Named animations the crafting bench can play.
 *
 * The name is the contract: CSS provides `.artificer-anim-<id>` and reads two
 * custom properties from the element -- `--process-level` (0-1) and
 * `--process-color`.
 *
 * NAMES DESCRIBE THE MOTION, NOT THE PROCESS. `pulse` and `shake`, not `heating`
 * and `grinding`. A ferment can pulse and a sieve can shake; naming an effect
 * after the first process that used it is how `isGrinding` happened.
 */
export const PROCESS_ANIMATIONS = {
    NONE: 'none',
    PULSE: 'pulse',
    SHAKE: 'shake'
};

/**
 * Four level positions, 0-3. Index 0 is always "off".
 * Re-exported from schema-recipes so consumers can take it from either place --
 * it is defined there because the recipe data model needs it without pulling in
 * the item cache. One definition, two doors.
 */
export { PROCESS_LEVEL_MIN, PROCESS_LEVEL_MAX } from '../schema-recipes.js';

/**
 * The processes Artificer ships.
 *
 * Colours here are what the old CSS hardcoded, lifted out verbatim so the bench
 * looks identical: the heat glow was `rgba(255, 180, 90, …)` and the grind dust
 * `rgba(235, 225, 205, …)`.
 *
 * @type {Array<{id: string, label: string, animation: string, sound: string,
 *               unstableAtMax: boolean, levels: Array<{label: string, color: string}>}>}
 */
export const BUILTIN_PROCESSES = [
    {
        id: 'heat',
        label: 'Heat',
        animation: PROCESS_ANIMATIONS.PULSE,
        sound: `modules/${MODULE.ID}/sounds/fire-boil-01.mp3`,
        // Only heat flickers when it runs away. A ferment left at full intensity
        // is not "unstable", so this is per-process rather than universal.
        unstableAtMax: true,
        levels: [
            { label: 'Off', color: 'rgba(255, 180, 90, 0)' },
            { label: 'Low', color: 'rgba(255, 180, 90, 0.6)' },
            { label: 'Medium', color: 'rgba(255, 180, 90, 0.8)' },
            { label: 'High', color: 'rgba(255, 180, 90, 1)' }
        ]
    },
    {
        id: 'grind',
        label: 'Grind',
        animation: PROCESS_ANIMATIONS.SHAKE,
        sound: `modules/${MODULE.ID}/sounds/grind-stone-01.mp3`,
        unstableAtMax: false,
        levels: [
            { label: 'Off', color: 'rgba(235, 225, 205, 0)' },
            { label: 'Coarse', color: 'rgba(235, 225, 205, 0.5)' },
            { label: 'Medium', color: 'rgba(235, 225, 205, 0.7)' },
            { label: 'Fine', color: 'rgba(235, 225, 205, 0.9)' }
        ]
    }
];

/** Used when a recipe names a process nothing can resolve. */
const FALLBACK_PROCESS = BUILTIN_PROCESSES[0];

/** Animation manifest, loaded once. */
let _animations = null;

/**
 * Turn a Process ITEM's flags into a definition.
 *
 * A process authored by a GM and one Artificer ships are the same shape by the
 * time anything reads them, which is the point: nothing downstream knows or
 * cares which it got.
 * @param {object} record - Item cache record.
 * @returns {object|null}
 */
function processFromRecord(record) {
    const levels = record?.processLevels;
    // No levels means no process. An item in the Process family that never had its
    // fields filled in is incomplete, not a process with defaults.
    if (!Array.isArray(levels) || !levels.length) return null;
    return {
        id: String(record.name ?? '').trim().toLowerCase(),
        label: record.name,
        animation: record.processAnimation || PROCESS_ANIMATIONS.NONE,
        sound: record.processSound || '',
        unstableAtMax: Boolean(record.processUnstableAtMax),
        levels: levels.map(l => ({ label: l?.label ?? '', color: l?.color ?? 'transparent' }))
    };
}

/**
 * Every Process item currently in the cache, ONE PER ID.
 *
 * The cache holds compendium items AND world items, so a process exported to a
 * pack appears twice. Duplicates are invisible to `getProcess`, which uses `find`
 * -- but they broke the crafting bench's cycler outright: `indexOf` returned the
 * first copy and `idx + 1` landed on its twin, so the next-process button appeared
 * to do nothing while previous worked fine.
 *
 * WHICH COPY WINS IS THE GM'S CHOICE, not ours. `itemLookupOrder` already decides
 * this for every other item resolution, and a GM editing a process in the world to
 * try it out has explicitly asked for the world copy. Honouring it here keeps
 * processes behaving like every other Artificer item.
 */
function authoredProcesses() {
    let order = 'compendia-first';
    try {
        order = game.settings.get(MODULE.ID, 'itemLookupOrder') ?? order;
    } catch {
        // Settings are registered at `ready`; before that the default applies.
    }

    const isWorld = (record) => record?.source === 'world';
    let records = getAllRecordsFromCache()
        .filter(r => r?.artificerType === ARTIFICER_TYPES.TOOL && r?.family === PROCESS_FAMILY);

    if (order === 'compendia-only') records = records.filter(r => !isWorld(r));

    // Stable sort so the preferred source is seen first and wins the de-dupe below.
    if (order === 'world-first') {
        records = [...records].sort((a, b) => Number(isWorld(b)) - Number(isWorld(a)));
    } else {
        records = [...records].sort((a, b) => Number(isWorld(a)) - Number(isWorld(b)));
    }

    const byId = new Map();
    for (const record of records) {
        const process = processFromRecord(record);
        if (process && !byId.has(process.id)) byId.set(process.id, process);
    }
    return Array.from(byId.values());
}

/**
 * Resolve a process by id, or by an item's name.
 *
 * AUTHORED WINS. A GM who makes a process called "Heat" is overriding ours on
 * purpose; silently preferring the built-in would make their item inert with no
 * way to tell. Falls back to the built-ins, then to the first of them, so a
 * recipe naming something that no longer exists still crafts rather than throwing.
 * @param {string} id
 * @returns {object} A process definition; never null.
 */
export function getProcess(id) {
    return findProcess(id) ?? FALLBACK_PROCESS;
}

/**
 * Resolve a process, or NULL when nothing matches.
 *
 * Use this anywhere the answer is shown to a person. `getProcess` falls back to
 * the first built-in so something can always be animated, but that fallback LIES
 * when displayed: a recipe storing "Forge" would render as "Heat" and the author
 * would have no way to tell the name had not resolved.
 * @param {string} id
 * @returns {object|null}
 */
export function findProcess(id) {
    const key = String(id ?? '').trim().toLowerCase();
    return authoredProcesses().find(p => p.id === key)
        ?? BUILTIN_PROCESSES.find(p => p.id === key)
        ?? null;
}

/**
 * Every process that can currently be chosen, authored ones first.
 * A built-in is hidden when an authored process shares its id, for the same
 * reason `getProcess` prefers it.
 */
export function getAllProcesses() {
    const authored = authoredProcesses();
    const taken = new Set(authored.map(p => p.id));
    // Alphabetical by label. The cycler steps through this list, and cache order is
    // arbitrary -- so without a sort the arrows walked processes in whatever order
    // the item cache happened to hold them, which changes between rebuilds.
    return [...authored, ...BUILTIN_PROCESSES.filter(p => !taken.has(p.id))]
        .sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

/**
 * The animations a Process item may choose from.
 *
 * The manifest is an INDEX of CSS, not a definition of it -- an entry means a
 * stylesheet provides `.artificer-anim-<id>`. Entries with no CSS behind them are
 * dropped and reported: offering an animation that silently does nothing is worse
 * than offering fewer.
 * @returns {Promise<Array<{id: string, label: string, description: string}>>}
 */
export async function getProcessAnimations() {
    if (_animations) return _animations;

    let declared = [];
    try {
        const response = await fetch(`modules/${MODULE.ID}/resources/process-animations.json`);
        const data = await response.json();
        declared = Array.isArray(data?.animations) ? data.animations : [];
    } catch (error) {
        postBlacksmithConsole(MODULE.NAME, 'Could not read the process animation manifest', error?.message ?? String(error), true, false);
        _animations = [];
        return _animations;
    }

    // Probe: an animation's CSS sets `--artificer-anim-registered`. A manifest
    // entry whose class sets nothing has no stylesheet behind it.
    const probe = document.createElement('div');
    probe.style.display = 'none';
    document.body.appendChild(probe);
    const backed = [];
    const missing = [];
    try {
        for (const animation of declared) {
            if (!animation?.id) continue;
            probe.className = `artificer-anim-${animation.id}`;
            const registered = getComputedStyle(probe).getPropertyValue('--artificer-anim-registered').trim();
            (registered ? backed : missing).push(animation);
        }
    } finally {
        probe.remove();
    }

    if (missing.length) {
        postBlacksmithConsole(MODULE.NAME,
            `Process animations declared with no CSS behind them: ${missing.map(a => a.id).join(', ')}`,
            null, true, false);
    }

    _animations = backed;
    return _animations;
}

/** Drop the cached manifest (settings change, module reload). */
export function invalidateProcessAnimations() {
    _animations = null;
}

/**
 * One level of a process, clamped into range.
 * @param {string} id
 * @param {number} level
 * @returns {{label: string, color: string}}
 */
export function getProcessLevel(id, level) {
    const process = getProcess(id);
    const index = Math.max(PROCESS_LEVEL_MIN, Math.min(PROCESS_LEVEL_MAX, Math.floor(Number(level) || 0)));
    return process.levels[index] ?? process.levels[0];
}

/**
 * The label shown at each end of the intensity slider.
 * Derived from the process's own levels rather than a per-process ternary.
 * @param {string} id
 * @returns {{left: string, right: string}}
 */
export function getProcessSliderLabels(id) {
    const process = getProcess(id);
    return {
        left: process.levels[PROCESS_LEVEL_MIN]?.label ?? 'Off',
        right: process.levels[PROCESS_LEVEL_MAX]?.label ?? 'Max'
    };
}
