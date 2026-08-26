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
//
// Every vocabulary offered here comes from real data -- the world's skills
// mapping and the Artificer item cache -- rather than a hardcoded list, so
// the dropdowns cannot drift from what the world actually contains.
// ==================================================================

import { MODULE } from '../const.js';
import { ITEM_TYPES, PROCESS_TYPES, HEAT_LEVELS, GRIND_LEVELS, SKILL_LEVEL_MIN, SKILL_LEVEL_MAX } from '../schema-recipes.js';
import { RECIPE_RARITIES } from '../data/models/model-recipe-page.js';
import { getLastKnownEnabledCraftingSkillIds, loadSkillsDetails, buildCraftingKitNameSet } from '../skills-rules.js';
import { ARTIFICER_TYPES, FAMILIES_BY_TYPE } from '../schema-artificer-item.js';
import { getAllRecordsFromCache } from '../cache/cache-items.js';

const JournalEntryPageProseMirrorSheet = foundry.applications.sheets.journal.JournalEntryPageProseMirrorSheet;

/** Escape text for interpolation into the view-mode HTML block. */
function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

/**
 * name -> img for everything in the item cache, for rendering a filled slot.
 * Deliberately NOT a filter or a vocabulary: a recipe may name any item, so this
 * only decorates what an author already chose. A name the cache has not seen
 * simply gets no icon.
 */
