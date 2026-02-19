// ================================================================== 
// ===== ARTIFICER ITEM IMPORT UTILITIES ============================
// ================================================================== 

import { MODULE } from './const.js';
import { postDebug, postError } from './utils/helpers.js';
import { createArtificerItem, validateArtificerData } from './utility-artificer-item.js';
import { ARTIFICER_TYPES, LEGACY_TYPE_TO_ARTIFICER_TYPE, LEGACY_FAMILY_TO_FAMILY, FAMILIES_BY_TYPE } from './schema-artificer-item.js';

/**
 * Parse import input (File, string, or object/array) into array of payloads
 * @param {File|string|Object|Array} input - Input to parse
 * @returns {Promise<Array>} Array of item payloads
 */
export async function parseImportInput(input) {
    let rawData;
    
    // Handle File object
    if (input instanceof File) {
        const text = await input.text();
        rawData = JSON.parse(text);
    }
    // Handle string (JSON text)
    else if (typeof input === 'string') {
        const trimmed = input.trim();
        rawData = JSON.parse(trimmed);
    }
    // Handle object or array directly
    else if (typeof input === 'object') {
        rawData = input;
    }
    else {
        throw new Error('Invalid input type. Expected File, string, or object/array');
    }
    
    // Normalize to array
    if (Array.isArray(rawData)) {
        return rawData;
    } else if (rawData && typeof rawData === 'object') {
        return [rawData];
    } else {
        throw new Error('Invalid JSON structure. Expected object or array of objects');
    }
}

/**
 * Validate an import payload structure
 * Preserves the full payload (including system, activities, etc.) so items retain
 * healing, poison, magical, and other D&D 5e consumable properties. Pass-through
 * design supports cross-module use (e.g., Blacksmith) and ingredients that are
 * both crafting materials and standalone usable items.
 * @param {Object} payload - Item payload to validate
 * @returns {Object} Validated payload with { payload, artificerData, type }
 * @throws {Error} If validation fails
 */
export function validateImportPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('Payload must be an object');
    }
    
    // Check required fields
    if (!payload.name || typeof payload.name !== 'string') {
        throw new Error('Payload must have a "name" field (string)');
    }
    
    const artificerFlags = payload.flags?.[MODULE.ID] || payload.artificer || {};
    let type = artificerFlags.type;
    const legacyTypes = ['ingredient', 'component', 'essence', 'apparatus', 'container', 'resultContainer', 'tool'];
    if (!type || (!Object.values(ARTIFICER_TYPES).includes(type) && !legacyTypes.includes(type))) {
        throw new Error(`Payload must have flags.${MODULE.ID}.type (Component, Creation, Tool, or legacy)`);
    }
    if (legacyTypes.includes(type)) type = LEGACY_TYPE_TO_ARTIFICER_TYPE[type] ?? ARTIFICER_TYPES.COMPONENT;

    let family = artificerFlags.family ?? '';
    family = LEGACY_FAMILY_TO_FAMILY[family] ?? family;
    if (!family && FAMILIES_BY_TYPE[type]?.length) family = FAMILIES_BY_TYPE[type][0];

    let traits = Array.isArray(artificerFlags.traits) ? artificerFlags.traits : [];
    if (traits.length === 0) {
        const p = artificerFlags.primaryTag ? [artificerFlags.primaryTag] : [];
        const s = Array.isArray(artificerFlags.secondaryTags) ? artificerFlags.secondaryTags : [];
        const q = artificerFlags.quirk ? [artificerFlags.quirk] : [];
        traits = [...p, ...s, ...q].filter(Boolean);
    }

    const artificerData = {
        type,
        family,
        traits,
        skillLevel: Math.max(1, parseInt(artificerFlags.skillLevel, 10) || 1),
        rarity: artificerFlags.rarity || payload.rarity || payload.system?.rarity || 'Common'
    };
    if (type === ARTIFICER_TYPES.COMPONENT) {
        artificerData.biomes = Array.isArray(artificerFlags.biomes) ? artificerFlags.biomes : [];
        if (artificerFlags.affinity) artificerData.affinity = artificerFlags.affinity;
    }

    validateArtificerData(artificerData);

    return {
        payload,
        artificerData,
        type
    };
}

