// ==================================================================
// ===== EXPERIMENTATION ENGINE (Prototype) =========================
// ==================================================================

import { MODULE } from '../const.js';
import { ArtificerComponent } from '../data/models/model-component.js';

/**
 * Extract all tags from a Foundry Item (ingredient, component, or essence)
 * @param {Item} item - FoundryVTT Item
 * @returns {string[]} Normalized tags (lowercase)
 */
export function getTagsFromItem(item) {
    const flags = item?.flags?.[MODULE.ID] || item?.flags?.artificer;
    if (!flags) return [];
    const type = flags.type;

    if (type === 'ingredient') {
        const f = flags;
        const primary = f.primaryTag ?? '';
        const secondary = Array.isArray(f.secondaryTags) ? f.secondaryTags : [];
        const quirk = f.quirk ?? '';
        return [primary, ...secondary, quirk].filter(Boolean).map(t => String(t).toLowerCase());
    }
    if (type === 'component') {
        const comp = ArtificerComponent.fromItem(item);
        return (comp?.tags ?? []).map(t => t.toLowerCase());
    }
    if (type === 'essence') {
        const f = flags;
        const tags = f.tags ?? [];
        const affinity = f.affinity ?? '';
        const primary = f.primaryTag ?? '';
        const secondary = Array.isArray(f.secondaryTags) ? f.secondaryTags : [];
        return [...tags, affinity, primary, ...secondary].filter(Boolean).map(t => String(t).toLowerCase());
    }
    return [];
}

/**
 * Minimal ExperimentationEngine - hardcoded tag rules for prototype validation
 */
export class ExperimentationEngine {
    constructor() {
        /** @type {Array<{match: (tags: string[]) => boolean, result: Object, name: string}>} */
        this._rules = this._buildRules();
    }

    /**
     * Build hardcoded tag combination rules
     * @private
     */
    _buildRules() {
        return [
            // Herb + Medicinal + Life -> Healing Potion
            {
                match: (tags) =>
                    tags.includes('herb') && tags.includes('medicinal') && tags.includes('life'),
                name: 'Healing Potion',
                result: {
                    name: 'Healing Potion',
                    type: 'consumable',
                    img: 'icons/consumables/potions/bottle-round-corked-red.webp',
                    system: {
                        description: { value: 'A restorative potion created through experimentation.', chat: '', unidentified: '' },
                        source: { value: '' },
                        quantity: 1,
                        weight: 0.5,
                        price: 50,
                        rarity: 'common',
                        identified: true,
                        consumableType: 'potion',
                        uses: { value: 1, max: 1, per: 'charges' }
                    }
                }
            },
            // Herb + Medicinal (no essence) -> Basic Remedy
            {
                match: (tags) =>
                    tags.includes('herb') && tags.includes('medicinal') &&
                    !tags.some(t => ['life', 'heat', 'cold', 'shadow'].includes(t)),
                name: 'Basic Remedy',
                result: {
                    name: 'Basic Remedy',
                    type: 'consumable',
                    img: 'icons/consumables/potions/bottle-round-corked-green.webp',
                    system: {
                        description: { value: 'A simple herbal remedy.', chat: '', unidentified: '' },
                        source: { value: '' },
                        quantity: 1,
                        weight: 0.25,
                        price: 10,
                        rarity: 'common',
                        identified: true,
                        consumableType: 'other',
                        uses: { value: 1, max: 1, per: 'charges' }
                    }
                }
            },
            // Metal + Ore -> Crude Metal Shard
            {
                match: (tags) => tags.includes('metal') && tags.includes('ore'),
                name: 'Crude Metal Shard',
                result: {
                    name: 'Crude Metal Shard',
                    type: 'loot',
                    img: 'icons/skills/melee/weapons-crossed-swords-yellow.webp',
                    system: {
                        description: { value: 'A rough shard of metal from experimentation.', chat: '', unidentified: '' },
                        source: { value: '' },
                        quantity: 1,
                        weight: 1,
                        price: 5,
                        rarity: 'common',
                        identified: true
                    }
                }
            },
            // Crystal + Arcane + (any essence) -> Minor Arcane Dust
            {
                match: (tags) =>
                    tags.includes('crystal') && tags.includes('arcane') &&
                    tags.some(t => ['life', 'heat', 'cold', 'shadow', 'light', 'electric'].includes(t)),
                name: 'Minor Arcane Dust',
                result: {
                    name: 'Minor Arcane Dust',
                    type: 'consumable',
                    img: 'icons/magic/symbols/runes-carved-stone-blue.webp',
                    system: {
                        description: { value: 'Faintly glowing dust with arcane properties.', chat: '', unidentified: '' },
                        source: { value: '' },
                        quantity: 1,
                        weight: 0.1,
                        price: 25,
                        rarity: 'uncommon',
                        identified: true,
                        consumableType: 'other',
                        uses: { value: 1, max: 1, per: 'charges' }
                    }
                }
            },
            // Fallback: any valid combination -> Sludge
            {
                match: () => true,
                name: 'Experimenter\'s Sludge',
                result: {
                    name: 'Experimenter\'s Sludge',
                    type: 'consumable',
                    img: 'icons/consumables/potions/bottle-round-corked.webp',
                    system: {
                        description: { value: 'A failed experiment. Perhaps the combination was wrong, or more practice is needed.', chat: '', unidentified: '' },
                        source: { value: '' },
                        quantity: 1,
                        weight: 0.5,
                        price: 1,
                        rarity: 'common',
                        identified: true,
                        consumableType: 'other',
                        uses: { value: 1, max: 1, per: 'charges' }
                    }
                }
            }
        ];
    }

    /**
     * Run experimentation with selected items
     * @param {Actor} actor - Actor performing the craft
     * @param {Item[]} items - 1-3 Foundry Items (ingredients/components/essences)
     * @returns {Promise<{success: boolean, item: Item|null, name: string, quality: string}>}
     */
    async craft(actor, items) {
        if (!actor || !items?.length || items.length > 3) {
            return { success: false, item: null, name: 'Invalid input', quality: 'Failed' };
        }

        const allTags = [];
        for (const item of items) {
            const tags = getTagsFromItem(item);
            allTags.push(...tags);
        }
        const uniqueTags = [...new Set(allTags)];

        const rule = this._rules.find(r => r.match(uniqueTags));
        if (!rule) {
            return { success: false, item: null, name: 'No matching rule', quality: 'Failed' };
        }

        const itemData = rule.result;

        try {
            const createdItems = await actor.createEmbeddedDocuments('Item', [itemData]);
            const createdItem = createdItems?.[0];

            if (createdItem) {
                await this._consumeIngredients(actor, items);
                return {
                    success: true,
                    item: createdItem,
                    name: rule.name,
                    quality: 'Basic'
                };
            }
        } catch (err) {
            console.error('[Artificer] ExperimentationEngine.craft error:', err);
            return { success: false, item: null, name: err.message, quality: 'Failed' };
        }

        return { success: false, item: null, name: 'Creation failed', quality: 'Failed' };
    }

    /**
     * Consume ingredients from actor inventory (decrement quantity or remove)
     * @private
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

let _engine = null;

/**
 * Get singleton ExperimentationEngine
 * @returns {ExperimentationEngine}
 */
export function getExperimentationEngine() {
    if (!_engine) _engine = new ExperimentationEngine();
    return _engine;
}
