// ==================================================================
// ===== CRAFTING EXPERIMENT PANEL (Prototype) ======================
// ==================================================================

import { MODULE } from './const.js';
import { getExperimentationEngine, getTagsFromItem } from './systems/experimentation-engine.js';
import { createArtificerItem } from './utility-artificer-item.js';
import { INGREDIENT_FAMILIES } from './schema-ingredients.js';
import { ESSENCE_AFFINITIES } from './schema-essences.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Crafting Experiment Panel - Minimal prototype UI
 */
export class CraftingExperimentPanel extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS ?? {}, {
        id: 'artificer-crafting-experiment',
        classes: ['window-artificer-experiment', 'artificer-crafting-experiment'],
        position: { width: 480, height: 400 },
        window: { title: 'Artificer Experimentation', resizable: true, minimizable: true },
        actions: {
            seed: CraftingExperimentPanel._actionSeed,
            craft: CraftingExperimentPanel._actionCraft,
            clear: CraftingExperimentPanel._actionClear,
            addToSlot: CraftingExperimentPanel._actionAddToSlot,
            removeFromSlot: CraftingExperimentPanel._actionRemoveFromSlot
        }
    });

    static PARTS = {
        body: {
            template: 'modules/coffee-pub-artificer/templates/panel-crafting-experiment.hbs'
        }
    };

    constructor(options = {}) {
        const opts = foundry.utils.mergeObject({}, options);
        opts.id = opts.id ?? `${CraftingExperimentPanel.DEFAULT_OPTIONS.id}-${foundry.utils.randomID().slice(0, 8)}`;
        super(opts);
        this.selectedActorId = options.actorId || null;
        this.selectedSlots = [null, null, null];
        this.lastResult = null;
    }

    async getData() {
        const actors = this._getActorOptions();
        const actor = actors.find(a => a.selected) ? game.actors.get(actors.find(a => a.selected).id) : null;

        const slots = this.selectedSlots.map((item, i) => {
            if (!item) return { item: null, tags: '' };
            const tags = getTagsFromItem(item).join(', ');
            return { item: { id: item.id, name: item.name, img: item.img }, tags };
        });

        const ingredients = actor
            ? actor.items
                .filter(i => {
                    const f = i.flags?.[MODULE.ID] || i.flags?.artificer;
                    if (f?.type && ['ingredient', 'component', 'essence'].includes(f.type)) return true;
                    // Normal D&D items (consumables, loot, etc.) — no tags but usable in recipes
                    if (!f) return ['consumable', 'loot', 'equipment', 'tool'].includes(i.type);
                    return false;
                })
                .map(i => ({
                    id: i.id,
                    uuid: i.uuid,
                    name: i.name,
                    img: i.img || 'icons/skills/melee/weapons-crossed-swords-yellow.webp',
                    quantity: i.system?.quantity ?? 1,
                    tags: getTagsFromItem(i).join(', ')
                }))
            : [];

        const canCraft = this.selectedSlots.some(s => s !== null);

        return {
            actors,
            slots,
            ingredients,
            canCraft,
            lastResult: this.lastResult
        };
    }

    async _prepareContext(options = {}) {
        const base = await super._prepareContext?.(options) ?? {};
        return foundry.utils.mergeObject(base, await this.getData(options));
    }

    _getActorOptions() {
        const controlled = canvas.ready ? canvas.tokens.controlled : [];
        const actorIds = new Set();
        controlled.forEach(t => {
            if (t.actor) actorIds.add(t.actor.id);
        });
        if (actorIds.size === 0 && game.user?.character) {
            actorIds.add(game.user.character.id);
        }
        game.actors.forEach(a => {
            if (game.user?.isGM || a.testUserPermission(game.user, 'OBSERVER')) actorIds.add(a.id);
        });

        const list = Array.from(actorIds)
            .map(id => game.actors.get(id))
            .filter(Boolean)
            .slice(0, 20)
            .map(a => ({
                id: a.id,
                name: a.name,
                selected: a.id === this.selectedActorId || (!this.selectedActorId && a.id === game.user?.character?.id)
            }));

        if (list.length && !this.selectedActorId) {
            this.selectedActorId = list.find(a => a.selected)?.id ?? list[0].id;
        }
        return list;
    }

    static _actionSeed(event, target) {
        this._seedIngredients();
    }

    static _actionCraft(event, target) {
        this._craft();
    }

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
        const el = target.closest?.('.slot-item') ?? target.closest?.('.crafting-slot');
        const idx = el?.dataset?.slotIndex ?? el?.closest?.('.crafting-slot')?.dataset?.slotIndex;
        if (idx !== undefined) this._removeFromSlot(idx);
    }

    _attachCraftingListeners(root) {
        const el = root ?? this.window?.content ?? this.element;
        if (!el) return;

        el.querySelector('#crafting-actor')?.addEventListener('change', (e) => {
            this.selectedActorId = e.target.value;
            this.selectedSlots = [null, null, null];
            this.render();
        });

        el.querySelectorAll('.crafting-ingredient-item').forEach(item => {
            item.addEventListener('click', () => this._addToSlot(item.dataset.itemId));
        });

        el.querySelectorAll('.slot-item').forEach(slot => {
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
        const root = html?.matches?.('.artificer-crafting-panel') ? html : html?.querySelector?.('.artificer-crafting-panel') ?? html;
        this._attachCraftingListeners(root);
    }

    _getActor() {
        return this.selectedActorId ? game.actors.get(this.selectedActorId) : null;
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
        const root = this.window?.content ?? this.element;
        const actorSelect = root?.querySelector('#crafting-actor');
        if (actorSelect) this.selectedActorId = actorSelect.value || this.selectedActorId;
        const actor = this._getActor();
        if (!actor) {
            ui.notifications.warn('Select an actor first.');
            return;
        }

        const seedData = [
            {
                itemData: { name: 'Lavender', type: 'consumable', description: 'A fragrant herb.', weight: 0.1, price: 5, rarity: 'common' },
                artificerData: { primaryTag: 'Herb', secondaryTags: ['Floral', 'Medicinal'], family: INGREDIENT_FAMILIES.HERBS, quirk: 'Soothing', tier: 1, rarity: 'Common' },
                type: 'ingredient'
            },
            {
                itemData: { name: 'Life Essence', type: 'consumable', description: 'Faintly glowing essence of life.', weight: 0, price: 25, rarity: 'uncommon' },
                artificerData: { primaryTag: 'Life', secondaryTags: ['Light', 'Healing'], affinity: ESSENCE_AFFINITIES.LIFE, tier: 1, rarity: 'Uncommon' },
                type: 'essence'
            },
            {
                itemData: { name: 'Iron Ore', type: 'consumable', description: 'Raw iron ore.', weight: 5, price: 2, rarity: 'common' },
                artificerData: { primaryTag: 'Metal', secondaryTags: ['Ore', 'Alloy-Friendly'], family: INGREDIENT_FAMILIES.MINERALS, quirk: null, tier: 1, rarity: 'Common' },
                type: 'ingredient'
            },
            {
                itemData: { name: 'Quartz Crystal', type: 'consumable', description: 'A clear crystal with arcane resonance.', weight: 0.5, price: 15, rarity: 'common' },
                artificerData: { primaryTag: 'Crystal', secondaryTags: ['Resonant', 'Arcane'], family: INGREDIENT_FAMILIES.GEMS, quirk: null, tier: 1, rarity: 'Common' },
                type: 'ingredient'
            },
            {
                itemData: { name: 'Sage', type: 'consumable', description: 'A medicinal herb.', weight: 0.1, price: 3, rarity: 'common' },
                artificerData: { primaryTag: 'Herb', secondaryTags: ['Medicinal'], family: INGREDIENT_FAMILIES.HERBS, quirk: null, tier: 1, rarity: 'Common' },
                type: 'ingredient'
            }
        ];

        try {
            for (const data of seedData) {
                const item = await createArtificerItem(data.itemData, data.artificerData, {
                    type: data.type,
                    createInWorld: true,
                    actor
                });
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