function cachedImages() {
    const images = new Map();
    for (const record of getAllRecordsFromCache()) {
        if (record?.name && !images.has(record.name)) images.set(record.name, record.img ?? '');
    }
    return images;
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
            removeIngredient: RecipePageSheet._onRemoveIngredient,
            clearSlot: RecipePageSheet._onClearSlot
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
            value: v, label: v, selected: String(v) === String(current)
        }));

        context.itemTypes = toOptions(Object.values(ITEM_TYPES), system.type);
        context.processTypes = toOptions(PROCESS_TYPES, system.processType);
        context.rarities = toOptions(RECIPE_RARITIES, system.rarity);

        // The process level vocabulary depends on the process type -- heat is
        // Off/Low/Medium/High, grind is Off/Coarse/Medium/Fine. Same value, two
        // meanings, so the labels have to follow the type rather than be fixed.
        const levels = system.processType === 'grind' ? GRIND_LEVELS : HEAT_LEVELS;
        context.processLevels = Object.entries(levels).map(([value, label]) => ({
            value: Number(value),
            label: `${value} — ${label}`,
            selected: Number(value) === system.processLevel
        }));

        context.skillLevels = Array.from(
            { length: SKILL_LEVEL_MAX - SKILL_LEVEL_MIN + 1 },
            (_, i) => SKILL_LEVEL_MIN + i
        ).map(n => ({ value: n, label: String(n), selected: n === system.skillLevel }));

        // Skill ids come from the user's configured mapping, so this list differs
        // per world and can change while the world is live. Deliberately not a
        // schema `choices` -- see the note on `skill` in model-recipe-page.js.
        const skillIds = getLastKnownEnabledCraftingSkillIds() ?? [];
        context.skillOptions = toOptions(skillIds, system.skill);
        // A recipe may hold a skill the current mapping no longer enables. Show it
        // rather than silently re-pointing the recipe at whatever is first in the list.
        context.skillIsUnknown = Boolean(system.skill) && !skillIds.includes(system.skill);

        // Kits are the `skillKit` of each enabled skill plus its declared extras.
        let kitNames = [];
        try {
            kitNames = Array.from(buildCraftingKitNameSet(await loadSkillsDetails())).sort();
        } catch {
            // A broken skills mapping is reported to the GM elsewhere; an empty kit
            // list degrades the field to free text rather than blocking the sheet.
        }
        context.kitOptions = toOptions(kitNames, system.skillKit);
        context.kitIsUnknown = Boolean(system.skillKit) && !kitNames.includes(system.skillKit);

        // EVERY item-valued field is a drop slot, and none of them filters what may
        // be dropped. "Family is Apparatus" describes what shipped, not a rule -- a GM
        // dropping a Sack as a container should just work, and the set of methods
        // (heat, grind, and whatever comes next) will want vessels nobody has named yet.
        // Filtering here would bake today's compendium into tomorrow's constraint.
        const images = cachedImages();
        const slot = (name) => ({
            name: name ?? '',
            img: name ? (images.get(name) ?? '') : '',
            empty: !name
        });

        context.resultSlot = slot(system.resultItemName);
        context.apparatusSlot = slot(system.apparatusName);
        context.containerSlot = slot(system.containerName);

        // Category is free text by design, but the Creation families are what it
        // almost always holds, so they are offered as suggestions rather than rules.
        context.categorySuggestions = FAMILIES_BY_TYPE[ARTIFICER_TYPES.CREATION] ?? [];

        // Type and family are DERIVED from the dropped item's flags, not authored.
        // They stay visible because they explain why an ingredient matches, and they
        // ride along as hidden inputs so the array round-trips intact on submit.
        // An item with no Artificer flags leaves both blank and matches by name only,
        // which the model already supports.
        context.ingredients = (system.ingredients ?? []).map((ing, index) => ({
            ...ing,
            index,
            img: images.get(ing.name) ?? '',
            qualifier: [ing.type, ing.family].filter(Boolean).join(' · ')
        }));

        // Traits an author can pick rather than retype, gathered from what the
        // world's Artificer items actually carry. Ones already on this recipe are
        // dropped so the picker only ever offers something new.
        const used = new Set(system.traits ?? []);
        const vocabulary = new Set();
        for (const record of getAllRecordsFromCache()) {
            for (const tag of record?.tags ?? []) {
                const trait = String(tag).trim();
                if (trait && !used.has(trait)) vocabulary.add(trait);
            }
        }
        context.traitVocabulary = Array.from(vocabulary).sort((a, b) => a.localeCompare(b));

        // <string-tags> takes a comma-joined string, not the array.
        context.traitsString = (system.traits ?? []).join(', ');
        return context;
    }

    /** Empty an item slot. */
    static async _onClearSlot(event, target) {
        event.preventDefault();
        const field = target?.dataset?.field;
        if (!field) return;
        await this.submit();
        await this.document.update({ [`system.${field}`]: '' });
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
    _onRender(context, options) {
        super._onRender?.(context, options);
        this.#bindDropZones();
        this.#bindTraitPicker();
    }

    /**
     * The "add an existing trait" select beside the traits field.
     *
     * Writes through the document rather than poking at <string-tags> internals:
     * the element's chip state is private, and going through an update keeps this
     * identical to how ingredients are added.
     */
    #bindTraitPicker() {
        const select = this.element?.querySelector('.arf-trait-picker');
        if (!select || select.dataset.pickerBound) return;
        select.dataset.pickerBound = 'true';

        select.addEventListener('change', async () => {
            const trait = select.value;
            select.value = '';
            if (!trait) return;
            await this.submit();
            const traits = Array.from(this.document.system.traits ?? []);
            if (traits.includes(trait)) return;
            traits.push(trait);
            await this.document.update({ 'system.traits': traits });
        });
    }

    /**
     * Wire drag-and-drop onto every element marked `data-drop`.
     *
     * `data-drop="ingredient"` appends a row carrying the dropped item's Artificer
     * type and family, which is what recipe matching needs; any other value names
     * the system field to fill with the dropped item's name. Names rather than
     * UUIDs, because recipes resolve by name at craft time.
     */
    #bindDropZones() {
        for (const zone of this.element?.querySelectorAll('[data-drop]') ?? []) {
            if (zone.dataset.dropBound) continue;
            zone.dataset.dropBound = 'true';

            zone.addEventListener('dragover', (event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
                zone.classList.add('arf-drag-active');
            });
            zone.addEventListener('dragleave', () => zone.classList.remove('arf-drag-active'));

            zone.addEventListener('drop', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                zone.classList.remove('arf-drag-active');
                try {
                    const TextEditor = foundry.applications.ux.TextEditor.implementation;
                    const data = TextEditor?.getDragEventData?.(event)
                        ?? JSON.parse(event.dataTransfer.getData('text/plain'));
                    const doc = data?.uuid ? await fromUuid(data.uuid) : null;
                    if (!doc?.name) return;

                    await this.submit();
                    const target = zone.dataset.drop;

                    if (target !== 'ingredient') {
                        await this.document.update({ [`system.${target}`]: doc.name });
                        return;
                    }

                    const flags = doc.flags?.[MODULE.ID] ?? {};
                    const ingredients = Array.from(this.document.system.ingredients ?? []).map(i => ({ ...i }));
                    ingredients.push({
                        type: flags.artificerType ?? ARTIFICER_TYPES.COMPONENT,
                        family: flags.artificerFamily ?? '',
                        name: doc.name,
                        quantity: 1
                    });
                    await this.document.update({ 'system.ingredients': ingredients });
                } catch (error) {
                    console.error(`${MODULE.ID} | Error handling recipe sheet drop:`, error);
                }
            });
        }
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
            ? `${system.processType} — ${levels[system.processLevel] ?? system.processLevel}`
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
