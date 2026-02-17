// ==================================================================
// ===== ARTIFICER CRAFTING WINDOW ===================================
// ==================================================================

import { MODULE } from './const.js';
import { getAPI } from './api-artificer.js';
import { getExperimentationEngine, getTagsFromItem } from './systems/experimentation-engine.js';
import { resolveItemByName } from './utility-artificer-item.js';
import { INGREDIENT_FAMILIES } from './schema-ingredients.js';

/**
 * Map journal-loaded recipes to display format for the recipe list
 * @returns {Array<{recipeId: string, tags: string[], result: string, selected?: boolean}>}
 */
function getRecipesForDisplay(selectedRecipeId) {
    const api = getAPI();
    const recipes = api?.recipes?.getAll?.() ?? [];
    return recipes.map((r) => {
        const tags = (r.tags?.length ? r.tags : r.ingredients?.map((i) => i.name) ?? [])
            .map((t) => (typeof t === 'string' ? t.charAt(0).toUpperCase() + t.slice(1) : String(t)));
        return {
            recipeId: r.id,
            tags: tags.length ? tags : [r.name],
            result: r.name,
            selected: selectedRecipeId === r.id
        };
    });
}

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** App ID prefix for unique element IDs */
const CRAFTING_APP_ID = 'artificer-crafting';

/** Module-level ref for delegation (like Quick Encounter) */
let _currentCraftingWindowRef = null;
let _craftingDelegationAttached = false;

/**
 * Artificer Crafting Window - Main crafting UI
 * Ingredient browser with filtering, experimentation slots, recipe placeholder
 */
