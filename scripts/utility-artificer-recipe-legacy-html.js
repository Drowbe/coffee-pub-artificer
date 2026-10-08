// ==================================================================
// ===== ARTIFICER RECIPE PAGE HTML (LEGACY MAINTENANCE ONLY) =========
// ==================================================================
// Recipe IMPORT no longer lives here -- it goes entirely through Blacksmith's
// Unified Import window (scripts/declarations/declaration-artificer-recipe.js
// is the declaration it imports against). Track B: recipes work like items
// already did, no bespoke Artificer import window.
//
// What's left here is the HTML BUILDER for the legacy `type: 'text'` recipe
// page format. It is NOT part of import -- it is used only by
// RecipeStorage's maintenance passes (cleanAndRewriteRecipePages,
// applyPotionBrewingData in data/storage/storage-recipes.js) that rewrite
// EXISTING legacy pages in place. A world with no legacy pages left never
// calls this; it stays exported for a world that still has some.
// ==================================================================

import { HEAT_MAX } from './schema-recipes.js';

/**
 * Build HTML content for a recipe journal page (matches RecipeParser format).
 * Always outputs every recipe field so authors can see what is possible, even when empty.
 * LEGACY FORMAT ONLY -- see header. Not used by import.
 * @param {Object} data - Recipe data (name, resultItemName, skill, skillLevel, skillKit, ingredients, description, etc.)
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
        `<p><strong>Work Hours:</strong> ${data.workHours != null ? data.workHours : ''}</p>`,
        `<p><strong>Success DC:</strong> ${data.successDC != null ? data.successDC : ''}</p>`
    ].join('')));

    parts.push(section('METADATA', [
        `<p><strong>Type:</strong> ${v(data.type)}</p>`,
        `<p><strong>Category:</strong> ${v(data.category)}</p>`,
        `<p><strong>Rarity:</strong> ${v(data.rarity)}</p>`,
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
