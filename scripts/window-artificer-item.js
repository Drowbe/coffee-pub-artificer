// ================================================================== 
// ===== ITEM CREATION WINDOW (ApplicationV2) ======================
// ================================================================== 

import { MODULE } from './const.js';
import { createArtificerItem, validateArtificerData } from './utility-artificer-item.js';
import { INGREDIENT_FAMILIES, INGREDIENT_RARITIES } from './schema-ingredients.js';
import { COMPONENT_TYPES } from './schema-components.js';
import { ESSENCE_AFFINITIES } from './schema-essences.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Item Creation Form - ApplicationV2 implementation
 * Unified form for creating ingredients, components, and essences
 */
export class ArtificerItemForm extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
        id: 'artificer-item-form',
        title: 'Create Artificer Item',
        width: 600,
        height: 'auto',
        resizable: true,
        tag: 'form'
    });

    static PARTS = {
        body: {
            template: 'modules/coffee-pub-artificer/templates/item-form.hbs'
        }
    };

    constructor(options = {}) {
        super(options);
        this.itemType = options.itemType || 'ingredient';
        this.itemData = options.itemData || null;
    }

    /**
     * Prepare template context
     * @param {Object} options - Render options
     * @returns {Promise<Object>} Template context
     */
    async _prepareContext(options = {}) {
        const context = await super._prepareContext(options);
        
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

    /**
     * Render the application
     * @param {Object} options - Render options
     * @returns {Promise<ApplicationV2>}
     */
    async render(options = {}) {
        return await super.render(options);
    }

    /**
     * Activate event listeners
     * @param {HTMLElement} html - Root HTML element
     */
    activateListeners(html) {
        super.activateListeners(html);
        
        // Handle jQuery conversion if needed (v13 migration pattern)
        let nativeHtml = html;
        if (html && (html.jquery || typeof html.find === 'function')) {
            nativeHtml = html[0] || html.get?.(0) || html;
        }
        
        // Type selector change - updates form when type changes
        const typeSelect = nativeHtml.querySelector('#itemType');
        if (typeSelect) {
            typeSelect.addEventListener('change', (event) => {
                this.itemType = event.target.value;
                this.render();
            });
        }
        
        // Form submission - ApplicationV2 with tag: "form" should handle this via _onSubmitForm
        // But we'll add explicit handler as backup
        const form = nativeHtml.closest('form');
        if (form) {
            form.addEventListener('submit', (event) => {
                event.preventDefault();
                this._onSubmitForm(event);
            });
        }
    }

    /**
     * Handle form submission
     * @param {Event} event - Form submit event
     */
    async _onSubmitForm(event) {
        event.preventDefault();
        
        // Get form element
        const form = event.currentTarget.closest('form');
        if (!form) {
            ui.notifications.error('Form element not found');
            return;
        }
        
        const formData = new FormData(form);
        const formObject = {};
        
        // Convert FormData to object
        for (const [key, value] of formData.entries()) {
            if (key.endsWith('[]')) {
                const arrayKey = key.slice(0, -2);
                if (!formObject[arrayKey]) formObject[arrayKey] = [];
                formObject[arrayKey].push(value);
            } else {
                formObject[key] = value;
            }
        }
        
        // Parse item data
        const itemData = {
            name: formObject.itemName || '',
            type: formObject.itemType5e || 'consumable',
            weight: parseFloat(formObject.itemWeight) || 0,
            price: formObject.itemPrice || '0',
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
            
            // Create item - pass type in options
            const createdItem = await createArtificerItem(itemData, artificerData, {
                type: this.itemType
            });
            
            if (!createdItem) {
                throw new Error('Failed to create item');
            }
            
            // Close form
            await this.close();
            
            // Show notification
            ui.notifications.info(`Created ${itemData.name}`);
        } catch (error) {
            ui.notifications.error(`Error creating item: ${error.message}`);
            console.error('Artificer Item Form Error:', error);
        }
    }
}

