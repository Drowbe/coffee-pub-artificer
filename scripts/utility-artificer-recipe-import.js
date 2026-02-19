// ==================================================================
// ===== ARTIFICER RECIPE IMPORT UTILITIES ==========================
// ==================================================================

import { MODULE } from './const.js';
import { getOrCreateJournal, postDebug, postError } from './utils/helpers.js';
import { ArtificerRecipe } from './data/models/model-recipe.js';
import { ITEM_TYPES, CRAFTING_SKILLS, HEAT_LEVELS, HEAT_MAX, GRIND_LEVELS, PROCESS_TYPES } from './schema-recipes.js';
import { resolveItemByName } from './utility-artificer-item.js';

/** Default journal name when none configured */
const DEFAULT_RECIPE_JOURNAL_NAME = 'Artificer Recipes';

/**
 * Parse recipe import input (File, string, or object/array) into array of payloads
 * @param {File|string|Object|Array} input
 * @returns {Promise<Array>}
 */
export async function parseRecipeImportInput(input) {
    let rawData;
    if (input instanceof File) {
        rawData = JSON.parse(await input.text());
    } else if (typeof input === 'string') {
        rawData = JSON.parse(input.trim());
    } else if (typeof input === 'object') {
        rawData = input;
    } else {
        throw new Error('Invalid input type. Expected File, string, or object/array');
    }
    if (Array.isArray(rawData)) return rawData;
    if (rawData && typeof rawData === 'object') return [rawData];
    throw new Error('Invalid JSON structure. Expected object or array of objects');
}

/**
 * Validate recipe payload and return normalized data
 * Uses compendium settings (priority order), then world items for result/container lookup.
 * @param {Object} payload
 * @returns {Promise<Object>} { valid: boolean, data: Object, error?: string }
 */
export async function validateRecipePayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return { valid: false, error: 'Payload must be an object' };
    }
    if (!payload.name || typeof payload.name !== 'string') {
        return { valid: false, error: 'Recipe must have a "name" field (string)' };
    }
    const ingredients = Array.isArray(payload.ingredients) ? payload.ingredients : [];
    const validIngs = ingredients.every((i) => {
        const t = typeof i === 'object' ? i : { type: 'ingredient', name: String(i), quantity: 1 };
        return t.name && typeof t.name === 'string';
    });
    if (!validIngs && ingredients.length > 0) {
        return { valid: false, error: 'Each ingredient must have a "name" field' };
    }
    const resultItemName = payload.resultItemName ?? payload.name;
    if (!resultItemName?.trim()) {
        return { valid: false, error: `Recipe "${payload.name}" requires resultItemName` };
    }
    const apparatusName = payload.apparatusName ?? payload.containerName ?? payload.container ?? null;
    const containerName = payload.containerName ?? null;
    const toolName = payload.toolName ?? payload.tool ?? null;

    // Store names only—no world UUIDs. Recipes resolve items by name at runtime (compendia + world).
    const data = {
        name: payload.name,
        type: payload.type ?? ITEM_TYPES.CONSUMABLE,
        category: payload.category ?? '',
        skill: payload.skill ?? CRAFTING_SKILLS.ALCHEMY,
        skillLevel: payload.skillLevel ?? 0,
        workstation: payload.workstation ?? null,
        ingredients: ingredients.map((i) => ({
            type: (typeof i === 'object' ? i.type : 'ingredient') ?? 'ingredient',
            name: typeof i === 'object' ? i.name : String(i),
            quantity: (typeof i === 'object' ? i.quantity : 1) ?? 1
        })),
        resultItemName: resultItemName.trim(),
        tags: Array.isArray(payload.tags) ? payload.tags : [],
        description: payload.description ?? '',
        heat: payload.heat != null ? (Number(payload.heat) >= 0 && Number(payload.heat) <= HEAT_MAX ? Math.round(Number(payload.heat)) : null) : null,
        processType: payload.processType != null && PROCESS_TYPES.includes(String(payload.processType).toLowerCase()) ? String(payload.processType).toLowerCase() : null,
        processLevel: payload.processLevel != null ? (Number(payload.processLevel) >= 0 && Number(payload.processLevel) <= HEAT_MAX ? Math.round(Number(payload.processLevel)) : null) : null,
        time: payload.time != null ? (Number(payload.time) >= 0 ? Number(payload.time) : null) : null,
        apparatusName: apparatusName?.trim() || null,
        containerName: containerName?.trim() || null,
        toolName: toolName?.trim() || null,
        goldCost: payload.goldCost != null ? Number(payload.goldCost) : null,
        workHours: payload.workHours != null ? Number(payload.workHours) : null
    };
    const recipe = new ArtificerRecipe({ ...data, id: `temp-${foundry.utils.randomID()}` });
    if (!recipe.validate?.()) {
        return { valid: false, error: `Recipe "${payload.name}" failed validation` };
    }
    return { valid: true, data };
}

