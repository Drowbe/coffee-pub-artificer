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

/** Four level positions, 0-3. Index 0 is always "off". */
export const PROCESS_LEVEL_MIN = 0;
export const PROCESS_LEVEL_MAX = 3;

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

/**
 * Resolve a process by id.
 *
 * Step 3c extends this to look in the item cache first, so a GM-authored
 * process wins over a built-in of the same name. Callers do not change.
 * @param {string} id
 * @returns {object} A process definition; never null.
 */
export function getProcess(id) {
    const key = String(id ?? '').trim().toLowerCase();
    return BUILTIN_PROCESSES.find(p => p.id === key) ?? FALLBACK_PROCESS;
}

/** Every process that can currently be chosen. */
export function getAllProcesses() {
    return BUILTIN_PROCESSES.slice();
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