export class CraftingWindow extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(foundry.utils.mergeObject({}, super.DEFAULT_OPTIONS ?? {}), {
        id: CRAFTING_APP_ID,
        classes: ['window-artificer-crafting', 'artificer-crafting-window'],
        position: { width: 1200, height: 700 },
        window: { title: 'Artificer Crafting Station', resizable: true, minimizable: true },
        actions: {
            craft: CraftingWindow._actionCraft,
            clear: CraftingWindow._actionClear,
            addToSlot: CraftingWindow._actionAddToSlot,
            addToContainer: CraftingWindow._actionAddToContainer,
            removeFromSlot: CraftingWindow._actionRemoveFromSlot,
            removeContainer: CraftingWindow._actionRemoveContainer,
            selectRecipe: CraftingWindow._actionSelectRecipe
        }
    });

    static PARTS = {
        body: {
            template: 'modules/coffee-pub-artificer/templates/window-crafting.hbs'
        }
    };

    constructor(options = {}) {
        const opts = foundry.utils.mergeObject({}, options);
        opts.id = opts.id ?? `${CRAFTING_APP_ID}-${foundry.utils.randomID().slice(0, 8)}`;
        super(opts);
        /** @type {Array<{item: Item, count: number}|null>} */
        this.selectedSlots = Array(6).fill(null);
        this.selectedContainer = null;
        this.heatValue = options.heatValue ?? 0;
        this.timeValue = options.timeValue ?? 30;
        this.lastResult = null;
        this.lastCraftTags = [];
        /** @type {ArtificerRecipe|null} */
        this.selectedRecipe = null;
        this.filterFamily = options.filterFamily ?? '';
        this.filterType = options.filterType ?? '';
        this.filterSearch = options.filterSearch ?? '';
        this.filterRecipeSearch = options.filterRecipeSearch ?? '';
        /** @type {ReturnType<typeof setTimeout>|null} */
        this._searchDebounceTimer = null;
    }

    /**
     * Debounced render for search inputs; avoids re-creating inputs on every keystroke (cursor reset bug)
     * @param {HTMLElement} inputEl - The search input that had focus
     */
    _debouncedSearchRender(inputEl) {
        clearTimeout(this._searchDebounceTimer ?? 0);
        const saveId = inputEl?.id ?? '';
        const saveStart = inputEl?.selectionStart ?? 0;
        const saveEnd = inputEl?.selectionEnd ?? 0;
        this._searchDebounceTimer = setTimeout(async () => {
            this._searchDebounceTimer = null;
            await this.render();
            const newEl = saveId ? document.getElementById(saveId) : null;
            if (newEl && typeof newEl.focus === 'function') {
                newEl.focus();
                if (typeof newEl.setSelectionRange === 'function') newEl.setSelectionRange(saveStart, saveEnd);
            }
        }, 150);
    }

    /**
     * Get the crafter actor: player → their character; GM → selected token's actor (or character fallback)
     */
    _getCraftingRoot() {
        const byId = document.getElementById(this.id);
        if (byId) return byId;
        return document.querySelector('.crafting-window-root') ?? this.element ?? null;
    }

    _getCrafterActor() {
        if (game.user?.isGM) {
            const controlled = canvas.ready ? canvas.tokens.controlled : [];
            const token = controlled[0];
            if (token?.actor) return token.actor;
        }
        return game.user?.character ?? null;
    }

    async getData(options = {}) {
        const actor = this._getCrafterActor();

        const artificerItems = actor
            ? actor.items.filter(i => {
                const f = i.flags?.[MODULE.ID] || i.flags?.artificer;
                return f?.type && ['ingredient', 'component', 'essence', 'container'].includes(f.type);
            })
            : [];

        let ingredients = artificerItems
            .filter(i => {
                const f = i.flags?.[MODULE.ID] || i.flags?.artificer;
                return ['ingredient', 'component', 'essence'].includes(f?.type);
            })
            .map(i => {
                const f = i.flags?.[MODULE.ID] || i.flags?.artificer;
                return {
                    id: i.id,
                    uuid: i.uuid,
                    name: i.name,
                    img: i.img || 'icons/skills/melee/weapons-crossed-swords-yellow.webp',
                    quantity: i.system?.quantity ?? 1,
                    tags: getTagsFromItem(i).join(', '),
                    type: f?.type || 'other',
                    family: f?.family || '',
                    isContainer: false,
                    addAction: 'addToSlot'
                };
            });

        const containers = artificerItems
            .filter(i => {
                const f = i.flags?.[MODULE.ID] || i.flags?.artificer;
                return f?.type === 'container';
            })
            .map(i => {
                const f = i.flags?.[MODULE.ID] || i.flags?.artificer;
                const primary = f?.primaryTag ?? '';
                const secondary = Array.isArray(f?.secondaryTags) ? f.secondaryTags : (f?.secondaryTags ? [f.secondaryTags] : []);
                const tags = [primary, ...secondary].filter(Boolean).join(', ');
                return {
                    id: i.id,
                    uuid: i.uuid,
                    name: i.name,
                    img: i.img || 'icons/containers/bags/pouch-simple-brown.webp',
                    quantity: i.system?.quantity ?? 1,
                    tags,
                    type: 'container',
                    isContainer: true,
                    addAction: 'addToContainer'
                };
            });

        // Apply filters to ingredients
        if (this.filterFamily) {
            ingredients = ingredients.filter(i => i.family === this.filterFamily);
        }
        if (this.filterType && this.filterType !== 'all' && this.filterType !== 'container') {
            ingredients = ingredients.filter(i => i.type === this.filterType);
        }
        if (this.filterSearch?.trim()) {
            const q = this.filterSearch.trim().toLowerCase();
            ingredients = ingredients.filter(i =>
                i.name.toLowerCase().includes(q) || i.tags.toLowerCase().includes(q)
            );
        }
        let filteredContainers = containers;
        if (this.filterSearch?.trim()) {
            const q = this.filterSearch.trim().toLowerCase();
            filteredContainers = containers.filter(i => i.name.toLowerCase().includes(q));
        }

        const showContainersOnly = this.filterType === 'container';
        const showAllTypes = !this.filterType || this.filterType === 'all';
        const listItems = showContainersOnly
            ? filteredContainers
            : showAllTypes
                ? [...ingredients, ...filteredContainers]
                : ingredients;

        const slots = this.selectedSlots.map((entry) => {
            if (!entry) return { item: null, count: 0, tags: '', tooltip: '', isMissing: false };
            const item = entry.item;
            const name = item?.name ?? entry.name ?? '?';
            const img = item?.img ?? entry.img ?? 'icons/skills/melee/weapons-crossed-swords-yellow.webp';
            const tags = item ? getTagsFromItem(item).join(', ') : '';
            const tooltip = entry.isMissing
                ? `${name} (need ${entry.count}, have ${entry.have ?? 0})`
                : [name, tags ? `Tags: ${tags}` : ''].filter(Boolean).join('\n');
            return {
                item: { id: item?.id, name, img },
                count: entry.count,
                tags,
                tooltip,
                isMissing: !!entry.isMissing
            };
        });

        const familyOptions = [
            { value: '', label: 'All families', selected: !this.filterFamily },
            ...Object.values(INGREDIENT_FAMILIES).map(f => ({
                value: f,
                label: f,
                selected: this.filterFamily === f
            }))
        ];

        const typeOptions = [
            { value: 'all', label: 'All types', selected: !this.filterType },
            { value: 'ingredient', label: 'Ingredient', selected: this.filterType === 'ingredient' },
            { value: 'component', label: 'Component', selected: this.filterType === 'component' },
            { value: 'essence', label: 'Essence', selected: this.filterType === 'essence' },
            { value: 'container', label: 'Container', selected: this.filterType === 'container' }
        ];

        let containerSlot = { item: null, tooltip: '' };
        if (this.selectedContainer) {
            const c = this.selectedContainer;
            const cf = c.flags?.[MODULE.ID] || c.flags?.artificer;
            const ct = cf?.primaryTag
                ? [cf.primaryTag, ...(Array.isArray(cf?.secondaryTags) ? cf.secondaryTags : [])].filter(Boolean).join(', ')
                : '';
            containerSlot = {
                item: { id: c.id, name: c.name, img: c.img },
                tooltip: [c.name, cf?.family ? `Family: ${cf.family}` : '', ct ? `Tags: ${ct}` : ''].filter(Boolean).join('\n')
            };
        }

        const hasSlots = this.selectedSlots.some(s => s !== null);
        const anyMissing = this.selectedSlots.some(s => s?.isMissing);
        const canCraft = hasSlots && !anyMissing;
        let knownCombinations = getRecipesForDisplay(this.selectedRecipe?.id ?? null);
        if (this.filterRecipeSearch?.trim()) {
            const q = this.filterRecipeSearch.trim().toLowerCase();
            knownCombinations = knownCombinations.filter(
                (r) =>
                    (r.result ?? '').toLowerCase().includes(q) ||
                    (r.tags ?? []).some((t) => String(t).toLowerCase().includes(q))
            );
        }
        const hasRecipes = knownCombinations.length > 0;

        // Tags in slots for feedback
        const slotTags = this.selectedSlots
            .filter(Boolean)
            .flatMap(entry => getTagsFromItem(entry.item))
            .flat();
        const combinedTags = [...new Set(slotTags)].map(t => t.charAt(0).toUpperCase() + t.slice(1));

        return {
            appId: this.id,
            crafterName: actor?.name ?? null,
            slots,
            containerSlot,
            listItems,
            showContainersOnly,
            heatValue: this.heatValue,
            timeValue: this.timeValue,
            heatFillPercent: this.heatValue,
            timeFillPercent: ((this.timeValue - 5) / 115) * 100,
            ingredients,
            canCraft,
            lastResult: this.lastResult,
            lastCraftTags: this.lastCraftTags,
            lastCraftTagsStr: this.lastCraftTags.join(', '),
            knownCombinations,
            combinedTags,
            familyOptions,
            typeOptions,
            filterSearch: this.filterSearch,
            filterRecipeSearch: this.filterRecipeSearch,
            activeTab: this.activeTab ?? 'experimentation',
            hasRecipes
        };
    }

    async _prepareContext(options = {}) {
        const base = await super._prepareContext?.(options) ?? {};
        return foundry.utils.mergeObject(base, await this.getData(options));
    }


    static _actionCraft(event, target) { this._craft(); }
    static _actionClear(event, target) {
        this.selectedSlots = Array(6).fill(null);
        this.selectedContainer = null;
        this.selectedRecipe = null;
        this.render();
    }
    static _actionAddToSlot(event, target) {
        const el = target.closest?.('.crafting-ingredient-row') ?? target;
        const itemId = el?.dataset?.itemId;
        if (itemId) this._addToSlot(itemId);
    }
    static _actionAddToContainer(event, target) {
        const el = target.closest?.('.crafting-ingredient-row') ?? target;
        const itemId = el?.dataset?.itemId;
        if (itemId) this._addToContainer(itemId);
    }
    static _actionRemoveFromSlot(event, target) {
        const el = target.closest?.('.crafting-bench-slot-item') ?? target.closest?.('.crafting-bench-slot');
        const idx = el?.dataset?.slotIndex ?? el?.closest?.('.crafting-bench-slot')?.dataset?.slotIndex;
        if (idx !== undefined) this._removeFromSlot(idx);
    }
    static _actionRemoveContainer(event, target) {
        this._removeContainer();
    }
    static _actionSelectRecipe(event, target) {
        const row = target?.closest?.('.crafting-recipe-row');
        const recipeId = row?.dataset?.recipeId;
        if (recipeId) this._selectRecipe(recipeId).catch(() => {});
    }

    /** Attach document-level delegation (encounter pattern: ref + root.contains) */
    _attachDelegationOnce() {
        _currentCraftingWindowRef = this;
        if (_craftingDelegationAttached) return;
        _craftingDelegationAttached = true;

        document.addEventListener('click', (e) => {
            const w = _currentCraftingWindowRef;
            if (!w) return;
            const root = w._getCraftingRoot();
            if (!root?.contains?.(e.target)) return;
            const recipeRow = e.target?.closest?.('.crafting-recipe-row');
            if (recipeRow?.dataset?.recipeId) {
                w._selectRecipe(recipeRow.dataset.recipeId).catch(() => {});
                return;
            }
            const row = e.target?.closest?.('.crafting-ingredient-row');
            if (row?.dataset?.itemId) {
                const action = row.dataset.action || row.getAttribute?.('data-action');
                if (action === 'addToContainer') w._addToContainer(row.dataset.itemId);
                else w._addToSlot(row.dataset.itemId);
                return;
            }
            const slotItem = e.target?.closest?.('.crafting-bench-slot-item');
            if (slotItem) {
                const slot = slotItem.closest('.crafting-bench-slot');
                if (slot?.dataset?.slotIndex !== undefined) w._removeFromSlot(slot.dataset.slotIndex);
                return;
            }
            const containerSlot = e.target?.closest?.('.crafting-bench-container-slot');
            if (containerSlot && w.selectedContainer) w._removeContainer();
        });

        document.addEventListener('change', (e) => {
            const w = _currentCraftingWindowRef;
            if (!w) return;
            const root = w._getCraftingRoot();
            if (!root?.contains?.(e.target)) return;
            const appId = w.id;
            const el = e.target;
            const id = el.id ?? '';
            if (id === `${appId}-filter-family`) {
                w.filterFamily = el.value ?? '';
                w.render();
            } else if (id === `${appId}-filter-type`) {
                const v = el.value;
                w.filterType = v === 'all' ? '' : (v ?? '');
                w.render();
            }
            const slider = el?.closest?.('[data-craft-setting]');
            if (slider) {
                const key = slider.getAttribute('data-craft-setting');
                const min = parseFloat(slider.getAttribute('data-craft-setting-min')) || 0;
                const max = parseFloat(slider.getAttribute('data-craft-setting-max')) || 100;
                const val = Math.max(min, Math.min(max, parseInt(slider.value, 10) || min));
                if (key === 'heat') w.heatValue = val;
                else if (key === 'time') w.timeValue = val;
                w.render();
            }
        });

        document.addEventListener('input', (e) => {
            const w = _currentCraftingWindowRef;
            if (!w) return;
            const root = w._getCraftingRoot();
            if (!root?.contains?.(e.target)) return;
            const appId = w.id;
            const el = e.target;
            if ((el.id ?? '') === `${appId}-filter-search`) {
                w.filterSearch = el.value ?? '';
                w._debouncedSearchRender(el);
                return;
            }
            if ((el.id ?? '') === `${appId}-filter-recipes`) {
                w.filterRecipeSearch = el.value ?? '';
                w._debouncedSearchRender(el);
                return;
            }
            const slider = el?.closest?.('[data-craft-setting]');
            if (slider) {
                const key = slider.getAttribute('data-craft-setting');
                const min = parseFloat(slider.getAttribute('data-craft-setting-min')) || 0;
                const max = parseFloat(slider.getAttribute('data-craft-setting-max')) || 100;
                const val = Math.max(min, Math.min(max, parseInt(slider.value, 10) || min));
                if (key === 'heat') {
                    w.heatValue = val;
                    const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
                    slider.style?.setProperty?.('--heat-fill', `${pct}%`);
                } else if (key === 'time') {
                    w.timeValue = val;
                    const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
                    slider.style?.setProperty?.('--slider-fill', `${pct}%`);
                }
            }
        });
    }

    async _onFirstRender(_context, options) {
        await super._onFirstRender?.(_context, options);
        this._attachDelegationOnce();
    }

    _attachListeners(_root) {
        /* Ingredient add, slot remove, container remove: handled by document-level delegation */
    }

    activateListeners(html) {
        super.activateListeners(html);
        const raw = html?.jquery ? html[0] : html;
        const root = raw?.closest?.('.crafting-window-root') ?? raw?.querySelector?.('.crafting-window-root') ?? document.getElementById(this.id);
        this._attachListeners(root);
    }

    _getActor() {
        return this._getCrafterActor();
    }

    _addToSlot(itemId) {
        const actor = this._getActor();
        if (!actor) return;
        const item = actor.items.get(itemId);
        if (!item) return;
        const available = item.system?.quantity ?? 1;
        const existingIdx = this.selectedSlots.findIndex(s => s && s.item.id === itemId);
        if (existingIdx !== -1) {
            const totalInSlots = this.selectedSlots.reduce(
                (sum, s) => sum + (s && s.item.id === itemId ? s.count : 0),
                0
            );
            if (totalInSlots >= available) return;
            this.selectedSlots[existingIdx].count++;
        } else {
            const idx = this.selectedSlots.findIndex(s => s === null);
            if (idx === -1) return;
            this.selectedSlots[idx] = { item, count: 1 };
        }
        this.render();
    }

    _removeFromSlot(slotIndex) {
        const i = parseInt(slotIndex, 10);
        if (i >= 0 && i < 6) {
            this.selectedSlots[i] = null;
            this.render();
        }
    }

    _addToContainer(itemId) {
        const actor = this._getActor();
        if (!actor) return;
        const item = actor.items.get(itemId);
        if (!item) return;
        const f = item.flags?.[MODULE.ID] || item.flags?.artificer;
        if (f?.type !== 'container') return;
        this.selectedContainer = item;
        this.render();
    }

    _removeContainer() {
        this.selectedContainer = null;
        this.render();
    }

    /**
     * Populate crafting bench from a selected recipe
     * @param {string} recipeId - Recipe UUID (journal page UUID)
     */
    async _selectRecipe(recipeId) {
        const api = getAPI();
        const recipe = api?.recipes?.getById?.(recipeId) ?? null;
        const actor = this._getCrafterActor();
        if (!recipe) return;

        this.selectedRecipe = recipe;

        /** @type {Array<{item: Item|null, name?: string, img?: string, count: number, have?: number, isMissing?: boolean}|null>} */
        const newSlots = Array(6).fill(null);
        const ingredients = recipe.ingredients ?? [];
        const placeholderImg = 'icons/skills/melee/weapons-crossed-swords-yellow.webp';

        for (let i = 0; i < Math.min(6, ingredients.length); i++) {
            const ing = ingredients[i];
            const need = ing.quantity ?? 1;
            let have = 0;
            let matchedItem = null;

            if (actor) {
                const candidates = actor.items.filter((item) => {
                    const f = item.flags?.[MODULE.ID] || item.flags?.artificer;
                    const nameMatches = (item.name || '').trim() === (ing.name || '').trim();
                    if (f?.type && ['ingredient', 'component', 'essence'].includes(f.type)) {
                        return (f.type === (ing.type || 'ingredient')) && nameMatches;
                    }
                    return nameMatches;
                });
                const getQty = (item) => {
                    const q = item.system?.quantity;
                    return typeof q === 'number' ? q : (q?.value ?? 1);
                };
                have = candidates.reduce((sum, item) => sum + getQty(item), 0);
                matchedItem = candidates[0] ?? null;
            }

            const isMissing = have < need;
            const img = matchedItem?.img ?? (game.items?.find((i) => (i.name || '').trim() === (ing.name || '').trim())?.img ?? placeholderImg);

            if (matchedItem) {
                newSlots[i] = {
                    item: matchedItem,
                    count: need,
                    have,
                    isMissing
                };
            } else {
                newSlots[i] = {
                    item: null,
                    name: ing.name ?? '?',
                    img,
                    count: need,
                    have: 0,
                    isMissing: true
                };
            }
        }

        this.selectedSlots = newSlots;

        if (recipe.containerUuid || recipe.containerName) {
            // Match by name: actor items have different UUIDs than world items
            let targetName = (recipe.containerName || '').trim();
            if (!targetName && recipe.containerUuid) {
                const ref = await fromUuid(recipe.containerUuid);
                targetName = (ref?.name || '').trim();
            }
            const containerItem = actor?.items?.find((i) => {
                const f = i.flags?.[MODULE.ID] || i.flags?.artificer;
                if (f?.type !== 'container') return false;
                return (i.name || '').trim() === targetName;
            });
            this.selectedContainer = containerItem ?? null;
        } else {
            this.selectedContainer = null;
        }

        if (recipe.heat != null && recipe.heat >= 0 && recipe.heat <= 100) this.heatValue = recipe.heat;
        if (recipe.time != null && recipe.time >= 0) this.timeValue = recipe.time;

        this.render();
    }

    async _craft() {
        const actor = this._getActor();
        const entries = this.selectedSlots.filter(s => s && s.item && !s.isMissing);
        if (!actor || entries.length === 0) return;

        const items = entries.flatMap(e => Array(e.count).fill(e.item));

        const valid = items.every(i => {
            const f = i.flags?.[MODULE.ID] || i.flags?.artificer;
            return f?.type && ['ingredient', 'component', 'essence'].includes(f.type);
        });
        if (!valid) {
            ui.notifications.warn('Only Artificer ingredients, components, and essences can be used in crafting.');
            return;
        }

        const anyMissing = this.selectedSlots.some(s => s?.isMissing);

        // Recipe takes precedence: if recipe selected and all ingredients present, use recipe result
        if (this.selectedRecipe && !anyMissing) {
            this.lastResult = await this._craftFromRecipe(actor, items);
        } else {
            // Fall back to tag-based experimentation
            const allTags = [];
            for (const item of items) {
                allTags.push(...getTagsFromItem(item));
            }
            this.lastCraftTags = [...new Set(allTags)].map(t => t.charAt(0).toUpperCase() + t.slice(1));
            const engine = getExperimentationEngine();
            this.lastResult = await engine.craft(actor, items);
        }

        /** @type {Array<{item: Item, count: number}|null>} */
        this.selectedSlots = Array(6).fill(null);

        if (this.lastResult.success) {
            ui.notifications.info(`Created: ${this.lastResult.name}`);
        } else {
            ui.notifications.warn(this.lastResult.name);
        }
        this.render();
    }

    /**
     * Craft from recipe: use recipe's result item (100% success when ingredients present)
     * @param {Actor} actor
     * @param {Item[]} items - Items to consume
     * @returns {Promise<{success: boolean, item: Item|null, name: string, quality: string}>}
     */
    async _craftFromRecipe(actor, items) {
        const recipe = this.selectedRecipe;
        if (!recipe) return { success: false, item: null, name: 'No recipe', quality: 'Failed' };

        let resultItem = null;
        if (recipe.resultItemUuid) {
            resultItem = await fromUuid(recipe.resultItemUuid);
        }
        if (!resultItem && recipe.name) {
            resultItem = await resolveItemByName(recipe.name);
        }
        if (!resultItem) {
            return {
                success: false,
                item: null,
                name: `Recipe result "${recipe.name}" not found in compendia or world. Create it (see documentation/core-items-required.md).`,
                quality: 'Failed'
            };
        }

        try {
            const obj = resultItem.toObject();
            delete obj._id;
            if (obj.id !== undefined) delete obj.id;

            const created = await actor.createEmbeddedDocuments('Item', [obj]);
            const createdItem = created?.[0];
            if (!createdItem) {
                return { success: false, item: null, name: 'Creation failed', quality: 'Failed' };
            }

            await this._consumeIngredients(actor, items);
            this.lastCraftTags = [recipe.name];
            return {
                success: true,
                item: createdItem,
                name: recipe.name,
                quality: 'Basic'
            };
        } catch (err) {
            console.error('[Artificer] Recipe craft error:', err);
            return { success: false, item: null, name: err?.message ?? 'Craft failed', quality: 'Failed' };
        }
    }

    /**
     * Consume ingredients from actor inventory
     * @param {Actor} actor
     * @param {Item[]} items
     */
    async _consumeIngredients(actor, items) {
        for (const item of items) {
            const actorItem = actor.items.get(item.id);
            if (!actorItem) continue;

            const qty = actorItem.system?.quantity ?? actorItem.system?.uses?.value ?? 1;
            if (qty > 1) {
                await actorItem.update({
                    'system.quantity': Math.max(0, qty - 1)
                });
            } else {
                await actorItem.delete();
            }
        }
    }
}
