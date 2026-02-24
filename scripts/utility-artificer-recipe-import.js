// ==================================================================
// ===== ARTIFICER RECIPE IMPORT UTILITIES ==========================
// ==================================================================

import { MODULE } from './const.js';
import { getOrCreateJournal, extractNameFromUuidLink } from './utils/helpers.js';
import { ArtificerRecipe } from './data/models/model-recipe.js';
import { ITEM_TYPES, CRAFTING_SKILLS, HEAT_MAX, PROCESS_TYPES, SKILL_LEVEL_MIN, SKILL_LEVEL_MAX } from './schema-recipes.js';
import { resolveItemByName } from './utility-artificer-item.js';

/** Default journal name when none configured */
const DEFAULT_RECIPE_JOURNAL_NAME = 'Artificer Recipes';

/** Trim string for import; treat null, undefined, and the literal "null" as empty. */
function _str(val) {
    if (val == null) return '';
    const s = String(val).trim();
    return s === 'null' || s === 'undefined' ? '' : s;
}

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
    if (Array.isArray(rawData)) return { payloads: rawData, journalName: null };
    if (rawData && typeof rawData === 'object') {
        if (rawData.recipes && Array.isArray(rawData.recipes) && typeof rawData.recipeJournal === 'string') {
            return { payloads: rawData.recipes, journalName: rawData.recipeJournal.trim() || null };
        }
        const journalName = typeof rawData.recipeJournal === 'string' ? (rawData.recipeJournal.trim() || null) : null;
        if (journalName !== null) {
            const { recipeJournal: _drop, ...payload } = rawData;
            return { payloads: [payload], journalName };
        }
        return { payloads: [rawData], journalName: null };
    }
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
    if (payload.description == null || typeof payload.description !== 'string') {
        return { valid: false, error: `Recipe "${payload.name}" requires a "description" field (string)` };
    }
    const skill = payload.skill ?? CRAFTING_SKILLS.ALCHEMY;
    const apparatusName = payload.apparatusName ?? payload.containerName ?? payload.container ?? null;
    const containerName = payload.containerName ?? null;
    const skillKit = payload.skillKit ?? payload.toolName ?? payload.tool ?? null;
    const rawSkillLevel = payload.skillLevel ?? 1;
    const skillLevel = typeof rawSkillLevel === 'number' && rawSkillLevel >= SKILL_LEVEL_MIN && rawSkillLevel <= SKILL_LEVEL_MAX
        ? Math.round(rawSkillLevel) : 1;

    // Store names only—no world UUIDs. Recipes resolve items by name at runtime (compendia + world).
    // Apply defaults when omitted: apparatus→Mixing Bowl, container→Vial, source→Artificer; processType→heat, processLevel→0.
    const data = {
        name: payload.name,
        type: payload.type ?? ITEM_TYPES.CONSUMABLE,
        category: payload.category ?? '',
        skill,
        skillLevel,
        ingredients: ingredients.map((i) => {
            const obj = typeof i === 'object' ? i : { name: String(i), quantity: 1 };
            const rawName = obj.name ? String(obj.name) : '';
            return {
                type: obj.type,
                family: obj.family,
                name: extractNameFromUuidLink(rawName),
                quantity: (obj.quantity ?? 1) >= 0 ? Number(obj.quantity) : 1
            };
        }),
        resultItemName: resultItemName.trim(),
        traits: Array.isArray(payload.traits) ? payload.traits : (Array.isArray(payload.tags) ? payload.tags : []),
        description: String(payload.description),
        processType: payload.processType != null && PROCESS_TYPES.includes(String(payload.processType).toLowerCase()) ? String(payload.processType).toLowerCase() : 'heat',
        processLevel: payload.processLevel != null && Number(payload.processLevel) >= 0 && Number(payload.processLevel) <= HEAT_MAX ? Math.round(Number(payload.processLevel)) : 0,
        time: Math.min(120, payload.time != null && Number(payload.time) >= 0 ? Number(payload.time) : 20),
        apparatusName: apparatusName?.trim() || 'Mixing Bowl',
        containerName: containerName?.trim() || 'Vial',
        skillKit: skillKit?.trim() || null,
        goldCost: payload.goldCost != null ? Number(payload.goldCost) : null,
        workHours: payload.workHours != null ? Number(payload.workHours) : null,
        source: _str(payload.source ?? payload.Source) || 'Artificer',
        license: _str(payload.license ?? payload.License)
    };
    const recipe = new ArtificerRecipe({ ...data, id: `temp-${foundry.utils.randomID()}` });
    if (!recipe.validate?.()) {
        return { valid: false, error: `Recipe "${payload.name}" failed validation` };
    }
    return { valid: true, data };
}

/**
 * Build HTML content for a recipe journal page (matches RecipeParser format).
 * Always outputs every recipe field so authors can see what is possible, even when empty.
 * Exported for recipe clean/migrate macro.
 * @param {Object} data - Validated recipe data (name, resultItemName, skill, skillLevel, skillKit, ingredients, description, etc.)
 * @returns {string} HTML
 */