/**
 * Build HTML content for a recipe journal page (matches RecipeParser format)
 * @param {Object} data - Validated recipe data
 * @returns {string} HTML
 */
function buildRecipePageHtml(data) {
    const parts = [];
    if (data.type) parts.push(`<p><strong>Type:</strong> ${escapeHtml(data.type)}</p>`);
    if (data.category) parts.push(`<p><strong>Category:</strong> ${escapeHtml(data.category)}</p>`);
    if (data.skill) parts.push(`<p><strong>Skill:</strong> ${escapeHtml(data.skill)}</p>`);
    if (data.skillLevel != null) parts.push(`<p><strong>Skill Level:</strong> ${data.skillLevel}</p>`);
    if (data.workstation) parts.push(`<p><strong>Workstation:</strong> ${escapeHtml(data.workstation)}</p>`);
    if (data.processType) parts.push(`<p><strong>Process Type:</strong> ${escapeHtml(data.processType)}</p>`);
    if (data.processLevel != null && data.processLevel >= 0 && data.processLevel <= HEAT_MAX) {
        const label = data.processType === 'grind' ? (GRIND_LEVELS[data.processLevel] ?? data.processLevel) : (HEAT_LEVELS[data.processLevel] ?? data.processLevel);
        parts.push(`<p><strong>Process Level:</strong> ${escapeHtml(String(label))}</p>`);
    }
    if (data.heat != null && data.heat >= 0 && data.heat <= HEAT_MAX) parts.push(`<p><strong>Heat:</strong> ${HEAT_LEVELS[data.heat] ?? data.heat}</p>`);
    if (data.time != null && data.time >= 0) parts.push(`<p><strong>Time:</strong> ${data.time}</p>`);
    if (data.apparatusName) parts.push(`<p><strong>Apparatus:</strong> ${escapeHtml(data.apparatusName)}</p>`);
    if (data.containerName) parts.push(`<p><strong>Container:</strong> ${escapeHtml(data.containerName)}</p>`);
    if (data.toolName) parts.push(`<p><strong>Tool:</strong> ${escapeHtml(data.toolName)}</p>`);
    parts.push(`<p><strong>Result:</strong> ${escapeHtml(data.resultItemName ?? data.name)}</p>`);
    if (data.tags?.length) parts.push(`<p><strong>Tags:</strong> ${data.tags.map((t) => escapeHtml(String(t))).join(', ')}</p>`);
    if (data.description) parts.push(`<p><strong>Description:</strong> ${escapeHtml(data.description)}</p>`);
    if (data.ingredients?.length) {
        parts.push(`<p><strong>Ingredients:</strong></p><ul>`);
        for (const ing of data.ingredients) {
            const type = (ing.type || 'ingredient').charAt(0).toUpperCase() + (ing.type || 'ingredient').slice(1);
            parts.push(`<li>${escapeHtml(type)}: ${escapeHtml(ing.name)} (${ing.quantity ?? 1})</li>`);
        }
        parts.push(`</ul>`);
    }
    return parts.join('');
}

