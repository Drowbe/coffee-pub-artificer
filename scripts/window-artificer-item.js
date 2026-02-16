// ================================================================== 
// ===== ITEM CREATION WINDOW (ApplicationV2) ======================
// ================================================================== 

import { MODULE } from './const.js';
import { createArtificerItem, updateArtificerItem, validateArtificerData } from './utility-artificer-item.js';
import { INGREDIENT_FAMILIES, INGREDIENT_RARITIES } from './schema-ingredients.js';
import { COMPONENT_TYPES } from './schema-components.js';
import { ESSENCE_AFFINITIES } from './schema-essences.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Item Creation Form - ApplicationV2 implementation
 * Unified form for creating ingredients, components, and essences
 */
export class ArtificerItemForm extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS ?? {}, {
        id: 'artificer-item-form',
        classes: ['window-artificer-item', 'artificer-item-form'],
        position: { width: 600, height: 560 },
        window: { title: 'Artificer Item', resizable: true, minimizable: true },
        tag: 'form',
        form: {
            handler: ArtificerItemForm.handleForm,
            submitOnChange: false,
            closeOnSubmit: false
        },
        actions: {
            submit: ArtificerItemForm.onSubmitAction
        }
    });

    static PARTS = {
        body: {
            template: 'modules/coffee-pub-artificer/templates/item-form.hbs'
        }
    };

    constructor(options = {}) {
        const opts = foundry.utils.mergeObject({}, options);
        const isEdit = (options.mode === 'edit' && options.item);
        opts.id = opts.id ?? `${ArtificerItemForm.DEFAULT_OPTIONS.id}-${foundry.utils.randomID().slice(0, 8)}`;
        opts.window = foundry.utils.mergeObject(opts.window ?? {}, {
            title: isEdit ? 'Edit Artificer Item' : 'Create Artificer Item'
        });
        super(opts);
        this.itemType = options.itemType || 'ingredient';
        this.itemData = options.itemData || null;
        this.existingItem = options.item || null;
        this.mode = options.mode || 'create';
    }

    get isEditMode() {
        return this.mode === 'edit' && this.existingItem;
    }

    /**
     * Template context for Handlebars (AppV2 best practice: use getData).
     * _prepareContext delegates here for mixins that call it.
     */
    async getData(options = {}) {
        const context = {};
        
        // Item type options
        const itemTypeNames = {
            ingredient: 'Ingredient',
            component: 'Component',
            essence: 'Essence'
        };
        
        // D&D 5e item type options (most ingredients are consumables)
        const itemType5eOptions = [
            { value: 'consumable', label: 'Consumable', selected: (this.itemType === 'ingredient') },
            { value: 'weapon', label: 'Weapon', selected: false },
            { value: 'equipment', label: 'Equipment', selected: false },
            { value: 'tool', label: 'Tool', selected: false },
            { value: 'loot', label: 'Loot', selected: false }
        ];
        
        // Rarity options
        const rarityOptions = Object.values(INGREDIENT_RARITIES).map(rarity => ({
            value: rarity,
            label: rarity,
            selected: false
        }));
        
        // Family options (for ingredients)
        const familyOptions = Object.values(INGREDIENT_FAMILIES).map(family => ({
            value: family,
            label: family,
            selected: false
        }));
        
        // Component type options
        const componentTypeOptions = Object.values(COMPONENT_TYPES).map(type => ({
            value: type,
            label: type,
            selected: false
        }));
        
        // Affinity options (for essences)
        const affinityOptions = Object.values(ESSENCE_AFFINITIES).map(affinity => ({
            value: affinity,
            label: affinity,
            selected: false
        }));
        
        // Set selected options
        if (this.itemData?.flags?.[MODULE.ID]?.family) {
            const selectedFamily = this.itemData.flags[MODULE.ID].family;
            familyOptions.forEach(opt => {
                if (opt.value === selectedFamily) opt.selected = true;
            });
        }
        
        if (this.itemData?.flags?.[MODULE.ID]?.componentType) {
            const selectedType = this.itemData.flags[MODULE.ID].componentType;
            componentTypeOptions.forEach(opt => {
                if (opt.value === selectedType) opt.selected = true;
            });
        }
        
        if (this.itemData?.flags?.[MODULE.ID]?.affinity) {
            const selectedAffinity = this.itemData.flags[MODULE.ID].affinity;
            affinityOptions.forEach(opt => {
                if (opt.value === selectedAffinity) opt.selected = true;
            });
        }
        
        if (this.itemData?.rarity) {
            rarityOptions.forEach(opt => {
                if (opt.value === this.itemData.rarity) opt.selected = true;
            });
        }
        
        if (this.itemData?.type) {
            itemType5eOptions.forEach(opt => {
                if (opt.value === this.itemData.type) opt.selected = true;
            });
        }
        
        // Merge with existing context
        const mergedContext = foundry.utils.mergeObject(context, {
            isEditMode: this.isEditMode,
            itemType: this.itemType,
            itemTypeName: itemTypeNames[this.itemType] || 'Item',
            isIngredient: this.itemType === 'ingredient',
            isComponent: this.itemType === 'component',
            isEssence: this.itemType === 'essence',
            itemName: this.itemData?.name || '',
            itemType5e: this.itemData?.type || 'consumable',
            itemType5eOptions: itemType5eOptions,
            itemWeight: this.itemData?.weight || 0,
            itemPrice: this.itemData?.price || '',
            itemRarity: this.itemData?.rarity || 'Common',
            rarityOptions: rarityOptions,
            itemDescription: this.itemData?.description || '',
            primaryTag: this.itemData?.flags?.[MODULE.ID]?.primaryTag || '',
            secondaryTags: (this.itemData?.flags?.[MODULE.ID]?.secondaryTags || []).join(', '),
            tier: this.itemData?.flags?.[MODULE.ID]?.tier || 1,
            family: this.itemData?.flags?.[MODULE.ID]?.family || '',
            familyOptions: familyOptions,
            quirk: this.itemData?.flags?.[MODULE.ID]?.quirk || '',
            biomes: (this.itemData?.flags?.[MODULE.ID]?.biomes || []).join(', '),
            componentType: this.itemData?.flags?.[MODULE.ID]?.componentType || '',
            componentTypeOptions: componentTypeOptions,
            affinity: this.itemData?.flags?.[MODULE.ID]?.affinity || '',
            affinityOptions: affinityOptions
        });
        
        return mergedContext;
    }

    async _prepareContext(options = {}) {
        const base = await super._prepareContext?.(options) ?? {};
        return foundry.utils.mergeObject(base, await this.getData(options));
    }

    /**
     * Activate event listeners (AppV2: normalize html, resolve root)
     */
    activateListeners(html) {
        super.activateListeners(html);
        if (html?.jquery ?? typeof html?.find === 'function') {
            html = html[0] ?? html.get?.(0) ?? html;
        }
        const root = html?.matches?.('.artificer-window') ? html : html?.querySelector?.('.artificer-window') ?? html;
        const form = root?.tagName === 'FORM' ? root : root?.querySelector?.('form');
        const query = (selector) => (form ?? root)?.querySelector?.(selector);
        
        // Explicitly wire submit: ApplicationV2 actions may not fire when app is embedded (e.g. Blacksmith bar)
        const submitBtn = query('[data-action="submit"]');
        if (submitBtn) {
            submitBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.submit();
            });
        }
        
        const typeSelect = query('#itemType');
        if (typeSelect) {
            typeSelect.addEventListener('change', (event) => {
                this.itemType = event.target.value;
                this.render();
            });
        }
        
        const cancelButton = query('[data-action="cancel"]');
        if (cancelButton) {
            cancelButton.addEventListener('click', (event) => {
                event.preventDefault();
                this.close();
            });
        }
    }

    /**
     * ApplicationV2 action: triggers programmatic form submit (used when native submit doesn't fire).
     */
    static async onSubmitAction(event) {
        event?.preventDefault?.();
        return this.submit();
    }

    /**
     * ApplicationV2 form handler (invoked by submit() or native form submit).
     * @param {SubmitEvent} event
     * @param {HTMLFormElement} form
     * @param {FormData|FormDataExtended} formData
     */
    static async handleForm(event, form, formData) {
        event.preventDefault();
        if (!(this instanceof ArtificerItemForm)) return;
        return this._handleSubmit(formData);
    }

    /**
     * Process form submission using FormData
     * @param {FormData} formData
     */
    async _handleSubmit(formData) {
        const formObject = formData?.object ?? (() => {
            const obj = {};
            if (formData?.entries) {
                for (const [key, value] of formData.entries()) {
                    if (key.endsWith('[]')) {
                        const arrayKey = key.slice(0, -2);
                        if (!obj[arrayKey]) obj[arrayKey] = [];
                        obj[arrayKey].push(value);
                    } else {
                        obj[key] = value;
                    }
                }
            }
            return obj;
        })();

        // Track current item type from the form
        this.itemType = formObject.itemType || this.itemType || 'ingredient';

        // Parse item data
        const itemData = {
            name: formObject.itemName || '',
            type: formObject.itemType5e || 'consumable',
            weight: parseFloat(formObject.itemWeight) || 0,
            price: parseFloat(formObject.itemPrice) || 0, // Ensure price is a number
            rarity: formObject.itemRarity || 'Common',
            description: formObject.itemDescription || '',
            img: ''
        };
        
        // Parse artificer data
        const artificerData = {
            primaryTag: formObject.primaryTag || '',
            secondaryTags: formObject.secondaryTags 
                ? formObject.secondaryTags.split(',').map(t => t.trim()).filter(t => t)
                : [],
            tier: parseInt(formObject.tier) || 1,
            rarity: formObject.itemRarity || 'Common'
        };
        
        // Add type-specific fields
        if (this.itemType === 'ingredient') {
            artificerData.family = formObject.family || '';
            artificerData.quirk = formObject.quirk || null;
            artificerData.biomes = formObject.biomes 
                ? formObject.biomes.split(',').map(b => b.trim()).filter(b => b)
                : [];
        } else if (this.itemType === 'component') {
            artificerData.componentType = formObject.componentType || '';
        } else if (this.itemType === 'essence') {
            artificerData.affinity = formObject.affinity || '';
        }
        
        try {
            // Validate
            validateArtificerData(artificerData, this.itemType);
            
            if (this.isEditMode) {
                itemData.system = this.existingItem.system ?? {};
                itemData.img = this.existingItem.img || itemData.img;
                await updateArtificerItem(this.existingItem, itemData, artificerData);
                await this.close();
                ui.notifications.info(`Updated ${itemData.name}`);
            } else {
                const createdItem = await createArtificerItem(itemData, artificerData, {
                    type: this.itemType
                });
                if (!createdItem) throw new Error('Failed to create item');
                await this.close();
                ui.notifications.info(`Created ${itemData.name}`);
            }
        } catch (error) {
            const errorMessage = error.message || String(error);
            ui.notifications.error(`Error creating item: ${errorMessage}`);
            console.error('Artificer Item Form Error:', error);
            console.error('Error stack:', error.stack);
            // Don't re-throw - we want to show the error but not crash
        }
    }
}