export function buildRecipePageHtml(data) {
    const v = (x) => (x != null && x !== '' ? escapeHtml(String(x)) : '');
    const processLevel = data.processLevel != null && data.processLevel >= 0 && data.processLevel <= HEAT_MAX ? data.processLevel : 0;
    const section = (title, content) => `<h4>${title}</h4><p></p>${content}<p></p><hr><p></p>`;
    const parts = [];

    parts.push(section('CORE DATA', [
        `<p><strong>Name:</strong> ${v(data.name)}</p>`,
        `<p><strong>Result:</strong> ${v(data.resultItemName ?? data.name)}</p>`,
        `<p><strong>Traits:</strong> ${(data.traits ?? []).length ? (data.traits ?? []).map((t) => escapeHtml(String(t))).join(', ') : ''}</p>`
    ].join('')));

    parts.push(section('ABOUT THE RECIPE', [
        `<p><strong>Description:</strong></p>`,
        `<div class="recipe-description">${data.description ? String(data.description) : ''}</div>`
    ].join('')));

    const ingredientItems = data.ingredients?.length
        ? data.ingredients.map((ing) => {
            const label = (ing.family || ing.type || 'Component').trim() || 'Component';
            const typeLabel = label.charAt(0).toUpperCase() + label.slice(1);
            return `<li>${escapeHtml(typeLabel)}: ${escapeHtml(ing.name)} (${ing.quantity ?? 1})</li>`;
        }).join('')
        : '';
    parts.push(section('PREPARATION', [
        `<p><strong>Ingredients:</strong></p>`,
        `<ul>${ingredientItems}</ul>`,
        `<p><strong>Process Type:</strong> ${v(data.processType)}</p>`,
        `<p><strong>Process Level:</strong> ${processLevel}</p>`,
        `<p><strong>Time:</strong> ${data.time != null && data.time >= 0 ? data.time : ''}</p>`,
        `<p><strong>Apparatus:</strong> ${v(data.apparatusName)}</p>`,
        `<p><strong>Container:</strong> ${v(data.containerName)}</p>`,
        `<p><strong>Gold Cost:</strong> ${data.goldCost != null ? data.goldCost : ''}</p>`,
        `<p><strong>Work Hours:</strong> ${data.workHours != null ? data.workHours : ''}</p>`
    ].join('')));

    parts.push(section('METADATA', [
        `<p><strong>Type:</strong> ${v(data.type)}</p>`,
        `<p><strong>Category:</strong> ${v(data.category)}</p>`,
        `<p><strong>Skill:</strong> ${v(data.skill)}</p>`,
        `<p><strong>Skill Level:</strong> ${data.skillLevel != null ? data.skillLevel : ''}</p>`,
        `<p><strong>Skill Kit:</strong> ${v(data.skillKit)}</p>`,
        `<p><strong>Source:</strong> ${v(data.source)}</p>`,
        `<p><strong>License:</strong> ${v(data.license)}</p>`
    ].join('')));

    return parts.join('') + '<p></p><p></p><p></p>';
}

export function escapeHtml(str) {
    if (str == null) return '';
    const s = String(str);
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

/**
 * Find or create a world journal by name (optionally in folder).
 * @param {string} journalName - Exact journal name
 * @returns {Promise<JournalEntry|null>}
 */
async function findOrCreateRecipeJournal(journalName) {
    const name = (journalName || '').trim() || DEFAULT_RECIPE_JOURNAL_NAME;
    const folderId = game.settings.get(MODULE.ID, 'recipeJournalFolder') ?? '';
    if (folderId && game.journal) {
        const inFolder = game.journal.find((j) => j.folder?.id === folderId && (j.name || '').trim() === name);
        if (inFolder) return inFolder;
    }
    const anywhere = game.journal?.find((j) => (j.name || '').trim() === name);
    if (anywhere) return anywhere;
    const createOpts = folderId && game.folders?.get(folderId) ? { folder: folderId } : {};
    return getOrCreateJournal(name, createOpts);
}

/**
 * Import recipes into the recipe journal
 * @param {Array} payloads - Array of recipe payloads
 * @param {Object} options
 * @param {string} [options.journalUuid] - Override: use this journal UUID (optional)
 * @param {string} [options.journalName] - Override: find or create journal with this name (optional)
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

    let journal;
    if (options.journalUuid) {
        journal = await fromUuid(options.journalUuid);
    } else {
        const journalName = options.journalName ?? game.settings.get(MODULE.ID, 'recipeJournalName') ?? DEFAULT_RECIPE_JOURNAL_NAME;
        journal = await findOrCreateRecipeJournal(journalName);
    }

    if (!journal || journal.documentName !== 'JournalEntry') {
        result.errorCount = payloads.length;
        payloads.forEach((p, i) => result.errors.push({ name: p?.name ?? `Recipe ${i + 1}`, error: 'Recipe journal not found or could not be created. Check module settings (recipe journal name).', index: i }));
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
 * @param {string} text - JSON string: array of recipes, or single recipe object, or { recipeJournal: string, recipes: array }
 * @param {Object} options - { journalName?: string, journalUuid?: string }
 * @returns {Promise<Object>}
 */
export async function importRecipesFromText(text, options = {}) {
    const parsed = await parseRecipeImportInput(text);
    const payloads = parsed.payloads ?? (Array.isArray(parsed) ? parsed : [parsed]);
    const opts = { ...options };
    if (parsed.journalName) opts.journalName = parsed.journalName;
    return importRecipes(payloads, opts);
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
            console.warn(`[${moduleName}] ${msg}`);
        }
    };
    if (errorCount === 0) {
        notify(`Successfully imported ${successCount} recipe${successCount !== 1 ? 's' : ''}`);
    } else if (successCount === 0) {
        notify(`Failed to import all ${total} recipe${total !== 1 ? 's' : ''}`, true);
    } else {
        notify(`Imported ${successCount} of ${total} recipe${total !== 1 ? 's' : ''} (${errorCount} error${errorCount !== 1 ? 's' : ''})`);
    }
    if (errors?.length && typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        errors.forEach(({ name, error, index }) => BlacksmithUtils.postConsoleAndNotification(moduleName, `Recipe Import Error: ${index + 1} (${name})`, error?.message ?? String(error), true, false));
    }
    if (created?.length && typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        created.forEach(({ name, index }) => BlacksmithUtils.postConsoleAndNotification(moduleName, `Imported: ${index + 1}. ${name}`, null, true, false));
    }
}