function escapeHtml(str) {
    if (str == null) return '';
    const s = String(str);
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

/**
 * Import recipes into the recipe journal
 * @param {Array} payloads - Array of recipe payloads
 * @param {Object} options
 * @param {string} options.journalUuid - Override journal UUID (optional)
 * @returns {Promise<Object>} { created, errors, total, successCount, errorCount }
 */
export async function importRecipes(payloads, options = {}) {
    const result = {
        created: [],
        errors: [],
        total: payloads.length,
        successCount: 0,
        errorCount: 0
    };

    let journalUuid = options.journalUuid ?? game.settings.get(MODULE.ID, 'recipeJournal') ?? '';
    if (!journalUuid) {
        const journal = await getOrCreateJournal(DEFAULT_RECIPE_JOURNAL_NAME);
        journalUuid = journal.uuid;
        await game.settings.set(MODULE.ID, 'recipeJournal', journalUuid);
    }

    const journal = await fromUuid(journalUuid);
    if (!journal || journal.documentName !== 'JournalEntry') {
        result.errorCount = payloads.length;
        payloads.forEach((p, i) => result.errors.push({ name: p?.name ?? `Recipe ${i + 1}`, error: 'Recipe journal not found. Create or configure it in module settings.', index: i }));
        return result;
    }

    for (let i = 0; i < payloads.length; i++) {
        const payload = payloads[i];
        const name = payload?.name ?? `Recipe ${i + 1}`;
        const validated = await validateRecipePayload(payload);
        if (!validated.valid) {
            result.errors.push({ name, error: validated.error, index: i });
            result.errorCount++;
            continue;
        }
        try {
            const html = buildRecipePageHtml(validated.data);
            const pages = await journal.createEmbeddedDocuments('JournalEntryPage', [
                {
                    name: validated.data.name,
                    type: 'text',
                    text: { content: html }
                }
            ]);
            const page = pages[0];
            if (page) {
                result.created.push({ name: validated.data.name, page, index: i });
                result.successCount++;
            } else {
                result.errors.push({ name, error: 'Failed to create journal page', index: i });
                result.errorCount++;
            }
        } catch (err) {
            result.errors.push({ name, error: err.message ?? String(err), index: i });
            result.errorCount++;
        }
    }

    if (result.successCount > 0) {
        const api = game.modules.get(MODULE.ID)?.api;
        if (api?.recipes?.refresh) await api.recipes.refresh();
    }

    return result;
}

/**
 * Import recipes from JSON text
 * @param {string} text
 * @param {Object} options
 * @returns {Promise<Object>}
 */
export async function importRecipesFromText(text, options = {}) {
    const payloads = await parseRecipeImportInput(text);
    return importRecipes(payloads, options);
}

/**
 * Show recipe import result notification
 * @param {Object} result - From importRecipes()
 * @param {string} moduleName
 */
export function showRecipeImportResult(result, moduleName = MODULE.NAME) {
    const { total, successCount, errorCount, created, errors } = result;
    const notify = (msg, isError = false) => {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(moduleName, msg, null, isError, false);
        } else if (ui?.notifications) {
            isError ? ui.notifications.error(msg) : ui.notifications.info(msg);
        } else {
            postDebug(moduleName, msg);
        }
    };
    if (errorCount === 0) {
        notify(`Successfully imported ${successCount} recipe${successCount !== 1 ? 's' : ''}`);
    } else if (successCount === 0) {
        notify(`Failed to import all ${total} recipe${total !== 1 ? 's' : ''}`, true);
    } else {
        notify(`Imported ${successCount} of ${total} recipe${total !== 1 ? 's' : ''} (${errorCount} error${errorCount !== 1 ? 's' : ''})`);
    }
    if (errors?.length) {
        errors.forEach(({ name, error, index }) => postError(moduleName, `Recipe Import Error: ${index + 1} (${name})`, error?.message ?? String(error)));
    }
    if (created?.length) {
        created.forEach(({ name, index }) => postDebug(moduleName, `Imported: ${index + 1}. ${name}`));
    }
}
