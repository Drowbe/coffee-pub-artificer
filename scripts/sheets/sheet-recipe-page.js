// ==================================================================
// ===== ARTIFICER RECIPE PAGE SHEET ================================
// ==================================================================
// The sheet for the `coffee-pub-artificer.recipe` page subtype.
//
// Extends the CONCRETE ProseMirror text page sheet, not the abstract
// JournalEntryPageTextSheet -- the abstract one defines no parts, so
// extending it renders neither the view content nor the editor.
//
// The recipe's description is the page's native text.content, so it keeps
// stock ProseMirror editing and view rendering. Everything else is a
// schema field on page.system and is edited through the recipe fields
// part inserted above the editor.
// ==================================================================

import { MODULE } from '../const.js';
import { ITEM_TYPES, PROCESS_TYPES, HEAT_LEVELS, GRIND_LEVELS } from '../schema-recipes.js';
import { RECIPE_RARITIES } from '../data/models/model-recipe-page.js';
import { getLastKnownEnabledCraftingSkillIds } from '../skills-rules.js';
import { ARTIFICER_TYPES } from '../schema-artificer-item.js';

const JournalEntryPageProseMirrorSheet = foundry.applications.sheets.journal.JournalEntryPageProseMirrorSheet;

/** Escape text for interpolation into the view-mode HTML block. */
function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

/**
 * Sheet for Artificer recipe journal pages.
 *
 * - EDIT: a recipe fields part sits between the standard header and the
 *   ProseMirror description editor.
 * - VIEW: the core view content part is `root: true`, so sibling parts are not
 *   an option; the rendered recipe block is prepended to the enriched content
 *   in `_prepareContentContext` instead.
 */
export class RecipePageSheet extends JournalEntryPageProseMirrorSheet {
    static DEFAULT_OPTIONS = {
        classes: ['artificer-recipe-page'],
        actions: {
            addIngredient: RecipePageSheet._onAddIngredient,
            removeIngredient: RecipePageSheet._onRemoveIngredient
        }
    };

    static EDIT_PARTS = {
        header: JournalEntryPageProseMirrorSheet.EDIT_PARTS.header,
        recipeFields: {
            template: `modules/${MODULE.ID}/templates/page-recipe-fields-edit.hbs`
        },
        content: JournalEntryPageProseMirrorSheet.EDIT_PARTS.content,
        footer: JournalEntryPageProseMirrorSheet.EDIT_PARTS.footer
    };

    /** @inheritDoc */
    async _preparePartContext(partId, context, options) {
        context = await super._preparePartContext(partId, context, options);
        if (partId !== 'recipeFields') return context;

        const system = this.document.system;
        context.system = system;

        // `selected` is precomputed rather than compared in the template: Handlebars
        // has no `eq` helper here and neither Foundry nor this module registers one,
        // so a template-side comparison would silently render every option unselected.
        const toOptions = (values, current) => values.map(v => ({
            value: v, label: v, selected: v === current
        }));

        context.itemTypes = toOptions(Object.values(ITEM_TYPES), system.type);
        context.processTypes = toOptions(PROCESS_TYPES, system.processType);
        context.rarities = toOptions(RECIPE_RARITIES, system.rarity);
        context.artificerTypes = Object.values(ARTIFICER_TYPES);

        // The process level vocabulary depends on the process type -- heat is
        // Off/Low/Medium/High, grind is Off/Coarse/Medium/Fine. Same value, two
        // meanings, so the labels have to follow the type rather than be fixed.
        const levels = system.processType === 'grind' ? GRIND_LEVELS : HEAT_LEVELS;
        context.processLevels = Object.entries(levels).map(([value, label]) => ({
            value: Number(value),
            label: `${value} - ${label}`,
            selected: Number(value) === system.processLevel
        }));

        // Skill ids come from the user's configured mapping, so this list differs
        // per world and can change while the world is live. Deliberately not a
        // schema `choices` -- see the note on `skill` in model-recipe-page.js.
        const skillIds = getLastKnownEnabledCraftingSkillIds() ?? [];
        context.skillOptions = toOptions(skillIds, system.skill);
        // A recipe may hold a skill the current mapping no longer enables. Show it
        // rather than silently re-pointing the recipe at whatever is first in the list.
        context.skillIsUnknown = Boolean(system.skill) && !skillIds.includes(system.skill);

        // Each row carries its own type options so the selected value is per-row.
        context.ingredients = (system.ingredients ?? []).map((ing, index) => ({
            ...ing,
            index,
            typeOptions: toOptions(Object.values(ARTIFICER_TYPES), ing.type)
        }));

        // <string-tags> takes a comma-joined string, not the array.
        context.traitsString = (system.traits ?? []).join(', ');
        return context;
    }

