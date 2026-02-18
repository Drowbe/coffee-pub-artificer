// ================================================================== 
// ===== ITEM CREATION WINDOW (ApplicationV2) ======================
// ================================================================== 

import { MODULE } from './const.js';
import { createArtificerItem, updateArtificerItem, validateArtificerData, getTraitsFromFlags, getFamilyFromFlags, getArtificerTypeFromFlags } from './utility-artificer-item.js';
import { ARTIFICER_TYPES, FAMILIES_BY_TYPE, FAMILY_LABELS } from './schema-artificer-item.js';
import { INGREDIENT_RARITIES } from './schema-ingredients.js';
import { COMPONENT_TYPES } from './schema-components.js';
import { ESSENCE_AFFINITIES } from './schema-essences.js';
import { getTagManager } from './systems/tag-manager.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Item Creation Form - ApplicationV2 implementation
 * Unified form for creating ingredients, components, and essences
 */
export class ArtificerItemForm extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(foundry.utils.mergeObject({}, super.DEFAULT_OPTIONS ?? {}), {
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
        this.itemType = options.itemType || ARTIFICER_TYPES.COMPONENT;
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
        const flags = this.itemData?.flags?.[MODULE.ID] ?? {};
        const artificerType = this._formState?.artificerType ?? getArtificerTypeFromFlags(flags) ?? this.itemType ?? ARTIFICER_TYPES.COMPONENT;
        const selectedFamily = this._formState?.family ?? getFamilyFromFlags(flags) ?? '';
        const existingTraits = getTraitsFromFlags(flags);

        const artificerTypeOptions = Object.values(ARTIFICER_TYPES).map(t => ({
            value: t,
            label: t,
            selected: t === artificerType
        }));

        const families = FAMILIES_BY_TYPE[artificerType] || [];
        const familyOptions = families.map(f => ({
            value: f,
            label: FAMILY_LABELS[f] ?? f,
            selected: f === selectedFamily
        }));

        const itemType5eOptions = [
            { value: 'consumable', label: 'Consumable', selected: (this.itemData?.type || 'consumable') === 'consumable' },
            { value: 'weapon', label: 'Weapon', selected: false },
            { value: 'equipment', label: 'Equipment', selected: false },
            { value: 'tool', label: 'Tool', selected: false },
            { value: 'loot', label: 'Loot', selected: false }
        ];
        if (this.itemData?.type) {
            itemType5eOptions.forEach(opt => { if (opt.value === this.itemData.type) opt.selected = true; });
        }

        const consumableSubtypeOptions = [
            { value: 'potion', label: 'Potion', selected: false },
            { value: 'poison', label: 'Poison', selected: false },
            { value: 'food', label: 'Food', selected: false },
            { value: 'other', label: 'Other', selected: false }
        ];
        const consumableTypeValue = this.itemData?.system?.type?.value ?? this.itemData?.system?.consumableType ?? 'other';
        consumableSubtypeOptions.forEach(opt => { if (opt.value === consumableTypeValue) opt.selected = true; });

        const componentTypeOptions = Object.values(COMPONENT_TYPES).map(t => ({
            value: t,
            label: t,
            selected: (flags.componentType || '') === t
        }));
        const affinityOptions = Object.values(ESSENCE_AFFINITIES).map(a => ({
            value: a,
            label: a,
            selected: (flags.affinity || '') === a
        }));

        const tagManager = getTagManager();
        const traitCandidates = tagManager.getAllTags();

        const mergedContext = {
            isEditMode: this.isEditMode,
            itemType: artificerType,
            itemTypeName: artificerType,
            isComponent: artificerType === ARTIFICER_TYPES.COMPONENT,
            artificerTypeOptions,
            familyOptions,
            itemName: this.itemData?.name || '',
            itemType5e: this.itemData?.type || 'consumable',
            itemType5eOptions,
            isConsumable: (this.itemData?.type || 'consumable') === 'consumable',
            consumableSubtype: consumableTypeValue,
            consumableSubtypeOptions,
            itemDescription: (this.itemData?.system?.description?.value ?? this.itemData?.description ?? '') || '',
            traitsValue: existingTraits.join(','),
            traitCandidates,
            skillLevel: flags.skillLevel ?? 1,
            family: selectedFamily,
            biomes: (flags.biomes || []).join(', '),
            componentType: flags.componentType || '',
            componentTypeOptions,
            affinity: flags.affinity || '',
            affinityOptions
        };
        this._lastContext = mergedContext;
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
        const root = this.element ?? html?.closest?.('form') ?? html?.querySelector?.('.artificer-window') ?? html;
        const query = (sel) => root?.querySelector?.(sel);

        // Event delegation: submit button may not be found by direct query when app is embedded (Blacksmith bar)
        root?.addEventListener?.('click', (e) => {
            if (e.target?.closest?.('[data-action="submit"]')) {
                e.preventDefault();
                e.stopPropagation();
                const form = this.form ?? this.element;
                if (form && typeof this.submit === 'function') {
                    this.submit().catch((err) => {
                        ui.notifications?.error?.(err?.message ?? 'Submit failed');
                        console.error('Artificer Item Form submit error:', err);
                    });
                } else if (form) {
                    // Fallback: call handler directly if submit() no-ops (e.g. form getter returns null)
                    const fd = new FormData(form);
                    this._handleSubmit(fd);
                }
            }
        });

        const artificerTypeSelect = query('#artificerType');
        if (artificerTypeSelect) {
            artificerTypeSelect.addEventListener('change', (event) => {
                this.itemType = event.target.value;
                this._formState = this._formState ?? {};
                this._formState.artificerType = event.target.value;
                this._formState.family = null;
                this.render();
            });
        }

        const familySelect = query('#family');
        if (familySelect) {
            familySelect.addEventListener('change', (event) => {
                this._formState = this._formState ?? {};
                this._formState.family = event.target.value || null;
                this.render();
            });
        }

        this._setupTagPicker(root);
        
        const cancelButton = query('[data-action="cancel"]');
        if (cancelButton) {
            cancelButton.addEventListener('click', (event) => {
                event.preventDefault();
                this.close();
            });
        }
    }

    /**
     * Set up the secondary-tags tag picker: input with suggestions dropdown, pills with remove
     * @param {HTMLElement} root
     */
    _setupTagPicker(root) {
        const input = root?.querySelector('#artificer-tag-input');
        const suggestionsEl = root?.querySelector('#artificer-tag-suggestions');
        const pillsEl = root?.querySelector('#artificer-tag-pills');
        const hiddenInput = root?.querySelector('#artificer-traits-hidden');
        const clearBtn = root?.querySelector('.artificer-tag-input-clear');
        if (!input || !suggestionsEl || !pillsEl || !hiddenInput) return;

        const candidates = (this._lastContext?.traitCandidates ?? []).slice();

        const getSelectedTags = () => {
            const val = hiddenInput?.value ?? '';
            return val ? val.split(',').map(t => t.trim()).filter(Boolean) : [];
        };

        const setSelectedTags = (tags) => {
            const unique = [...new Set(tags)];
            hiddenInput.value = unique.join(',');
            this._renderPills(pillsEl, hiddenInput, unique, removeTag);
            this._renderSuggestions(suggestionsEl, input, unique, candidates);
        };

        const addTag = (tag) => {
            const current = getSelectedTags();
            if (tag && !current.includes(tag)) {
                setSelectedTags([...current, tag]);
                input.value = '';
            }
        };

        const removeTag = (tag) => {
            setSelectedTags(getSelectedTags().filter(t => t !== tag));
        };

        input.addEventListener('focus', () => {
            this._renderSuggestions(suggestionsEl, input, getSelectedTags(), candidates);
            suggestionsEl.classList.add('visible');
        });
        input.addEventListener('blur', () => {
            setTimeout(() => suggestionsEl.classList.remove('visible'), 150);
        });
        input.addEventListener('input', () => {
            this._renderSuggestions(suggestionsEl, input, getSelectedTags(), candidates);
            suggestionsEl.classList.add('visible');
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const val = input.value.trim();
                const match = candidates.find(c => c.toLowerCase() === val.toLowerCase());
                if (match) addTag(match);
            }
        });

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                input.value = '';
                input.focus();
            });
        }

        suggestionsEl.addEventListener('mousedown', (e) => e.preventDefault());
        suggestionsEl.addEventListener('click', (e) => {
            e.preventDefault();
            const tag = e.target?.closest('[data-tag]')?.getAttribute('data-tag');
            if (tag) addTag(tag);
        });

        setSelectedTags(getSelectedTags());
    }

    _renderPills(pillsEl, hiddenInput, tags, onRemove) {
        pillsEl.innerHTML = '';
        for (const tag of tags) {
            const pill = document.createElement('span');
            pill.className = 'artificer-tag-pill';
            pill.innerHTML = `${tag} <button type="button" class="artificer-tag-pill-remove" data-tag="${tag}" aria-label="Remove"><i class="fa-solid fa-times"></i></button>`;
            pill.querySelector('.artificer-tag-pill-remove').addEventListener('click', (e) => {
                e.preventDefault();
                onRemove(tag);
            });
            pillsEl.appendChild(pill);
        }
    }

    _renderSuggestions(suggestionsEl, input, selected, candidates) {
        const filter = (input?.value ?? '').toLowerCase().trim();
        const available = candidates.filter(c => !selected.includes(c) && (!filter || c.toLowerCase().includes(filter)));
        suggestionsEl.innerHTML = '';
        if (available.length === 0) {
            suggestionsEl.classList.remove('visible');
            return;
        }
        for (const tag of available) {
            const opt = document.createElement('div');
            opt.className = 'artificer-tag-suggestion';
            opt.setAttribute('data-tag', tag);
            opt.setAttribute('role', 'option');
            opt.textContent = tag;
            suggestionsEl.appendChild(opt);
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

        this.itemType = formObject.artificerType || this.itemType || ARTIFICER_TYPES.COMPONENT;

        // Core item fields only; source and license hard-coded. Price, rarity, weight not set (user can set in item sheet).
        const SOURCE_LABEL = 'Artificer';
        const SOURCE_LICENSE = 'Use CC BY-NC 4.0';
        const itemData = {
            name: (formObject.itemName || '').trim() || 'Unnamed Item',
            type: formObject.itemType5e || 'consumable',
            img: '',
            system: {
                description: { value: formObject.itemDescription ?? '', chat: '', unidentified: '' },
                source: { value: SOURCE_LABEL, custom: SOURCE_LABEL, license: SOURCE_LICENSE }
            }
        };
        if (itemData.type === 'consumable' && formObject.consumableSubtype) {
            itemData.system.type = { value: formObject.consumableSubtype, subtype: '', baseItem: '' };
        }

        const traits = (formObject.traits || '')
            ? formObject.traits.split(',').map(t => t.trim()).filter(Boolean)
            : [];

        const artificerData = {
            type: this.itemType,
            family: formObject.family || '',
            traits,
            skillLevel: Math.max(1, parseInt(formObject.skillLevel, 10) || 1),
            rarity: 'Common'
        };

        if (this.itemType === ARTIFICER_TYPES.COMPONENT) {
            artificerData.biomes = formObject.biomes
                ? formObject.biomes.split(',').map(b => b.trim()).filter(Boolean)
                : [];
            if (formObject.componentType) artificerData.componentType = formObject.componentType;
            if (formObject.affinity) artificerData.affinity = formObject.affinity;
        }
        
        try {
            validateArtificerData(artificerData);

            if (this.isEditMode) {
                const systemMerge = {
                    description: itemData.system?.description ?? {},
                    source: { value: SOURCE_LABEL, custom: SOURCE_LABEL, license: SOURCE_LICENSE }
                };
                if (itemData.type === 'consumable' && formObject.consumableSubtype) {
                    systemMerge.type = { value: formObject.consumableSubtype, subtype: '', baseItem: '' };
                }
                itemData.system = foundry.utils.mergeObject(this.existingItem.system ?? {}, systemMerge);
                itemData.img = this.existingItem.img || itemData.img;
                await updateArtificerItem(this.existingItem, itemData, artificerData);
                await this.close();
                ui.notifications.info(`Updated ${itemData.name}`);
            } else {
                const createdItem = await createArtificerItem(itemData, artificerData, {});
                if (!createdItem) throw new Error('Failed to create item');
                await this.close();
                createdItem.sheet?.render(true);
                ui.notifications.info(`Created ${itemData.name}. Open the item sheet to set price, weight, and other details.`);
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

