// ================================================================== 
// ===== ITEM CREATION WINDOW (ApplicationV2) ======================
// ================================================================== 

import { MODULE } from './const.js';
import { OFFICIAL_BIOMES } from './schema-ingredients.js';
import { createArtificerItem, updateArtificerItem, validateArtificerData, getTraitsFromFlags, getFamilyFromFlags, getArtificerTypeFromFlags } from './utility-artificer-item.js';
import { ARTIFICER_TYPES, FAMILIES_BY_TYPE, FAMILY_LABELS, deriveItemTypeFromArtificer, ARTIFICER_FLAG_KEYS } from './schema-artificer-item.js';
import { INGREDIENT_RARITIES } from './schema-ingredients.js';
import { ESSENCE_AFFINITIES } from './schema-essences.js';
import { getTagManager } from './systems/tag-manager.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Module-level ref for document delegation (activateListeners may not run with PARTS) */
let _currentItemFormRef = null;
let _itemFormDelegationAttached = false;

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
        const selectedFamily = Object.prototype.hasOwnProperty.call(this._formState ?? {}, 'family')
            ? (this._formState?.family ?? '')
            : (getFamilyFromFlags(flags) ?? '');
        const existingTraits = getTraitsFromFlags(flags);

        const artificerTypeOptions = Object.values(ARTIFICER_TYPES).map(t => ({
            value: t,
            label: t,
            selected: t === artificerType
        }));

        // Family options driven by selected type (like crafting window)
        const families = FAMILIES_BY_TYPE[artificerType] || [];
        const familyOptions = families.map(f => ({
            value: f,
            label: FAMILY_LABELS[f] ?? f,
            selected: f === selectedFamily
        }));

        const affinityVal = flags[ARTIFICER_FLAG_KEYS.AFFINITY] ?? flags.affinity ?? '';
        const affinityOptions = Object.values(ESSENCE_AFFINITIES).map(a => ({
            value: a,
            label: a,
            selected: (affinityVal || '') === a
        }));

        const tagManager = getTagManager();
        const traitCandidates = tagManager.getAllTags();
        const skillLevel = Math.max(1, Math.min(20, Math.floor(flags[ARTIFICER_FLAG_KEYS.SKILL_LEVEL] ?? flags.skillLevel ?? 1)));

        const mergedContext = {
            isEditMode: this.isEditMode,
            itemType: artificerType,
            itemTypeName: artificerType,
            isComponent: artificerType === ARTIFICER_TYPES.COMPONENT,
            isEssenceFamily: selectedFamily === 'Essence',
            artificerTypeOptions,
            familyOptions,
            itemName: this.itemData?.name || '',
            traitsValue: existingTraits.join(','),
            traitCandidates,
            skillLevel,
            skillLevelFillPercent: ((skillLevel - 1) / 19) * 100,
            family: selectedFamily,
            biomeOptions: OFFICIAL_BIOMES.map(b => {
                const flagBiomes = flags[ARTIFICER_FLAG_KEYS.BIOMES] ?? flags.biomes ?? [];
                const selected = (this._formState?.selectedBiomes ?? (Array.isArray(flagBiomes) ? flagBiomes : [])).includes(b);
                return { name: b, selected };
            }),
            biomesValue: (() => {
                const flagBiomes = flags[ARTIFICER_FLAG_KEYS.BIOMES] ?? flags.biomes ?? [];
                const arr = this._formState?.selectedBiomes ?? (Array.isArray(flagBiomes) ? flagBiomes.filter(b => OFFICIAL_BIOMES.includes(b)) : []);
                return arr.join(',');
            })(),
            quirk: this._formState?.quirk ?? (flags[ARTIFICER_FLAG_KEYS.QUIRK] ?? flags.quirk ?? ''),
            affinity: affinityVal || '',
            affinityOptions
        };
        this._lastContext = mergedContext;
        return mergedContext;
    }

    async _prepareContext(options = {}) {
        const base = await super._prepareContext?.(options) ?? {};
        return foundry.utils.mergeObject(base, await this.getData(options));
    }

    _getItemFormRoot() {
        return document.getElementById(this.id) ?? this.element ?? null;
    }

    /**
     * Document-level delegation (activateListeners may not run with ApplicationV2 PARTS).
     */
    _attachItemFormDelegationOnce() {
        _currentItemFormRef = this;
        if (_itemFormDelegationAttached) return;
        _itemFormDelegationAttached = true;

        document.addEventListener('click', (e) => {
            const w = _currentItemFormRef;
            if (!w) return;
            const root = w._getItemFormRoot();
            if (!root?.contains?.(e.target)) return;

            const biomeBtn = e.target?.closest?.('[data-action="toggleBiome"]');
            if (biomeBtn?.dataset?.biome) {
                e.preventDefault();
                e.stopPropagation();
                w._toggleBiome(biomeBtn.dataset.biome);
                return;
            }
            if (e.target?.closest?.('[data-action="deleteArtificer"]')) {
                e.preventDefault();
                e.stopPropagation();
                w._handleDeleteArtificer();
                return;
            }
            if (e.target?.closest?.('[data-action="cancel"]')) {
                e.preventDefault();
                e.stopPropagation();
                w.close();
                return;
            }
            if (e.target?.closest?.('[data-action="submit"]')) {
                e.preventDefault();
                e.stopPropagation();
                const form = w.form ?? w.element;
                if (form && typeof w.submit === 'function') {
                    w.submit().catch((err) => {
                        ui.notifications?.error?.(err?.message ?? 'Submit failed');
                        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Artificer Item Form submit error', err?.message ?? String(err), true, false);
                    });
                } else if (form) {
                    w._handleSubmit(new FormData(form));
                }
            }
        });

        document.addEventListener('change', (e) => {
            const w = _currentItemFormRef;
            if (!w) return;
            const root = w._getItemFormRoot();
            if (!root?.contains?.(e.target)) return;
            const el = e.target;
            if (el.id === 'artificerType') {
                const newType = el.value;
                w.itemType = newType;
                w._formState = w._formState ?? {};
                w._formState.artificerType = newType;
                const families = FAMILIES_BY_TYPE[newType] ?? [];
                if (w._formState.family && !families.includes(w._formState.family)) w._formState.family = '';
                w.render();
            } else if (el.id === 'family') {
                w._formState = w._formState ?? {};
                w._formState.family = el.value || '';
                w.render();
            }
        });

        document.addEventListener('input', (e) => {
            const w = _currentItemFormRef;
            if (!w) return;
            const root = w._getItemFormRoot();
            if (!root?.contains?.(e.target)) return;
            const el = e.target;
            if (el.id === 'skillLevel') {
                const valEl = root?.querySelector?.('.artificer-skill-current-value');
                if (valEl) valEl.textContent = el.value;
                return;
            }
            if (el.id === 'artificer-quirk') {
                w._formState = w._formState ?? {};
                w._formState.quirk = (el.value ?? '').trim();
            }
        });
    }

    async _onFirstRender(context, options) {
        await super._onFirstRender?.(context, options);
        this._attachItemFormDelegationOnce();
    }

    /**
     * Activate listeners (document delegation + tag picker).
     */
    activateListeners(html) {
        super.activateListeners(html);
        this._attachItemFormDelegationOnce();
        const root = this._getItemFormRoot();
        if (root) this._setupTagPicker(root);
    }

    /**
     * Toggle a biome in the multiselect.
     * @param {string} biome - Official biome name (e.g. FOREST)
     */
    _toggleBiome(biome) {
        if (!OFFICIAL_BIOMES.includes(biome)) return;
        const f = this.itemData?.flags?.[MODULE.ID] ?? this.existingItem?.flags?.[MODULE.ID] ?? {};
        const flagBiomes = f[ARTIFICER_FLAG_KEYS.BIOMES] ?? f.biomes ?? [];
        const current = this._formState?.selectedBiomes ?? (Array.isArray(flagBiomes) ? flagBiomes.filter(b => OFFICIAL_BIOMES.includes(b)) : []);
        const next = current.includes(biome) ? current.filter(b => b !== biome) : [...current, biome];
        this._formState = this._formState ?? {};
        this._formState.selectedBiomes = next;
        this.render();
    }

    /**
     * Remove Artificer flags from the item (keeps the item itself).
     */
    async _handleDeleteArtificer() {
        const item = this.existingItem;
        if (!item) return;
        try {
            const updateData = {};
            if (item.flags?.[MODULE.ID]) updateData[`flags.-=${MODULE.ID}`] = null;
            if (item.flags?.artificer) updateData['flags.-=artificer'] = null;
            if (Object.keys(updateData).length > 0) {
                await item.update(updateData);
                ui.notifications.info(`Artificer data removed from ${item.name}`);
            }
            await this.close();
            item.sheet?.render(true);
        } catch (err) {
            ui.notifications?.error?.(err?.message ?? 'Failed to remove Artificer data');
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Delete Artificer error', err?.message ?? String(err), true, false);
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
        const family = formObject.family || '';

        // Derive D&D 5e type/subtype from Artificer type + family
        const derived = deriveItemTypeFromArtificer(this.itemType, family);

        // Core item fields only; source and license hard-coded. Price, rarity, weight not set (user can set in item sheet).
        const SOURCE_LABEL = 'Artificer';
        const SOURCE_LICENSE = 'Use CC BY-NC 4.0';
        const itemData = {
            name: (formObject.itemName || '').trim() || 'Unnamed Item',
            type: derived.type,
            img: '',
            system: {
                description: { value: '', chat: '', unidentified: '' },
                source: { value: SOURCE_LABEL, custom: SOURCE_LABEL, license: SOURCE_LICENSE }
            }
        };
        if (derived.type === 'consumable' && derived.subtype) {
            itemData.system.type = { value: derived.subtype, subtype: '', baseItem: '' };
        } else if (derived.type === 'tool' && derived.toolType !== undefined) {
            itemData.system.toolType = derived.toolType;
        } else if (derived.type === 'loot' && derived.subtype) {
            itemData.system.type = { value: derived.subtype, subtype: '', baseItem: '' };
        }

        const traits = (formObject.traits || '')
            ? formObject.traits.split(',').map(t => t.trim()).filter(Boolean)
            : [];

        const artificerData = {
            type: this.itemType,
            family,
            traits,
            skillLevel: Math.max(1, Math.min(20, parseInt(formObject.skillLevel, 10) || 1)),
            rarity: 'Common'
        };

        if (this.itemType === ARTIFICER_TYPES.COMPONENT) {
            const rawBiomes = formObject.biomes
                ? formObject.biomes.split(',').map(b => b.trim()).filter(Boolean)
                : [];
            artificerData.biomes = rawBiomes.filter(b => OFFICIAL_BIOMES.includes(b));
            if (formObject.affinity) artificerData.affinity = formObject.affinity;
            const quirkVal = (formObject.quirk || '').trim();
            if (quirkVal) artificerData.quirk = quirkVal;
        }
        
        try {
            validateArtificerData(artificerData);

            if (this.isEditMode) {
                const systemMerge = {
                    source: { value: SOURCE_LABEL, custom: SOURCE_LABEL, license: SOURCE_LICENSE }
                };
                if (derived.type === 'consumable' && derived.subtype) {
                    systemMerge.type = { value: derived.subtype, subtype: '', baseItem: '' };
                } else if (derived.type === 'tool' && derived.toolType !== undefined) {
                    systemMerge.toolType = derived.toolType;
                } else if (derived.type === 'loot' && derived.subtype) {
                    systemMerge.type = { value: derived.subtype, subtype: '', baseItem: '' };
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
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'Artificer Item Form Error', error?.message ?? String(error), true, true);
            // Don't re-throw - we want to show the error but not crash
        }
    }
}

