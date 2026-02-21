// ================================================================== 
// ===== ARTIFICER ITEM IMPORT UTILITIES ============================
// ================================================================== 

import { MODULE } from './const.js';
import { postDebug, postError } from './utils/helpers.js';
import { createArtificerItem, validateArtificerData } from './utility-artificer-item.js';
import { ARTIFICER_TYPES, FAMILIES_BY_TYPE, ARTIFICER_FLAG_KEYS } from './schema-artificer-item.js';
import { OFFICIAL_BIOMES } from './schema-ingredients.js';

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
    
    const artificerFlags = payload.flags?.[MODULE.ID];
    if (!artificerFlags || typeof artificerFlags !== 'object') {
        throw new Error(`Payload must have flags.${MODULE.ID} with artificerType, artificerFamily, and artificerTraits`);
    }
    const type = artificerFlags[ARTIFICER_FLAG_KEYS.TYPE] ?? artificerFlags.type;
    if (!type || !Object.values(ARTIFICER_TYPES).includes(type)) {
        throw new Error(`Payload must have flags.${MODULE.ID}.artificerType (Component, Creation, or Tool)`);
    }
    const family = artificerFlags[ARTIFICER_FLAG_KEYS.FAMILY] ?? artificerFlags.family ?? '';
    const validFamilies = FAMILIES_BY_TYPE[type];
    if (!family || (validFamilies?.length && !validFamilies.includes(family))) {
        throw new Error(`Payload must have flags.${MODULE.ID}.artificerFamily (one of: ${validFamilies?.join(', ') ?? 'see schema'})`);
    }
    const traitsRaw = artificerFlags[ARTIFICER_FLAG_KEYS.TRAITS] ?? artificerFlags.traits;
    const traits = Array.isArray(traitsRaw) ? traitsRaw : [];
    if (traits.length === 0) {
        throw new Error(`Payload must have flags.${MODULE.ID}.artificerTraits (non-empty array of tag strings)`);
    }

    const artificerData = {
        type,
        family,
        traits,
        skillLevel: Math.max(1, parseInt(artificerFlags[ARTIFICER_FLAG_KEYS.SKILL_LEVEL] ?? artificerFlags.skillLevel, 10) || 1)
    };
    if (type === ARTIFICER_TYPES.COMPONENT) {
        const biomesRaw = artificerFlags[ARTIFICER_FLAG_KEYS.BIOMES] ?? artificerFlags.biomes;
        artificerData.biomes = Array.isArray(biomesRaw)
            ? biomesRaw.filter(b => OFFICIAL_BIOMES.includes(b))
            : [];
        const quirk = artificerFlags[ARTIFICER_FLAG_KEYS.QUIRK] ?? artificerFlags.quirk;
        if (quirk) artificerData.quirk = String(quirk).trim();
        const affinity = artificerFlags[ARTIFICER_FLAG_KEYS.AFFINITY] ?? artificerFlags.affinity;
        if (affinity) artificerData.affinity = affinity;
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
