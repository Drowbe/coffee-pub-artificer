// ==================================================================
// ===== ARTIFICER CRAFTING WINDOW ===================================
// ==================================================================

import { MODULE } from './const.js';
import { getExperimentationEngine, getTagsFromItem, getKnownCombinations } from './systems/experimentation-engine.js';
import { createArtificerItem } from './utility-artificer-item.js';
import { INGREDIENT_FAMILIES } from './schema-ingredients.js';
import { ESSENCE_AFFINITIES } from './schema-essences.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Artificer Crafting Window - Main crafting UI
 * Ingredient browser with filtering, experimentation slots, recipe placeholder
 */
export class CraftingWindow extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(foundry.utils.mergeObject({}, super.DEFAULT_OPTIONS ?? {}), {
        id: 'artificer-crafting',
        classes: ['window-artificer-crafting', 'artificer-crafting-window'],
        position: { width: 820, height: 560 },
        window: { title: 'Artificer Crafting Station', resizable: true, minimizable: true },
        actions: {
            craft: CraftingWindow._actionCraft,
            clear: CraftingWindow._actionClear,
            addToSlot: CraftingWindow._actionAddToSlot,
            removeFromSlot: CraftingWindow._actionRemoveFromSlot,
            seed: CraftingWindow._actionSeed
        }
    });

    static PARTS = {
        body: {
            template: 'modules/coffee-pub-artificer/templates/window-crafting.hbs'
        }
    };

    constructor(options = {}) {
        const opts = foundry.utils.mergeObject({}, options);
        opts.id = opts.id ?? `${CraftingWindow.DEFAULT_OPTIONS.id}-${foundry.utils.randomID().slice(0, 8)}`;
        super(opts);
        this.selectedSlots = [null, null, null];
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

        let ingredients = actor
            ? actor.items
                .filter(i => {
                    const f = i.flags?.[MODULE.ID] || i.flags?.artificer;
                    return f?.type && ['ingredient', 'component', 'essence'].includes(f.type);
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
                        family: f?.family || ''
                    };
                })
            : [];

        // Apply filters
        if (this.filterFamily) {
            ingredients = ingredients.filter(i => i.family === this.filterFamily);
        }
        if (this.filterType && this.filterType !== 'all') {
            ingredients = ingredients.filter(i => i.type === this.filterType);
        }
        if (this.filterSearch?.trim()) {
            const q = this.filterSearch.trim().toLowerCase();
            ingredients = ingredients.filter(i =>
                i.name.toLowerCase().includes(q) || i.tags.toLowerCase().includes(q)
            );
        }

        const slots = this.selectedSlots.map((item, i) => {
            if (!item) return { item: null, tags: '' };
            const tags = getTagsFromItem(item).join(', ');
            return { item: { id: item.id, name: item.name, img: item.img }, tags };
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
            { value: 'essence', label: 'Essence', selected: this.filterType === 'essence' }
        ];

        const canCraft = this.selectedSlots.some(s => s !== null);
        const hasRecipes = false; // Placeholder for Phase 5
        const knownCombinations = getKnownCombinations();

        // Tags in slots for feedback
        const slotTags = this.selectedSlots
            .filter(Boolean)
            .map(item => getTagsFromItem(item))
            .flat();
        const combinedTags = [...new Set(slotTags)].map(t => t.charAt(0).toUpperCase() + t.slice(1));

        return {
            crafterName: actor?.name ?? null,
            slots,
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
            hasRecipes,
            isGM: game.user?.isGM ?? false
        };
    }

    async _prepareContext(options = {}) {
        const base = await super._prepareContext?.(options) ?? {};
        return foundry.utils.mergeObject(base, await this.getData(options));
    }


    static _actionCraft(event, target) { this._craft(); }
    static _actionClear(event, target) {
        this.selectedSlots = [null, null, null];
        this.render();
    }
    static _actionAddToSlot(event, target) {
        const el = target.closest?.('.crafting-ingredient-item') ?? target;
        const itemId = el?.dataset?.itemId;
        if (itemId) this._addToSlot(itemId);
    }
    static _actionRemoveFromSlot(event, target) {
        const el = target.closest?.('.bench-slot-item') ?? target.closest?.('.bench-slot');
        const idx = el?.dataset?.slotIndex ?? el?.closest?.('.bench-slot')?.dataset?.slotIndex;
        if (idx !== undefined) this._removeFromSlot(idx);
    }
    static _actionSeed(event, target) { this._seedIngredients(); }

    _attachListeners(root) {
        const el = root ?? this.window?.content ?? this.element;
        if (!el) return;

        el.querySelector('#crafting-filter-family')?.addEventListener('change', (e) => {
            this.filterFamily = e.target.value ?? '';
            this.render();
        });
        el.querySelector('#crafting-filter-type')?.addEventListener('change', (e) => {
            const v = e.target.value;
            this.filterType = v === 'all' ? '' : (v ?? '');
            this.render();
        });
        el.querySelector('#crafting-filter-search')?.addEventListener('input', (e) => {
            this.filterSearch = e.target.value ?? '';
            this.render();
        });

        el.querySelectorAll('.ingredient-row').forEach(item => {
            item.addEventListener('click', () => this._addToSlot(item.dataset.itemId));
        });

        el.querySelectorAll('.bench-slot-item').forEach(slot => {
            slot.addEventListener('click', (e) => {
                e.stopPropagation();
                this._removeFromSlot(slot.closest('.crafting-slot')?.dataset?.slotIndex);
            });
        });
    }

    activateListeners(html) {
        super.activateListeners(html);
        if (html?.jquery ?? typeof html?.find === 'function') {
            html = html[0] ?? html.get?.(0) ?? html;
        }
        const root = html?.matches?.('.artificer-crafting-window') ? html : html?.querySelector?.('.artificer-crafting-window') ?? html;
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
        const idx = this.selectedSlots.findIndex(s => !s);
        if (idx === -1) return;
        this.selectedSlots[idx] = item;
        this.render();
    }

    _removeFromSlot(slotIndex) {
        const i = parseInt(slotIndex, 10);
        if (i >= 0 && i < 3) {
            this.selectedSlots[i] = null;
            this.render();
        }
    }

    async _seedIngredients() {
        const actor = this._getActor();
        if (!actor) {
            ui.notifications.warn('Select an actor first.');
            return;
        }

        const seedData = [
            { itemData: { name: 'Lavender', type: 'consumable', description: 'A fragrant herb.', weight: 0.1, price: 5, rarity: 'common' }, artificerData: { primaryTag: 'Herb', secondaryTags: ['Floral', 'Medicinal'], family: INGREDIENT_FAMILIES.HERBS, quirk: 'Soothing', tier: 1, rarity: 'Common' }, type: 'ingredient' },
            { itemData: { name: 'Life Essence', type: 'consumable', description: 'Faintly glowing essence of life.', weight: 0, price: 25, rarity: 'uncommon' }, artificerData: { primaryTag: 'Life', secondaryTags: ['Light', 'Healing'], affinity: ESSENCE_AFFINITIES.LIFE, tier: 1, rarity: 'Uncommon' }, type: 'essence' },
            { itemData: { name: 'Iron Ore', type: 'consumable', description: 'Raw iron ore.', weight: 5, price: 2, rarity: 'common' }, artificerData: { primaryTag: 'Metal', secondaryTags: ['Ore', 'Alloy-Friendly'], family: INGREDIENT_FAMILIES.MINERALS, quirk: null, tier: 1, rarity: 'Common' }, type: 'ingredient' },
            { itemData: { name: 'Quartz Crystal', type: 'consumable', description: 'A clear crystal with arcane resonance.', weight: 0.5, price: 15, rarity: 'common' }, artificerData: { primaryTag: 'Crystal', secondaryTags: ['Resonant', 'Arcane'], family: INGREDIENT_FAMILIES.GEMS, quirk: null, tier: 1, rarity: 'Common' }, type: 'ingredient' },
            { itemData: { name: 'Sage', type: 'consumable', description: 'A medicinal herb.', weight: 0.1, price: 3, rarity: 'common' }, artificerData: { primaryTag: 'Herb', secondaryTags: ['Medicinal'], family: INGREDIENT_FAMILIES.HERBS, quirk: null, tier: 1, rarity: 'Common' }, type: 'ingredient' }
        ];

        try {
            for (const data of seedData) {
                const item = await createArtificerItem(data.itemData, data.artificerData, { type: data.type, createInWorld: true, actor });
                if (item) {
                    const embedded = actor.items.find(i => i.name === item.name && (i.flags?.[MODULE.ID] || i.flags?.artificer));
                    if (embedded) await embedded.update({ 'system.quantity': 2 });
                }
            }
            ui.notifications.info(`Added ${seedData.length} test ingredients to ${actor.name}.`);
            this.render();
        } catch (err) {
            console.error('Artificer seed error:', err);
            ui.notifications.error(`Seed failed: ${err.message}`);
        }
    }

    async _craft() {
        const actor = this._getActor();
        const items = this.selectedSlots.filter(Boolean);
        if (!actor || items.length === 0) return;

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
        this.selectedSlots = [null, null, null];

        if (this.lastResult.success) {
            ui.notifications.info(`Created: ${this.lastResult.name}`);
        } else {
            ui.notifications.warn(this.lastResult.name);
        }
        this.render();
    }
}
