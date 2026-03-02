// ==================================================================
// ===== WINDOW BOUNDS (size/position) persistence ==================
// ==================================================================

import { MODULE } from './const.js';

/**
 * Merge saved bounds from client setting into default position (width, height, left, top).
 * GM and players each have their own saved bounds per window.
 * @param {object} defaultPosition - Default position, e.g. { width: 1100, height: 750 }
 * @param {string} settingKey - game.settings key (client-scoped), e.g. 'windowBoundsCrafting'
 * @returns {object} Merged position for ApplicationV2 options
 */
export function getPositionWithSavedBounds(defaultPosition, settingKey) {
    const saved = game.settings.get(MODULE.ID, settingKey);
    if (!saved || typeof saved !== 'object') return defaultPosition;
    const merged = foundry.utils.mergeObject({ ...defaultPosition }, saved);
    if (merged.width === 'auto' || merged.height === 'auto') return defaultPosition;
    return merged;
}

/**
 * Persist current window position/size to client setting (call from _onPosition and _preClose).
 * @param {string} settingKey - game.settings key
 * @param {{ width?: number, height?: number, left?: number, top?: number }} position - Current position from app.position
 */
export function saveWindowBounds(settingKey, position) {
    if (!position || typeof position !== 'object') return;
    const toSave = {};
    if (typeof position.width === 'number') toSave.width = position.width;
    if (typeof position.height === 'number') toSave.height = position.height;
    if (typeof position.left === 'number') toSave.left = position.left;
    if (typeof position.top === 'number') toSave.top = position.top;
    if (Object.keys(toSave).length) game.settings.set(MODULE.ID, settingKey, toSave);
}