/**
 * Import items from payloads
 * @param {Array} payloads - Array of validated payloads
 * @param {Object} options - Import options
 * @param {boolean} options.createInWorld - Create in world (default: true)
 * @param {Actor|null} options.actor - Optional actor to add items to
 * @returns {Promise<Object>} Import result with created items and errors
 */
export async function importItems(payloads, options = {}) {
    const { createInWorld = true, actor = null } = options;
    
    const result = {
        created: [],
        errors: [],
        total: payloads.length,
        successCount: 0,
        errorCount: 0
    };
    
    for (let i = 0; i < payloads.length; i++) {
        const payload = payloads[i];
        const itemName = payload.name || `Item ${i + 1}`;
        
        try {
            // Validate payload
            const validated = validateImportPayload(payload);
            
            // Create item (pass full payload to preserve system, activities, etc.)
            const item = await createArtificerItem(
                validated.payload,
                validated.artificerData,
                { createInWorld, actor }
            );
            
            result.created.push({
                name: item.name,
                item: item,
                index: i
            });
            result.successCount++;
            
        } catch (error) {
            const errorMessage = error.message || String(error);
            result.errors.push({
                name: itemName,
                error: errorMessage,
                index: i
            });
            result.errorCount++;
        }
    }
    
    return result;
}

/**
 * Import items from JSON text
 * @param {string} text - JSON text to import
 * @param {Object} options - Import options
 * @returns {Promise<Object>} Import result
 */
export async function importFromText(text, options = {}) {
    try {
        const payloads = await parseImportInput(text);
        return await importItems(payloads, options);
    } catch (error) {
        throw new Error(`Failed to parse import text: ${error.message}`);
    }
}

/**
 * Import items from File
 * @param {File} file - File to import
 * @param {Object} options - Import options
 * @returns {Promise<Object>} Import result
 */
export async function importFromFile(file, options = {}) {
    try {
        const payloads = await parseImportInput(file);
        return await importItems(payloads, options);
    } catch (error) {
        throw new Error(`Failed to import from file: ${error.message}`);
    }
}

/**
 * Show import result notification
 * @param {Object} result - Import result from importItems()
 * @param {string} moduleName - Module name for logging
 */
export function showImportResult(result, moduleName = MODULE.NAME) {
    const { total, successCount, errorCount, created, errors } = result;
    
    // Use BlacksmithUtils if available, otherwise fallback to ui.notifications
    const notify = (message, type = 'info') => {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            const isError = type === 'error';
            BlacksmithUtils.postConsoleAndNotification(moduleName, message, null, isError, false);
        } else if (ui?.notifications) {
            if (type === 'error') {
                ui.notifications.error(message);
            } else {
                ui.notifications.info(message);
            }
        } else {
            postDebug(moduleName, message);
        }
    };
    
    // Show summary
    if (errorCount === 0) {
        notify(`Successfully imported ${successCount} item${successCount !== 1 ? 's' : ''}`, 'info');
    } else if (successCount === 0) {
        notify(`Failed to import all ${total} item${total !== 1 ? 's' : ''}`, 'error');
    } else {
        notify(`Imported ${successCount} of ${total} item${total !== 1 ? 's' : ''} (${errorCount} error${errorCount !== 1 ? 's' : ''})`, 'info');
    }
    
    // Log errors if any
    if (errors.length > 0) {
        errors.forEach(({ name, error, index }) => {
            postError(moduleName, `Import Error: Item ${index + 1} (${name})`, error?.message ?? String(error));
        });
    }
    
    // Log created items (debug only)
    if (created.length > 0) {
        created.forEach(({ name, index }) => {
            postDebug(moduleName, `Imported: ${index + 1}. ${name}`);
        });
    }
}