    /** Append a blank ingredient row. */
    static async _onAddIngredient(event) {
        event.preventDefault();
        await this.submit();
        const ingredients = Array.from(this.document.system.ingredients ?? []).map(i => ({ ...i }));
        ingredients.push({ type: ARTIFICER_TYPES.COMPONENT, family: '', name: '', quantity: 1 });
        await this.document.update({ 'system.ingredients': ingredients });
    }

    /** Remove one ingredient row by index. */
    static async _onRemoveIngredient(event, target) {
        event.preventDefault();
        const index = Number(target?.dataset?.index);
        if (!Number.isInteger(index)) return;
        await this.submit();
        const ingredients = Array.from(this.document.system.ingredients ?? [])
            .map(i => ({ ...i }))
            .filter((_, i) => i !== index);
        await this.document.update({ 'system.ingredients': ingredients });
    }

    /** @inheritDoc */
    _prepareSubmitData(event, form, formData, updateData) {
        const data = super._prepareSubmitData(event, form, formData, updateData);

        // `<string-tags>` submits a comma-separated STRING in some Foundry builds and
        // an ARRAY in others. `traits` is an ArrayField, so the string form fails
        // validation -- and a failed field rejects the ENTIRE document update, which
        // looks like "nothing saved" rather than "one field was wrong".
        const raw = foundry.utils.getProperty(data, 'system.traits');
        if (raw !== undefined) {
            const traits = typeof raw === 'string'
                ? raw.split(',').map(t => t.trim()).filter(Boolean)
                : Array.isArray(raw) ? raw.map(t => String(t).trim()).filter(Boolean) : [];
            foundry.utils.setProperty(data, 'system.traits', traits);
        }

        return data;
    }

    /** @inheritDoc */
    async _prepareContentContext(context, options) {
        await super._prepareContentContext(context, options);
        if (!this.isView) return context;

        const system = this.document.system;
        const row = (label, value) => {
            if (value == null || value === '') return '';
            return `<div class="artificer-recipe-row">`
                + `<span class="artificer-recipe-label">${escapeHtml(label)}</span>`
                + `<span class="artificer-recipe-value">${escapeHtml(value)}</span>`
                + `</div>`;
        };

        const levels = system.processType === 'grind' ? GRIND_LEVELS : HEAT_LEVELS;
        const processLabel = system.processType
            ? `${system.processType} - ${levels[system.processLevel] ?? system.processLevel}`
            : '';

        const ingredients = (system.ingredients ?? []).map(ing => {
            const qualifier = (ing.family || ing.type || '').trim();
            const prefix = qualifier ? `${escapeHtml(qualifier)}: ` : '';
            return `<li>${prefix}${escapeHtml(ing.name)} (${ing.quantity ?? 1})</li>`;
        }).join('');

        const block = `<section class="artificer-recipe-block">
            ${row('Result', system.resultItemName)}
            ${row('Traits', (system.traits ?? []).join(', '))}
            ${ingredients ? `<div class="artificer-recipe-row"><span class="artificer-recipe-label">Ingredients</span><ul class="artificer-recipe-ingredients">${ingredients}</ul></div>` : ''}
            ${row('Process', processLabel)}
            ${row('Time', system.time != null ? `${system.time}s` : '')}
            ${row('Apparatus', system.apparatusName)}
            ${row('Container', system.containerName)}
            ${row('Gold Cost', system.goldCost)}
            ${row('Work Hours', system.workHours)}
            ${row('Success DC', system.successDC)}
            ${row('Type', system.type)}
            ${row('Category', system.category)}
            ${row('Rarity', system.rarity)}
            ${row('Skill', system.skill)}
            ${row('Skill Level', system.skillLevel)}
            ${row('Skill Kit', system.skillKit)}
            ${row('Source', system.source)}
            ${row('License', system.license)}
        </section>`;

        context.text.enriched = block + (context.text.enriched || '');
        return context;
    }
}
