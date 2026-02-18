// ==================================================================
// ===== EXPERIMENTATION ENGINE (Prototype) =========================
// ==================================================================

import { MODULE } from '../const.js';
import { ArtificerComponent } from '../data/models/model-component.js';
import { resolveItemByName, getTraitsFromFlags } from '../utility-artificer-item.js';
import { ARTIFICER_TYPES } from '../schema-artificer-item.js';

/**
 * Extract all traits (tags) from a Foundry Item. Supports TYPE > FAMILY > TRAITS and legacy flags.
 * @param {Item} item - FoundryVTT Item
 * @returns {string[]} Normalized traits (lowercase)
 */
export function getTagsFromItem(item) {
    const flags = item?.flags?.[MODULE.ID] || item?.flags?.artificer;
    if (!flags) return [];
    const type = flags.type;

    if (type === ARTIFICER_TYPES.COMPONENT || type === ARTIFICER_TYPES.CREATION || type === ARTIFICER_TYPES.TOOL) {
        return getTraitsFromFlags(flags).map(t => String(t).toLowerCase());
    }
    if (type === 'ingredient' || type === 'component' || type === 'essence') {
        return getTraitsFromFlags(flags).map(t => String(t).toLowerCase());
    }
    if (type === 'apparatus' || type === 'container' || type === 'tool') {
        return getTraitsFromFlags(flags).map(t => String(t).toLowerCase());
    }
    const comp = ArtificerComponent.fromItem(item);
    if (comp?.tags?.length) return comp.tags.map(t => t.toLowerCase());
    return getTraitsFromFlags(flags).map(t => String(t).toLowerCase());
}

/**
 * ExperimentationEngine - tag-based crafting rules.
 * Uses only world items. No hardcoded templates. See documentation/core-items-required.md.
 */
export class ExperimentationEngine {
    constructor() {
        /** @type {Array<{match: (tags: string[]) => boolean, name: string}>} */
        this._rules = this._buildRules();
    }

    /**
     * Tag combination rules (result name only; item must exist in world)
     * @private
     */
    _buildRules() {
        return [
            { match: (tags) => tags.includes('herb') && tags.includes('medicinal') && tags.includes('life'), name: 'Healing Tonic' },
            {
                match: (tags) =>
                    tags.includes('herb') && tags.includes('medicinal') &&
                    !tags.some(t => ['life', 'heat', 'cold', 'shadow'].includes(t)),
                name: 'Basic Remedy'
            },
            { match: (tags) => tags.includes('metal') && tags.includes('ore'), name: 'Crude Metal Shard' },
            {
                match: (tags) =>
                    tags.includes('crystal') && tags.includes('arcane') &&
                    tags.some(t => ['life', 'heat', 'cold', 'shadow', 'light', 'electric'].includes(t)),
                name: 'Minor Arcane Dust'
            },
            { match: () => true, name: "Experimenter's Sludge" }
        ];
    }

    /**
     * Run experimentation with selected items
     * @param {Actor} actor - Actor performing the craft
     * @param {Item[]} items - 1-3 Foundry Items (ingredients/components/essences)
     * @returns {Promise<{success: boolean, item: Item|null, name: string, quality: string}>}
     */
    async craft(actor, items) {
        if (!actor || !items?.length || items.length > 6) {
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

        const worldItem = await resolveItemByName(rule.name);
        if (!worldItem) {
            return {
                success: false,
                item: null,
                name: `Required item "${rule.name}" not found in compendia or world. Create it (see documentation/core-items-required.md).`,
                quality: 'Failed'
            };
        }

        const obj = worldItem.toObject();
        delete obj._id;
        if (obj.id !== undefined) delete obj.id;

        try {
            const createdItems = await actor.createEmbeddedDocuments('Item', [obj]);
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

/** Human-readable rules for UI (tag combos → result name) */
const KNOWN_COMBINATIONS = [
    { tags: ['Herb', 'Medicinal', 'Life'], result: 'Healing Tonic' },
    { tags: ['Herb', 'Medicinal'], result: 'Basic Remedy (no essence)' },
    { tags: ['Metal', 'Ore'], result: 'Crude Metal Shard' },
    { tags: ['Crystal', 'Arcane', 'Essence'], result: 'Minor Arcane Dust (Life/Heat/Cold/Shadow/Light/Electric)' },
    { tags: ['*'], result: 'Experimenter\'s Sludge (fallback)' }
];

/**
 * Get known tag combinations for display in crafting UI
 * @returns {Array<{tags: string[], result: string}>}
 */
export function getKnownCombinations() {
    return KNOWN_COMBINATIONS;
}

/**
 * Get singleton ExperimentationEngine
 * @returns {ExperimentationEngine}
 */
export function getExperimentationEngine() {
    if (!_engine) _engine = new ExperimentationEngine();
    return _engine;
}
