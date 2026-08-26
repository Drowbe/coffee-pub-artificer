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
import { ITEM_TYPES, SKILL_LEVEL_MIN, SKILL_LEVEL_MAX } from '../schema-recipes.js';
import { getProcess, getProcessLevel, PROCESS_LEVEL_MAX } from '../systems/process-definitions.js';
import { RECIPE_RARITIES, GENERATED_PREPARATION_ATTR, RECIPE_SECTIONS } from '../data/models/model-recipe-page.js';
import { getLastKnownEnabledCraftingSkillIds, loadSkillsDetails, buildCraftingKitNameSet } from '../skills-rules.js';
import { ARTIFICER_TYPES, FAMILIES_BY_TYPE, PROCESS_FAMILY, ARTIFICER_FLAG_KEYS } from '../schema-artificer-item.js';
import { getAllRecordsFromCache } from '../cache/cache-items.js';
import { bindTraitPicker } from '../systems/trait-picker.js';

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
 * Flatten a traits value into clean single traits.
 *
 * Accepts an array, a comma-joined string, or an array whose entries are
 * themselves comma-joined -- the last being how the old <string-tags> round trip
 * stored a whole list as ONE trait. Splitting on read repairs those in place.
 */
function splitTraits(value) {
    const raw = Array.isArray(value) ? value : [value];
    return raw
        .flatMap(entry => String(entry ?? '').split(','))
        .map(entry => entry.trim())
        .filter(Boolean);
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
        // A recipe has a lot of fields AND a long description; the stock page
        // window leaves the editor a few lines tall.
        position: { width: 800, height: 900 },
        actions: {
            removeIngredient: RecipePageSheet._onRemoveIngredient,
            clearSlot: RecipePageSheet._onClearSlot,
            removeTrait: RecipePageSheet._onRemoveTrait,
            generateInstructions: RecipePageSheet._onGenerateInstructions
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

        context.rarities = toOptions(RECIPE_RARITIES, system.rarity);

        // The intensity vocabulary belongs to the PROCESS, not to a branch on its
        // name: Off/Low/Medium/High and Off/Coarse/Medium/Fine were two hardcoded
        // maps chosen by an `if`. A process item supplies its own four labels.
        // Declared here, above its first use -- it is also read by the process slot
        // further down, which is where it was mistakenly declared.
        const process = getProcess(system.processType);
        context.processLevels = process.levels.map((level, index) => ({
            value: index,
            label: `${index} — ${level.label}`,
            selected: index === system.processLevel
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

        // Every item-valued field is a drop slot. Result, apparatus and container
        // filter NOTHING -- "family is Apparatus" describes what shipped, not a rule,
        // and a GM dropping a Sack as a container should just work.
        //
        // The PROCESS slot is the one exception, and it is not a contradiction. Those
        // three are ROLES any item can fill. A process is a definition object: an item
        // without process flags has no levels, no animation and no intensity to offer,
        // so it is rejected because it cannot function, not because of what it is.
        const images = cachedImages();
        const slot = (name) => ({
            name: name ?? '',
            img: name ? (images.get(name) ?? '') : '',
            empty: !name
        });

        context.resultSlot = slot(system.resultItemName);
        context.apparatusSlot = slot(system.apparatusName);
        context.containerSlot = slot(system.containerName);
        // Labelled with the process's own display name, so a slot holding a legacy
        // `heat` string still reads as "Heat" rather than as a raw id.
        context.processSlot = { ...slot(system.processType), label: system.processType ? process.label : '' };

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
        const used = new Set(splitTraits(system.traits));
        const vocabulary = new Set();
        for (const record of getAllRecordsFromCache()) {
            for (const tag of record?.tags ?? []) {
                const trait = String(tag).trim();
                if (trait && !used.has(trait)) vocabulary.add(trait);
            }
        }
        // Held on the instance as well: the picker's callback reads it after render.
        this.#traitVocabulary = Array.from(vocabulary).sort((a, b) => a.localeCompare(b));
        context.traitVocabulary = this.#traitVocabulary;

        // Chips are rendered by us rather than by <string-tags>: the element puts its
        // chips inside its own box, which forced the trait row to span the width and
        // read as free text. Nothing about traits is submitted as a form field either
        // -- every change is staged, so the stored array is never re-derived from a
        // joined string, which is what stored a whole list as one trait.
        context.traitChips = splitTraits(system.traits);
        return context;
    }

    /**
     * A change staged by an action, applied by the next `_prepareSubmitData`.
     *
     * WHY: an action that calls `submit()` and then `document.update()` triggers
     * TWO renders in a row. The second tears down the DOM while ProseMirror is
     * still building the editor, and its menu throws on a detached node. Staging
     * the change means one submit, one update, one render.
     * @type {object|null}
     */
    #staged = null;

    /** Known traits, rebuilt each render and read live by the trait picker. */
    #traitVocabulary = [];

    /**
     * Stage a change and flush the form in a single update, then force a re-render.
     *
     * The re-render is NOT optional. `JournalEntryPageProseMirrorSheet._canRender`
     * refuses to re-render while the editor is dirty, to protect in-progress typing
     * (`foundry.mjs`, `_canRender` -> `!this._isEditorDirty()`). So the document
     * updates and the view reflects it, while the open edit sheet keeps showing the
     * old state -- chips that do not appear, generated instructions that never land
     * in the editor. `resync` is the documented way past that guard, and it is safe
     * here precisely because `submit()` has just captured the editor's content into
     * the same update.
     *
     * It must also be the ONLY render. `_processSubmitData` below suppresses the
     * update's automatic one, because two renders detach the <prose-mirror> element
     * while its async `#activateEditor` is still running -- the editor finishes,
     * ProseMirrorMenu.render looks its own node up by id, finds nothing, and throws
     * on `null.replaceWith`.
     */
    async #stage(changes) {
        this.#staged = changes;
        try {
            await this.submit();
        } finally {
            this.#staged = null;
        }
        await this.render({ resync: true });
    }

    /** Remove one trait chip. */
    static async _onRemoveTrait(event, target) {
        event.preventDefault();
        const trait = target?.dataset?.trait;
        if (!trait) return;
        const traits = splitTraits(this.document.system.traits).filter(t => t !== trait);
        await this.#stage({ 'system.traits': traits });
    }

    /** Shared by the picker and any future caller. */
    async #addTrait(trait) {
        const traits = splitTraits(this.document.system.traits);
        if (traits.includes(trait)) return;
        traits.push(trait);
        await this.#stage({ 'system.traits': traits });
    }

    /** Empty an item slot. */
    static async _onClearSlot(event, target) {
        event.preventDefault();
        const field = target?.dataset?.field;
        if (!field) return;
        await this.#stage({ [`system.${field}`]: '' });
    }

    /** Remove one ingredient row by index. */
    static async _onRemoveIngredient(event, target) {
        event.preventDefault();
        const index = Number(target?.dataset?.index);
        if (!Number.isInteger(index)) return;
        const ingredients = Array.from(this.document.system.ingredients ?? [])
            .map(i => ({ ...i }))
            .filter((_, i) => i !== index);
        await this.#stage({ 'system.ingredients': ingredients });
    }

    /**
     * Build a Preparation block from the structured fields.
     *
     * Deterministic prose, not a summary: it states what the fields already say, in
     * the order a crafter would do it. The point is to save typing the obvious part,
     * leaving the author free to rewrite it.
     */
    #buildPreparationHtml(system) {
        const steps = [];

        const ingredients = (system.ingredients ?? []).filter(i => i?.name);
        if (ingredients.length) {
            const list = ingredients
                .map(i => `${escapeHtml(i.name)}${(i.quantity ?? 1) > 1 ? ` &times;${i.quantity}` : ''}`)
                .join(', ');
            steps.push(`Gather ${list}.`);
        }

        if (system.apparatusName) {
            steps.push(`Prepare the ${escapeHtml(system.apparatusName)}.`);
        }

        if (system.processType) {
            const intensity = getProcessLevel(system.processType, system.processLevel).label;
            const how = intensity && intensity !== 'Off'
                ? `on ${escapeHtml(String(intensity).toLowerCase())}`
                : '';
            const duration = system.time != null ? ` for ${system.time} seconds` : '';
            steps.push(`Work the mixture &mdash; ${escapeHtml(system.processType)} ${how}${duration}.`.replace(/\s+/g, ' '));
        }

        if (system.skill) {
            const dc = system.successDC != null ? `, DC ${system.successDC}` : '';
            const kit = system.skillKit ? ` using ${escapeHtml(system.skillKit)}` : '';
            steps.push(`Make a ${escapeHtml(system.skill)} check at level ${system.skillLevel ?? 1}${dc}${kit}.`);
        }

        if (system.containerName) {
            steps.push(`Decant the result into the ${escapeHtml(system.containerName)}, which is consumed.`);
        }

        if (system.resultItemName) {
            const hours = system.workHours != null ? ` Total work: ${system.workHours} hours.` : '';
            const gold = system.goldCost != null ? ` Additional cost: ${system.goldCost} gp.` : '';
            steps.push(`On success you produce ${escapeHtml(system.resultItemName)}.${hours}${gold}`);
        }

        const body = steps.length
            ? `<ul>${steps.map(step => `<li>${step}</li>`).join('')}</ul>`
            : '<p><em>Fill in the recipe fields above, then generate again.</em></p>';

        return `<section ${GENERATED_PREPARATION_ATTR}="preparation">${body}</section>`;
    }

    /**
     * Replace the generated Preparation block, or append one if there is none.
     *
     * Finds the block by OUR OWN marker attribute rather than by heading text. The
     * old HTML parser matched on labels, and renaming one silently dropped a field;
     * a marker we write ourselves cannot be renamed out from under us, and prose the
     * author wrote outside the block is never touched.
     */
    static async _onGenerateInstructions(event) {
        event.preventDefault();
        // Staged with a marker rather than a value: the content depends on the
        // form's PENDING field values, which only `_prepareSubmitData` can see.
        await this.#stage({ __generateInstructions: true });
        ui.notifications.info('Preparation instructions generated.');
    }

    /**
     * Splice a freshly generated block into existing prose.
     *
     * Finds the block by OUR OWN marker attribute rather than by heading text. The
     * old HTML parser matched on labels, and renaming one silently dropped a field;
     * a marker we write ourselves cannot be renamed out from under us, and prose the
     * author wrote outside the block is never touched.
     */
    #spliceGenerated(current, generated) {
        const doc = new DOMParser().parseFromString(String(current ?? ''), 'text/html');

        // Already generated once: replace in place and leave everything else alone.
        const existing = doc.body.querySelector(`[${GENERATED_PREPARATION_ATTR}="preparation"]`);
        if (existing) {
            existing.outerHTML = generated;
            return doc.body.innerHTML;
        }

        // No marker. Rather than bolting a block onto the end, lay out the sections a
        // recipe is expected to have -- Description, Preparation, Use, Notes -- keeping
        // any heading the author already wrote and its content beneath it.
        const headings = new Map();
        for (const node of doc.body.querySelectorAll('h1, h2, h3, h4')) {
            headings.set(node.textContent.trim().toLowerCase(), node);
        }

        // Nothing recognisable to preserve: emit the full outline.
        if (!headings.size) {
            const outline = RECIPE_SECTIONS.map(section => `<h3>${section.heading}</h3>`
                + (section.generated ? generated : section.body)).join('');
            const prose = String(current ?? '').trim();
            return prose ? `${prose}${outline}` : outline;
        }

        // A Preparation heading exists: put the block directly under it.
        const preparation = headings.get('preparation');
        if (preparation) {
            preparation.insertAdjacentHTML('afterend', generated);
            return doc.body.innerHTML;
        }

        // Headings exist but none is Preparation: append the missing sections.
        const missing = RECIPE_SECTIONS
            .filter(section => !headings.has(section.heading.toLowerCase()))
            .map(section => `<h3>${section.heading}</h3>`
                + (section.generated ? generated : section.body)).join('');
        return doc.body.innerHTML + missing;
    }

    /** @inheritDoc */
    _onRender(context, options) {
        super._onRender?.(context, options);
        this.#bindDropZones();
        this.#bindTraitPicker();
    }

    /**
     * The trait input beside the chips.
     *
     * The SAME control as the Artificer Item window -- see systems/trait-picker.js.
     * Writes through the document rather than manipulating the chip markup: the
     * chips are rendered from context, so staging an update and re-rendering keeps
     * one source of truth.
     */
    #bindTraitPicker() {
        const root = this.element;
        bindTraitPicker({
            input: root?.querySelector('#arf-trait-input'),
            suggestionsEl: root?.querySelector('#arf-trait-suggestions'),
            clearButton: root?.querySelector('.arf-trait-picker .artificer-tag-input-clear'),
            candidates: () => this.#traitVocabulary,
            selected: () => splitTraits(this.document.system.traits),
            onAdd: (trait) => { void this.#addTrait(trait); }
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

                    const target = zone.dataset.drop;

                    // The ONE slot that checks what it is given. See the note in
                    // _preparePartContext: an item with no process flags has no levels,
                    // no animation and no intensity to offer, so accepting it would
                    // produce a recipe that silently cannot craft.
                    if (target === 'processType') {
                        const flags = doc.flags?.[MODULE.ID] ?? {};
                        const levels = flags[ARTIFICER_FLAG_KEYS.PROCESS_LEVELS];
                        const isProcess = flags[ARTIFICER_FLAG_KEYS.FAMILY] === PROCESS_FAMILY
                            && Array.isArray(levels) && levels.length > 0;
                        if (!isProcess) {
                            ui.notifications.warn(`${doc.name} is not a Process. Drop a Tool from the Process family.`);
                            return;
                        }
                        await this.#stage({ 'system.processType': doc.name });
                        return;
                    }

                    if (target !== 'ingredient') {
                        await this.#stage({ [`system.${target}`]: doc.name });
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
                    await this.#stage({ 'system.ingredients': ingredients });
                } catch (error) {
                    console.error(`${MODULE.ID} | Error handling recipe sheet drop:`, error);
                }
            });
        }
    }

    /**
     * @inheritDoc
     * While an action is staging, this sheet owns the render: the update is told not
     * to trigger one so `#stage` can issue a single `resync` render instead. Two
     * renders race the editor's asynchronous activation. See `#stage`.
     */
    async _processSubmitData(event, form, submitData, options = {}) {
        const updateOptions = this.#staged ? { ...options, render: false } : options;
        return super._processSubmitData(event, form, submitData, updateOptions);
    }

    /** @inheritDoc */
    _prepareSubmitData(event, form, formData, updateData) {
        const data = super._prepareSubmitData(event, form, formData, updateData);

        // Traits are never submitted as a form field -- the chips are rendered by us
        // and every change is staged. Anything arriving here under that key came from
        // a joined string and would otherwise store the whole list as ONE trait.
        const raw = foundry.utils.getProperty(data, 'system.traits');
        if (raw !== undefined) foundry.utils.setProperty(data, 'system.traits', splitTraits(raw));

        // Apply whatever an action staged, on top of the form's own values. This is
        // the second half of the one-update rule: the action does not write, it
        // describes what should change and this carries it into the same update.
        if (this.#staged) {
            for (const [path, value] of Object.entries(this.#staged)) {
                if (path === '__generateInstructions') continue;
                foundry.utils.setProperty(data, path, value);
            }

            // Instructions are generated HERE because only here are the pending form
            // values visible -- generating from the saved document would describe the
            // recipe as it was before the author's unsaved edits.
            if (this.#staged.__generateInstructions) {
                const system = foundry.utils.mergeObject(
                    this.document.system.toObject(),
                    foundry.utils.getProperty(data, 'system') ?? {},
                    { inplace: false }
                );
                const current = foundry.utils.getProperty(data, 'text.content')
                    ?? this.document.text?.content ?? '';
                foundry.utils.setProperty(data, 'text.content',
                    this.#spliceGenerated(current, this.#buildPreparationHtml(system)));
            }
        }

        // Remember the provenance for the next new recipe. A convenience only: it
        // prefills a NEW page's field, and is never applied to an existing one.
        for (const [field, key] of [['source', 'lastRecipeSource'], ['license', 'lastRecipeLicense']]) {
            const value = foundry.utils.getProperty(data, `system.${field}`);
            if (typeof value !== 'string' || !value.trim()) continue;
            game.settings.set(MODULE.ID, key, value.trim()).catch(() => {
                /* A failed convenience must not fail the save. */
            });
        }

        return data;
    }

    /** @inheritDoc */
    async _prepareContentContext(context, options) {
        await super._prepareContentContext(context, options);
        if (!this.isView) return context;

        // The structured data BRACKETS the prose rather than preceding it: identity,
        // stats, ingredients and equipment go above, because that is what a reader
        // needs before the method makes sense. Provenance goes below, because it is
        // the least important thing on the page and was previously competing with
        // the recipe itself.
        context.text.enriched = this.#renderHeader()
            + (context.text.enriched || '')
            + this.#renderFooter();
        return context;
    }

    /** Identity, at-a-glance stats, ingredients and equipment. */
    #renderHeader() {
        const system = this.document.system;
        const images = cachedImages();
        const parts = [];

        // --- Identity: what this makes, and what kind of thing it is -----------
        const result = (system.resultItemName ?? '').trim();
        const pageName = (this.document.name ?? '').trim();
        const classification = [system.type, system.category, system.rarity]
            .map(v => (v ?? '').toString().trim()).filter(Boolean);

        if (result || classification.length) {
            const img = images.get(result);
            parts.push(`<div class="arv-identity">`
                + (img ? `<img class="arv-identity-img" src="${escapeHtml(img)}" alt="" />` : '')
                + `<div class="arv-identity-text">`
                // The result name is only worth stating when it differs from the page
                // title -- repeating the heading directly under itself is noise.
                + (result && result !== pageName
                    ? `<div class="arv-identity-name">Produces ${escapeHtml(result)}</div>` : '')
                + (classification.length
                    ? `<div class="arv-identity-class">${classification.map(escapeHtml).join(' &middot; ')}</div>` : '')
                + `</div></div>`);
        }

        // --- Stat strip: the numbers a crafter checks before starting ----------
        const stats = [
            ['Skill', system.skill ? `${system.skill} ${system.skillLevel ?? 1}` : ''],
            ['DC', system.successDC],
            ['Process', system.time != null ? `${system.time}s` : ''],
            ['Work', system.workHours != null ? `${system.workHours}h` : ''],
            ['Cost', system.goldCost != null ? `${system.goldCost} gp` : '']
        ].filter(([, value]) => value != null && value !== '');

        if (stats.length) {
            parts.push(`<div class="arv-stats">` + stats.map(([label, value]) =>
                `<div class="arv-stat"><span class="arv-stat-label">${escapeHtml(label)}</span>`
                + `<span class="arv-stat-value">${escapeHtml(value)}</span></div>`).join('') + `</div>`);
        }

        // --- Ingredients and equipment, side by side --------------------------
        const ingredients = (system.ingredients ?? []).filter(i => i?.name);
        const equipment = [
            ['Apparatus', system.apparatusName],
            ['Container', system.containerName],
            ['Kit', system.skillKit]
        ].filter(([, value]) => (value ?? '').toString().trim());

        if (ingredients.length || equipment.length) {
            const columns = [];

            if (ingredients.length) {
                const rows = ingredients.map(ing => {
                    const img = images.get(ing.name);
                    const qualifier = [ing.type, ing.family].filter(Boolean).join(' &middot; ');
                    return `<li>`
                        + (img ? `<img class="arv-ing-img" src="${escapeHtml(img)}" alt="" />` : '')
                        + `<span class="arv-ing-name">${escapeHtml(ing.name)}</span>`
                        + (qualifier ? `<span class="arv-ing-qualifier">${qualifier}</span>` : '')
                        + `<span class="arv-ing-qty">&times;${ing.quantity ?? 1}</span></li>`;
                }).join('');
                columns.push(`<div class="arv-column"><h4 class="arv-column-heading">Ingredients</h4>`
                    + `<ul class="arv-ingredients">${rows}</ul></div>`);
            }

            if (equipment.length) {
                const rows = equipment.map(([label, value]) => {
                    const img = images.get(value);
                    return `<li>`
                        + (img ? `<img class="arv-ing-img" src="${escapeHtml(img)}" alt="" />` : '')
                        + `<span class="arv-ing-name">${escapeHtml(value)}</span>`
                        + `<span class="arv-ing-qualifier">${escapeHtml(label)}</span></li>`;
                }).join('');
                columns.push(`<div class="arv-column"><h4 class="arv-column-heading">Equipment</h4>`
                    + `<ul class="arv-ingredients">${rows}</ul></div>`);
            }

            parts.push(`<div class="arv-columns">${columns.join('')}</div>`);
        }

        // --- Method summary, only when it is not already obvious --------------
        if (system.processType) {
            const intensity = getProcessLevel(system.processType, system.processLevel).label;
            const detail = intensity && intensity !== 'Off' ? ` on ${String(intensity).toLowerCase()}` : '';
            // The process's own display name, not the stored id.
            parts.push(`<div class="arv-method">${escapeHtml(getProcess(system.processType).label)}${escapeHtml(detail)}</div>`);
        }

        const traits = splitTraits(system.traits);
        if (traits.length) {
            parts.push(`<div class="arv-traits">` + traits
                .map(t => `<span class="arv-trait">${escapeHtml(t)}</span>`).join('') + `</div>`);
        }

        return parts.length ? `<section class="arv-header">${parts.join('')}</section>` : '';
    }

    /** Provenance, demoted below the prose where it belongs. */
    #renderFooter() {
        const system = this.document.system;
        const credits = [
            ['Source', system.source],
            ['License', system.license]
        ].filter(([, value]) => (value ?? '').toString().trim());
        if (!credits.length) return '';

        return `<footer class="arv-footer">` + credits.map(([label, value]) =>
            `<span class="arv-credit"><span class="arv-credit-label">${escapeHtml(label)}</span> `
            + `${escapeHtml(value)}</span>`).join('') + `</footer>`;
    }
}
