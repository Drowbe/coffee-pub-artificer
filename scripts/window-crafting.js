// ==================================================================
// ===== ARTIFICER CRAFTING WINDOW ===================================
// ==================================================================

import { MODULE } from './const.js';
import { getExperimentationEngine, getTagsFromItem, getKnownCombinations } from './systems/experimentation-engine.js';
import { INGREDIENT_FAMILIES } from './schema-ingredients.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** App ID prefix for unique element IDs */
const CRAFTING_APP_ID = 'artificer-crafting';

/**
 * Artificer Crafting Window - Main crafting UI
 * Ingredient browser with filtering, experimentation slots, recipe placeholder
 */
export class CraftingWindow extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(foundry.utils.mergeObject({}, super.DEFAULT_OPTIONS ?? {}), {
        id: CRAFTING_APP_ID,
        classes: ['window-artificer-crafting', 'artificer-crafting-window'],
        position: { width: 1100, height: 580 },
        window: { title: 'Artificer Crafting Station', resizable: true, minimizable: true },
        actions: {
            craft: CraftingWindow._actionCraft,
            clear: CraftingWindow._actionClear,
            addToSlot: CraftingWindow._actionAddToSlot,
            addToContainer: CraftingWindow._actionAddToContainer,
            removeFromSlot: CraftingWindow._actionRemoveFromSlot,
            removeContainer: CraftingWindow._actionRemoveContainer
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
        this.filterFamily = options.filterFamily ?? '';
        this.filterType = options.filterType ?? '';
        this.filterSearch = options.filterSearch ?? '';
    }

    /**
     * Get the crafter actor: player → their character; GM → selected token's actor (or character fallback)
     */
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
        if (this.filterType === 'container' && this.filterSearch?.trim()) {
            const q = this.filterSearch.trim().toLowerCase();
            filteredContainers = containers.filter(i => i.name.toLowerCase().includes(q));
        }

        const showContainers = this.filterType === 'container';
        const listItems = showContainers ? filteredContainers : ingredients;

        const slots = this.selectedSlots.map((entry, i) => {
            if (!entry) return { item: null, count: 0, tags: '', tooltip: '' };
            const tags = getTagsFromItem(entry.item).join(', ');
            const tooltip = [entry.item.name, tags ? `Tags: ${tags}` : ''].filter(Boolean).join('\n');
            return {
                item: { id: entry.item.id, name: entry.item.name, img: entry.item.img },
                count: entry.count,
                tags,
                tooltip
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

        const canCraft = this.selectedSlots.some(s => s !== null);
        const hasRecipes = false; // Placeholder for Phase 5
        const knownCombinations = getKnownCombinations();

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
            showContainers,
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

    /** Attach document-level delegation for filters/search (runs once, survives re-renders) */
    _attachDelegationOnce() {
        const appId = this.id;
        if (this._delegationAttached) return;
        this._delegationAttached = true;

        document.addEventListener('change', (e) => {
            const el = e.target;
            if (!el?.closest?.(`#${appId}`)) return;
            const id = el.id ?? '';
            if (id === `${appId}-filter-family`) {
                this.filterFamily = el.value ?? '';
                this.render();
            } else if (id === `${appId}-filter-type`) {
                const v = el.value;
                this.filterType = v === 'all' ? '' : (v ?? '');
                this.render();
            }
        });

        document.addEventListener('input', (e) => {
            const el = e.target;
            if (!el?.closest?.(`#${appId}`)) return;
            if ((el.id ?? '') === `${appId}-filter-search`) {
                this.filterSearch = el.value ?? '';
                this.render();
            } else if (el?.dataset?.craftSetting === 'heat') {
                this.heatValue = Math.max(0, Math.min(100, parseInt(el.value, 10) || 50));
                this.render();
            } else if (el?.dataset?.craftSetting === 'time') {
                this.timeValue = Math.max(5, Math.min(120, parseInt(el.value, 10) || 30));
                this.render();
            }
        });

        document.addEventListener('change', (e) => {
            const el = e.target;
            if (!el?.closest?.(`#${appId}`)) return;
            if (el?.dataset?.craftSetting === 'heat') {
                this.heatValue = Math.max(0, Math.min(100, parseInt(el.value, 10) || 50));
                this.render();
            } else if (el?.dataset?.craftSetting === 'time') {
                this.timeValue = Math.max(5, Math.min(120, parseInt(el.value, 10) || 30));
                this.render();
            }
        });
    }

    async _onFirstRender(_context, options) {
        await super._onFirstRender?.(_context, options);
        this._attachDelegationOnce();
    }

    _attachListeners(root) {
        const el = root ?? document.getElementById(this.id);
        if (!el) return;

        el.querySelectorAll('.crafting-ingredient-row').forEach(row => {
            row.addEventListener('click', () => {
                const itemId = row.dataset?.itemId;
                const action = row.dataset?.addAction || row.getAttribute?.('data-action');
                if (!itemId) return;
                if (action === 'addToContainer') this._addToContainer(itemId);
                else this._addToSlot(itemId);
            });
        });

        el.querySelectorAll('.crafting-bench-slot-item').forEach(slot => {
            slot.addEventListener('click', (e) => {
                e.stopPropagation();
                this._removeFromSlot(slot.closest('.crafting-bench-slot')?.dataset?.slotIndex);
            });
        });
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

    async _craft() {
        const actor = this._getActor();
        const entries = this.selectedSlots.filter(Boolean);
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

        const allTags = [];
        for (const item of items) {
            allTags.push(...getTagsFromItem(item));
        }
        this.lastCraftTags = [...new Set(allTags)].map(t => t.charAt(0).toUpperCase() + t.slice(1));

        const engine = getExperimentationEngine();
        this.lastResult = await engine.craft(actor, items);
        /** @type {Array<{item: Item, count: number}|null>} */
        this.selectedSlots = Array(6).fill(null);

        if (this.lastResult.success) {
            ui.notifications.info(`Created: ${this.lastResult.name}`);
        } else {
            ui.notifications.warn(this.lastResult.name);
        }
        this.render();
    }
}
