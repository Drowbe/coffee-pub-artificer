// ==================================================================
// ===== ARTIFICER CRAFTING WINDOW ===================================
// ==================================================================

import { MODULE } from './const.js';
import { postError } from './utils/helpers.js';
import { getAPI } from './api-artificer.js';
import { getExperimentationEngine, getTagsFromItem } from './systems/experimentation-engine.js';
import { resolveItemByName, getArtificerTypeFromFlags, getFamilyFromFlags } from './utility-artificer-item.js';
import { getCacheStatus, refreshCache } from './cache/cache-items.js';
import { ARTIFICER_TYPES, FAMILIES_BY_TYPE, FAMILY_LABELS, LEGACY_FAMILY_TO_FAMILY } from './schema-artificer-item.js';
import { HEAT_LEVELS, HEAT_MAX, GRIND_LEVELS, PROCESS_TYPES } from './schema-recipes.js';

/** D&D consumable subtype → family when item has no artificer flags */
const DND_CONSUMABLE_FAMILY = {
    potion: 'Herbs',
    poison: 'CreatureParts',
    scroll: 'Environmental',
    oil: 'Herbs',
    food: 'Herbs',
    ammunition: 'Minerals'
};

/**
 * Check if item is a consumable we can treat as ingredient (no artificer flags)
 * @param {Item} item
 * @returns {{ ok: boolean, family: string, type: string }}
 */
function asCraftableConsumable(item) {
    const sys = item?.system ?? {};
    const docType = (item?.type ?? '').toLowerCase();
    if (docType !== 'consumable') return { ok: false, family: '', type: '' };
    const subtype = ((sys?.type?.value ?? sys?.type?.subtype ?? sys?.consumableType ?? '') + '').toLowerCase();
    const family = DND_CONSUMABLE_FAMILY[subtype] ?? 'Environmental';
    return { ok: true, family, type: 'ingredient' };
}

/**
 * Check if actor has all ingredients for a recipe (name + type + quantity)
 * @param {Actor|null} actor
 * @param {Object} recipe - ArtificerRecipe with ingredients array
 * @returns {boolean}
 */
function recipeCanCraft(actor, recipe) {
    if (!actor || !recipe?.ingredients?.length) return false;
    const ingredients = recipe.ingredients ?? [];
    for (const ing of ingredients) {
        const need = ing.quantity ?? 1;
        const candidates = actor.items.filter((item) => {
            const f = item.flags?.[MODULE.ID] || item.flags?.artificer;
            const nameMatches = (item.name || '').trim() === (ing.name || '').trim();
            const effectiveType = f?.type === ARTIFICER_TYPES.COMPONENT ? 'component' : f?.type;
            if (effectiveType && ['ingredient', 'component', 'essence'].includes(effectiveType)) {
                return (effectiveType === (ing.type || 'ingredient')) && nameMatches;
            }
            return nameMatches;
        });
        const getQty = (item) => {
            const q = item.system?.quantity;
            return typeof q === 'number' ? q : (q?.value ?? 1);
        };
        const have = candidates.reduce((sum, item) => sum + getQty(item), 0);
        if (have < need) return false;
    }
    return true;
}

/**
 * Map journal-loaded recipes to display format for the recipe list
 * @param {string|null} selectedRecipeId
 * @param {Actor|null} actor - Crafter actor for canCraft check
 * @returns {Promise<Array<{recipeId: string, tags: string[], result: string, resultImg: string, selected?: boolean, canCraft?: boolean}>>}
 */
async function getRecipesForDisplay(selectedRecipeId, actor) {
    const api = getAPI();
    const recipes = api?.recipes?.getAll?.() ?? [];
    const results = await Promise.all(recipes.map(async (r) => {
        const tags = (r.tags?.length ? r.tags : r.ingredients?.map((i) => i.name) ?? [])
            .map((t) => (typeof t === 'string' ? t.charAt(0).toUpperCase() + t.slice(1) : String(t)));
        const resultName = (r.resultItemName || r.name || '').trim();
        const resultItem = resultName ? await resolveItemByName(resultName) : null;
        const resultImg = resultItem?.img ?? 'icons/svg/item-bag.svg';
        return {
            recipeId: r.id,
            tags: tags.length ? tags : [r.name],
            result: r.name,
            resultImg,
            selected: selectedRecipeId === r.id,
            canCraft: recipeCanCraft(actor, r)
        };
    }));
    return results;
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
        position: { width: 1100, height: 750 },
        window: { title: 'Artificer Crafting Station', resizable: true, minimizable: true },
        actions: {
            craft: CraftingWindow._actionCraft,
            clear: CraftingWindow._actionClear,
            addToSlot: CraftingWindow._actionAddToSlot,
            addToApparatus: CraftingWindow._actionAddToApparatus,
            addToContainer: CraftingWindow._actionAddToContainer,
            addToTool: CraftingWindow._actionAddToTool,
            removeFromSlot: CraftingWindow._actionRemoveFromSlot,
            removeApparatus: CraftingWindow._actionRemoveApparatus,
            removeContainer: CraftingWindow._actionRemoveContainer,
            removeTool: CraftingWindow._actionRemoveTool,
            selectRecipe: CraftingWindow._actionSelectRecipe,
            refreshCache: CraftingWindow._actionRefreshCache,
            setTimeFromRoundTimer: CraftingWindow._actionSetTimeFromRoundTimer
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
        this.selectedApparatus = null;
        this.selectedContainer = null;
        this.selectedTool = null;
        this.heatValue = options.heatValue ?? 0;
        this.grindValue = options.grindValue ?? 0;
        /** @type {'heat'|'grind'} */
        this.processType = options.processType ?? 'heat';
        this.timeValue = options.timeValue ?? 0;
        this.lastResult = null;
        this.lastCraftTags = [];
        /** @type {ArtificerRecipe|null} */
        this.selectedRecipe = null;
        this.filterFamily = options.filterFamily ?? '';
        /** Artificer TYPE (Component | Creation | Tool) for left dropdown; '' = All types */
        this.filterArtificerType = options.filterArtificerType ?? '';
        this.filterSearch = options.filterSearch ?? '';
        this.filterRecipeSearch = options.filterRecipeSearch ?? '';
        /** @type {ReturnType<typeof setTimeout>|null} */
        this._searchDebounceTimer = null;
        /** @type {number|null} - seconds remaining during craft countdown */
        this._craftingCountdownRemaining = null;
        /** @type {ReturnType<typeof setInterval>|null} */
        this._craftCountdownInterval = null;
        /** @type {{actor: Actor, items: Item[], anyMissing: boolean}|null} - stored during countdown */
        this._craftPending = null;
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
                if (f?.type && (['ingredient', 'component', 'essence', 'apparatus', 'container', 'resultContainer'].includes(f.type) || f.type === ARTIFICER_TYPES.COMPONENT || f.type === ARTIFICER_TYPES.TOOL)) return true;
                const cc = asCraftableConsumable(i);
                return cc.ok;
            })
            : [];

        let ingredients = artificerItems
            .filter(i => {
                const f = i.flags?.[MODULE.ID] || i.flags?.artificer;
                const at = getArtificerTypeFromFlags(f);
                if (at === ARTIFICER_TYPES.COMPONENT || at === ARTIFICER_TYPES.CREATION) return true;
                if (f?.type && ['ingredient', 'component', 'essence'].includes(f.type)) return true;
                return asCraftableConsumable(i).ok;
            })
            .map(i => {
                const f = i.flags?.[MODULE.ID] || i.flags?.artificer;
                const cc = asCraftableConsumable(i);
                const syntheticFlags = cc.ok ? { type: cc.type, family: cc.family } : f;
                const artificerType = getArtificerTypeFromFlags(f || syntheticFlags) ?? ARTIFICER_TYPES.COMPONENT;
                const family = getFamilyFromFlags(f || syntheticFlags) || (cc.ok ? (LEGACY_FAMILY_TO_FAMILY[cc.family] ?? cc.family) : '');
                const tags = getTagsFromItem(i).join(', ');
                return {
                    id: i.id,
                    uuid: i.uuid,
                    name: i.name,
                    img: i.img || 'icons/skills/melee/weapons-crossed-swords-yellow.webp',
                    quantity: i.system?.quantity ?? 1,
                    tags: tags || (cc.ok ? 'consumable' : ''),
                    artificerType,
                    family,
                    isContainer: false,
                    addAction: 'addToSlot'
                };
            });

        /** Apparatus: vessel to craft in (beaker, mortar). Family Apparatus → apparatus slot. */
        const apparatusItems = artificerItems
            .filter(i => {
                const f = i.flags?.[MODULE.ID] || i.flags?.artificer;
                const family = (getFamilyFromFlags(f) || f?.family || '').toLowerCase();
                return family === 'apparatus' || f?.type === 'apparatus';
            })
            .map(i => ({ ...toListRow(i, 'addToApparatus', true), artificerType: ARTIFICER_TYPES.TOOL, family: 'Apparatus' }));

        /** Container: vessel to put result in (vial, herb bag). Family Container → container slot. */
        const containerItems = artificerItems
            .filter(i => {
                const f = i.flags?.[MODULE.ID] || i.flags?.artificer;
                const family = (getFamilyFromFlags(f) || f?.family || '').toLowerCase();
                return family === 'container' || f?.type === 'resultContainer' || f?.type === 'container';
            })
            .map(i => ({ ...toListRow(i, 'addToContainer', true), artificerType: ARTIFICER_TYPES.TOOL, family: 'Container' }));

        /** Tools: kits (Alchemist's Supplies, Healer's Kit, etc.). Match by name or D&D 5e tool type. */
        const KNOWN_TOOLS = ['Alchemist\'s Supplies', 'Herbalism Kit', 'Healer\'s Kit', 'Poisoner\'s Kit', 'Thieves\' Tools', 'Disguise Kit'];
        const isKit = (item) => {
            const name = (item?.name || '').trim();
            if (KNOWN_TOOLS.includes(name)) return true;
            if (/kit$/i.test(name)) return true;
            const docType = (item?.type ?? '').toLowerCase();
            const toolType = (item?.system?.toolType ?? '').toLowerCase();
            return docType === 'tool' && /kit|herbalism|poisoner|healer|art|disguise/i.test(toolType || name);
        };
        const toolItems = actor?.items.filter(isKit)?.map(i => ({
            id: i.id,
            uuid: i.uuid,
            name: i.name,
            img: i.img || 'icons/tools/instruments/lute-gold-brown.webp',
            quantity: 1,
            tags: '',
            artificerType: ARTIFICER_TYPES.TOOL,
            family: '',
            isContainer: false,
            addAction: 'addToTool'
        })) ?? [];

        function toListRow(item, addAction, isContainer) {
            const tags = getTagsFromItem(item).join(', ');
            return {
                id: item.id,
                uuid: item.uuid,
                name: item.name,
                img: item.img || 'icons/containers/bags/pouch-simple-brown.webp',
                quantity: item.system?.quantity ?? 1,
                tags,
                isContainer,
                addAction
            };
        }

        // Apply filters: left = Artificer TYPE, right = FAMILY (driven by type)
        if (this.filterArtificerType) {
            ingredients = ingredients.filter(i => i.artificerType === this.filterArtificerType);
        }
        if (this.filterFamily) {
            ingredients = ingredients.filter(i => i.family === this.filterFamily);
        }
        if (this.filterSearch?.trim()) {
            const q = this.filterSearch.trim().toLowerCase();
            ingredients = ingredients.filter(i =>
                i.name.toLowerCase().includes(q) || (i.tags || '').toLowerCase().includes(q)
            );
        }
        const qSearch = this.filterSearch?.trim().toLowerCase() || '';
        const filteredApparatus = qSearch ? apparatusItems.filter(i => i.name.toLowerCase().includes(qSearch)) : apparatusItems;
        const filteredContainers = qSearch ? containerItems.filter(i => i.name.toLowerCase().includes(qSearch)) : containerItems;
        const filteredTools = qSearch ? toolItems.filter(i => i.name.toLowerCase().includes(qSearch)) : toolItems;

        const showApparatusOnly = this.filterArtificerType === ARTIFICER_TYPES.TOOL && this.filterFamily === 'Apparatus';
        const showContainerOnly = this.filterArtificerType === ARTIFICER_TYPES.TOOL && this.filterFamily === 'Container';
        const showToolTypeAll = this.filterArtificerType === ARTIFICER_TYPES.TOOL && !this.filterFamily;
        const showToolOnly = this.filterArtificerType === ARTIFICER_TYPES.TOOL;
        const showAllTypes = !this.filterArtificerType;
        const listItems = showApparatusOnly
            ? filteredApparatus
            : showContainerOnly
                ? filteredContainers
                : showAllTypes
                    ? [...ingredients, ...filteredApparatus, ...filteredContainers, ...filteredTools]
                    : showToolTypeAll
                        ? [...filteredApparatus, ...filteredContainers, ...filteredTools]
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

        // Left dropdown = Artificer TYPE (Component, Creation, Tool)
        const typeOptions = [
            { value: '', label: 'All types', selected: !this.filterArtificerType },
            ...Object.values(ARTIFICER_TYPES).map(t => ({
                value: t,
                label: t,
                selected: this.filterArtificerType === t
            }))
        ];
        // Right dropdown = FAMILY (options driven by selected type)
        const familiesForType = this.filterArtificerType ? (FAMILIES_BY_TYPE[this.filterArtificerType] ?? []) : [];
        const familyOptions = [
            { value: '', label: 'All families', selected: !this.filterFamily },
            ...familiesForType.map(f => ({
                value: f,
                label: FAMILY_LABELS[f] ?? f,
                selected: this.filterFamily === f
            }))
        ];

        const toSlotData = (item) => {
            if (!item) return { item: null, tooltip: '' };
            const f = item.flags?.[MODULE.ID] || item.flags?.artificer;
            const traits = getTagsFromItem(item).join(', ');
            const family = f?.family ?? '';
            return { item: { id: item.id, name: item.name, img: item.img }, tooltip: [item.name, family ? `Family: ${family}` : '', traits ? `Traits: ${traits}` : ''].filter(Boolean).join('\n') };
        };
        let apparatusSlot = toSlotData(this.selectedApparatus);
        let containerSlot = toSlotData(this.selectedContainer);
        let toolSlot = toSlotData(this.selectedTool);

        const hasSlots = this.selectedSlots.some(s => s !== null);
        const anyMissing = this.selectedSlots.some(s => s?.isMissing);
        const canCraft = hasSlots && !anyMissing;
        let knownCombinations = await getRecipesForDisplay(this.selectedRecipe?.id ?? null, actor);
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

        const cacheStatus = getCacheStatus();

        return {
            appId: this.id,
            crafterName: actor?.name ?? null,
            crafterImg: actor?.img ?? null,
            cacheStatus: { hasCache: cacheStatus.hasCache, building: cacheStatus.building, message: cacheStatus.message },
            slots,
            apparatusSlot,
            containerSlot,
            toolSlot,
            listItems,
            showApparatusOnly,
            showContainerOnly,
            showToolOnly,
            heatValue: this.heatValue,
            grindValue: this.grindValue,
            processType: this.processType,
            heat: (() => {
                const base = this.heatValue / HEAT_MAX;
                if (this._craftingCountdownRemaining == null) return base;
                const total = Math.max(1, this.timeValue);
                const remaining = this._craftingCountdownRemaining;
                const progress = 1 - remaining / total;
                return base + (1 - base) * progress;
            })(),
            heatUnstable: (() => {
                const base = this.heatValue / HEAT_MAX;
                if (this._craftingCountdownRemaining == null) return this.heatValue >= HEAT_MAX;
                const total = Math.max(1, this.timeValue);
                const remaining = this._craftingCountdownRemaining;
                const progress = 1 - remaining / total;
                const h = base + (1 - base) * progress;
                return h >= 1;
            })(),
            timeValue: this._craftingCountdownRemaining != null ? this._craftingCountdownRemaining : this.timeValue,
            heatFillPercent: HEAT_MAX > 0 ? (this.heatValue / HEAT_MAX) * 100 : 0,
            heatLabel: HEAT_LEVELS[this.heatValue] ?? 'Off',
            grindFillPercent: HEAT_MAX > 0 ? (this.grindValue / HEAT_MAX) * 100 : 0,
            grindLabel: GRIND_LEVELS[this.grindValue] ?? 'Off',
            processValue: this.processType === 'heat' ? this.heatValue : this.grindValue,
            processLabel: this.processType === 'heat' ? (HEAT_LEVELS[this.heatValue] ?? 'Off') : (GRIND_LEVELS[this.grindValue] ?? 'Off'),
            processFillPercent: this.processType === 'heat' ? (HEAT_MAX > 0 ? (this.heatValue / HEAT_MAX) * 100 : 0) : (HEAT_MAX > 0 ? (this.grindValue / HEAT_MAX) * 100 : 0),
            processLeftLabel: this.processType === 'heat' ? 'OFF' : 'off',
            processRightLabel: this.processType === 'heat' ? 'HIGH' : 'powder',
            isHeatProcess: this.processType === 'heat',
            timeFillPercent: this._craftingCountdownRemaining != null
                ? (this._craftingCountdownRemaining / Math.max(1, this.timeValue)) * 100
                : (this.timeValue / 120) * 100,
            timeDisplayText: (() => {
                const sec = this._craftingCountdownRemaining != null ? this._craftingCountdownRemaining : this.timeValue;
                return String(sec);
            })(),
            isCrafting: this._craftingCountdownRemaining != null,
            /** 0–100: fill from bottom as countdown runs (elapsed / total). Used for container slot overlay when filled + crafting. */
            containerCraftFillPercent: this._craftingCountdownRemaining != null
                ? 100 - (this._craftingCountdownRemaining / Math.max(1, this.timeValue)) * 100
                : 0,
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
        if (this._craftCountdownInterval) {
            clearInterval(this._craftCountdownInterval);
            this._craftCountdownInterval = null;
        }
        this._craftingCountdownRemaining = null;
        this._craftPending = null;
        this.selectedSlots = Array(6).fill(null);
        this.selectedApparatus = null;
        this.selectedContainer = null;
        this.selectedTool = null;
        this.selectedRecipe = null;
        this.heatValue = 0;
        this.grindValue = 0;
        this.processType = 'heat';
        this.timeValue = 0;
        this.render();
    }
    static _actionAddToSlot(event, target) {
        const el = target.closest?.('.crafting-ingredient-row') ?? target;
        const itemId = el?.dataset?.itemId;
        if (itemId) this._addToSlot(itemId);
    }
    static _actionAddToApparatus(event, target) {
        const el = target.closest?.('.crafting-ingredient-row') ?? target;
        if (el?.dataset?.itemId) this._addToApparatus(el.dataset.itemId);
    }
    static _actionAddToContainer(event, target) {
        const el = target.closest?.('.crafting-ingredient-row') ?? target;
        if (el?.dataset?.itemId) this._addToContainer(el.dataset.itemId);
    }
    static _actionAddToTool(event, target) {
        const el = target.closest?.('.crafting-ingredient-row') ?? target;
        if (el?.dataset?.itemId) this._addToTool(el.dataset.itemId);
    }
    static _actionRemoveFromSlot(event, target) {
        const el = target.closest?.('.crafting-bench-slot-item') ?? target.closest?.('.crafting-bench-slot');
        const idx = el?.dataset?.slotIndex ?? el?.closest?.('.crafting-bench-slot')?.dataset?.slotIndex;
        if (idx !== undefined) this._removeFromSlot(idx);
    }
    static _actionRemoveApparatus(event, target) { this._removeApparatus(); }
    static _actionRemoveContainer(event, target) { this._removeContainer(); }
    static _actionRemoveTool(event, target) { this._removeTool(); }
    static _actionSelectRecipe(event, target) {
        const row = target?.closest?.('.crafting-recipe-row');
        const recipeId = row?.dataset?.recipeId;
        if (recipeId) this._selectRecipe(recipeId).catch(() => {});
    }
    static async _actionRefreshCache(event, target) {
        this._refreshCache();
    }
    static _actionSetTimeFromRoundTimer(event, target) {
        if (this._craftingCountdownRemaining != null) return;
        const wrap = target?.closest?.('.crafting-bench-round-timer');
        if (!wrap) return;
        const rect = wrap.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const x = event.clientX - cx;
        const y = event.clientY - cy;
        let angle = Math.atan2(x, -y);
        if (angle < 0) angle += 2 * Math.PI;
        const pct = angle / (2 * Math.PI);
        const time = Math.round((pct * 120) / 5) * 5;
        this.timeValue = Math.max(0, Math.min(120, time));
        this.render();
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
            const refreshBtn = e.target?.closest?.('[data-action="refreshCache"]');
            if (refreshBtn) {
                w._refreshCache();
                return;
            }
            const recipeRow = e.target?.closest?.('.crafting-recipe-row');
            if (recipeRow?.dataset?.recipeId) {
                w._selectRecipe(recipeRow.dataset.recipeId).catch(() => {});
                return;
            }
            const row = e.target?.closest?.('.crafting-ingredient-row');
            if (row?.dataset?.itemId) {
                const action = row.dataset.action || row.getAttribute?.('data-action');
                if (action === 'addToApparatus') w._addToApparatus(row.dataset.itemId);
                else if (action === 'addToContainer') w._addToContainer(row.dataset.itemId);
                else if (action === 'addToTool') w._addToTool(row.dataset.itemId);
                else w._addToSlot(row.dataset.itemId);
                return;
            }
            const slotItem = e.target?.closest?.('.crafting-bench-slot-item');
            if (slotItem) {
                const slot = slotItem.closest('.crafting-bench-slot');
                if (slot?.dataset?.slotIndex !== undefined) w._removeFromSlot(slot.dataset.slotIndex);
                return;
            }
            const apparatusEl = e.target?.closest?.('.crafting-bench-apparatus-slot');
            if (apparatusEl && w.selectedApparatus) { w._removeApparatus(); return; }
            const containerEl = e.target?.closest?.('.crafting-bench-container-slot');
            if (containerEl && w.selectedContainer) { w._removeContainer(); return; }
            const toolEl = e.target?.closest?.('.crafting-bench-tool-slot');
            if (toolEl && w.selectedTool) { w._removeTool(); return; }
            const roundTimer = e.target?.closest?.('.crafting-bench-round-timer');
            if (roundTimer) {
                CraftingWindow._actionSetTimeFromRoundTimer.call(w, e, roundTimer);
                return;
            }
            const cyclePrev = e.target?.closest?.('[data-action="cycleProcessPrev"]');
            if (cyclePrev) {
                e.preventDefault();
                const idx = PROCESS_TYPES.indexOf(w.processType);
                w.processType = PROCESS_TYPES[(idx - 1 + PROCESS_TYPES.length) % PROCESS_TYPES.length];
                w.render();
                return;
            }
            const cycleNext = e.target?.closest?.('[data-action="cycleProcessNext"]');
            if (cycleNext) {
                e.preventDefault();
                const idx = PROCESS_TYPES.indexOf(w.processType);
                w.processType = PROCESS_TYPES[(idx + 1) % PROCESS_TYPES.length];
                w.render();
                return;
            }
        });

        document.addEventListener('change', (e) => {
            const w = _currentCraftingWindowRef;
            if (!w) return;
            const root = w._getCraftingRoot();
            if (!root?.contains?.(e.target)) return;
            const appId = w.id;
            const el = e.target;
            const id = el.id ?? '';
            if (id === `${appId}-filter-type`) {
                w.filterArtificerType = el.value ?? '';
                // Clear family if it's not in the new type's families
                if (w.filterFamily && w.filterArtificerType) {
                    const families = FAMILIES_BY_TYPE[w.filterArtificerType] ?? [];
                    if (!families.includes(w.filterFamily)) w.filterFamily = '';
                }
                w.render();
            } else if (id === `${appId}-filter-family`) {
                w.filterFamily = el.value ?? '';
                w.render();
            }
            const slider = el?.closest?.('[data-craft-setting]');
            if (slider) {
                const key = slider.getAttribute('data-craft-setting');
                const min = parseFloat(slider.getAttribute('data-craft-setting-min')) || 0;
                const max = parseFloat(slider.getAttribute('data-craft-setting-max')) || 100;
                const val = Math.max(min, Math.min(max, parseInt(slider.value, 10) || min));
                if (key === 'heat') w.heatValue = val;
                else if (key === 'grind') w.grindValue = val;
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
                } else if (key === 'grind') {
                    w.grindValue = val;
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

    _updatePosition(position) {
        const resolved = super._updatePosition(position);
        const minWidth = 1100;
        const minHeight = 750;
        if (typeof resolved.width === 'number' && resolved.width < minWidth) resolved.width = minWidth;
        if (typeof resolved.height === 'number' && resolved.height < minHeight) resolved.height = minHeight;
        return resolved;
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

    _addToApparatus(itemId) {
        const actor = this._getActor();
        if (!actor) return;
        const item = actor.items.get(itemId);
        if (!item) return;
        const f = item.flags?.[MODULE.ID] || item.flags?.artificer;
        const family = (getFamilyFromFlags(f) || f?.family || '').toLowerCase();
        if (family !== 'apparatus' && f?.type !== 'apparatus') return;
        this.selectedApparatus = item;
        this.render();
    }

    _addToContainer(itemId) {
        const actor = this._getActor();
        if (!actor) return;
        const item = actor.items.get(itemId);
        if (!item) return;
        const f = item.flags?.[MODULE.ID] || item.flags?.artificer;
        const family = (getFamilyFromFlags(f) || f?.family || '').toLowerCase();
        if (family !== 'container' && f?.type !== 'resultContainer' && f?.type !== 'container') return;
        this.selectedContainer = item;
        this.render();
    }

    _addToTool(itemId) {
        const actor = this._getActor();
        if (!actor) return;
        const item = actor.items.get(itemId);
        if (!item) return;
        this.selectedTool = item;
        this.render();
    }

    _removeApparatus() { this.selectedApparatus = null; this.render(); }
    _removeContainer() { this.selectedContainer = null; this.render(); }
    _removeTool() { this.selectedTool = null; this.render(); }

    async _refreshCache() {
        try {
            await refreshCache((state) => {
                this.render();
            });
            const api = getAPI();
            if (api?.ingredients?.refresh) await api.ingredients.refresh();
        } catch (err) {
            postError(MODULE.NAME, 'Cache refresh failed', err?.message ?? String(err));
            ui.notifications?.error?.('Failed to refresh item cache.');
        }
        await this.render();
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

        const matchByName = (items, name, flagsFilter) => {
            const target = (name || '').trim();
            if (!target) return null;
            return items?.find((i) => {
                if (flagsFilter) {
                    const f = i.flags?.[MODULE.ID] || i.flags?.artificer;
                    if (!flagsFilter(f)) return false;
                }
                return (i.name || '').trim() === target;
            }) ?? null;
        };
        const isApparatus = (f) => {
            const family = (getFamilyFromFlags(f) || f?.family || '').toLowerCase();
            return family === 'apparatus' || f?.type === 'apparatus';
        };
        const isContainer = (f) => {
            const family = (getFamilyFromFlags(f) || f?.family || '').toLowerCase();
            return family === 'container' || f?.type === 'resultContainer' || f?.type === 'container';
        };
        this.selectedApparatus = matchByName(actor?.items, recipe.apparatusName, isApparatus);
        this.selectedContainer = matchByName(actor?.items, recipe.containerName, isContainer);
        this.selectedTool = matchByName(actor?.items, recipe.toolName);

        this.processType = recipe.processType === 'grind' ? 'grind' : 'heat';
        const rawLevel = recipe.processLevel != null ? Number(recipe.processLevel) : (recipe.heat != null ? Number(recipe.heat) : null);
        const level = (rawLevel != null && rawLevel >= 0 && rawLevel <= HEAT_MAX) ? Math.round(rawLevel) : (rawLevel != null && rawLevel <= 100 ? Math.min(HEAT_MAX, Math.round((rawLevel / 100) * HEAT_MAX)) : 0);
        if (this.processType === 'heat') this.heatValue = level;
        else this.grindValue = level;
        if (recipe.heat != null && recipe.processLevel == null) {
            const rawHeat = Number(recipe.heat);
            if (rawHeat >= 0 && rawHeat <= HEAT_MAX) this.heatValue = Math.round(rawHeat);
            else if (rawHeat <= 100) this.heatValue = Math.min(HEAT_MAX, Math.round((rawHeat / 100) * HEAT_MAX));
        }
        this.timeValue = (recipe.time != null && recipe.time >= 0) ? recipe.time : 0;

        this.render();
    }

    async _craft() {
        if (this._craftingCountdownRemaining != null) return;

        const actor = this._getActor();
        const entries = this.selectedSlots.filter(s => s && s.item && !s.isMissing);
        if (!actor || entries.length === 0) return;

        const items = entries.flatMap(e => Array(e.count).fill(e.item));

        const valid = items.every(i => {
            const f = i.flags?.[MODULE.ID] || i.flags?.artificer;
            if (f?.type && ['ingredient', 'component', 'essence'].includes(f.type)) return true;
            const cc = asCraftableConsumable(i);
            return cc.ok; // Allow core D&D consumables (flask of oil, potions, etc.) without artificer flags
        });
        if (!valid) {
            ui.notifications.warn('Only Artificer ingredients/components/essences or core consumables (potion, oil, poison, etc.) can be used in crafting.');
            return;
        }

        const anyMissing = this.selectedSlots.some(s => s?.isMissing);
        const countdownTotal = Math.max(0, Math.min(120, this.timeValue));
        const countdownSec = countdownTotal <= 0 ? 0 : Math.ceil(countdownTotal);

        if (countdownSec <= 0) {
            await this._runCraftLogic(actor, items, anyMissing);
            this._resetAfterCraft();
            return;
        }

        this._craftingCountdownRemaining = countdownSec;
        this._craftPending = { actor, items, anyMissing };
        this._craftCountdownInterval = setInterval(() => {
            this._craftingCountdownRemaining = Math.max(0, (this._craftingCountdownRemaining ?? 0) - 1);
            this.render();
            if (this._craftingCountdownRemaining <= 0) {
                clearInterval(this._craftCountdownInterval ?? 0);
                this._craftCountdownInterval = null;
                const pending = this._craftPending;
                this._craftPending = null;
                if (pending) {
                    this._runCraftLogic(pending.actor, pending.items, pending.anyMissing).then(() => {
                        this._resetAfterCraft();
                    });
                }
            }
        }, 1000);
        this.render();
    }

    async _runCraftLogic(actor, items, anyMissing) {
        if (this.selectedRecipe && !anyMissing) {
            this.lastResult = await this._craftFromRecipe(actor, items);
        } else {
            const allTags = [];
            for (const item of items) {
                allTags.push(...getTagsFromItem(item));
            }
            this.lastCraftTags = [...new Set(allTags)].map(t => t.charAt(0).toUpperCase() + t.slice(1));
            const engine = getExperimentationEngine();
            this.lastResult = await engine.craft(actor, items);
        }
        if (this.lastResult?.success) {
            ui.notifications.info(`Created: ${this.lastResult.name}`);
        } else if (this.lastResult) {
            ui.notifications.warn(this.lastResult.name);
        }
    }

    _resetAfterCraft() {
        this._craftingCountdownRemaining = null;
        this._craftPending = null;
        if (this._craftCountdownInterval) {
            clearInterval(this._craftCountdownInterval);
            this._craftCountdownInterval = null;
        }
        this.selectedSlots = Array(6).fill(null);
        this.selectedApparatus = null;
        this.selectedContainer = null;
        this.selectedTool = null;
        this.selectedRecipe = null;
        this.heatValue = 0;
        this.grindValue = 0;
        this.processType = 'heat';
        this.timeValue = 0;
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

        const resultName = (recipe.resultItemName || recipe.name || '').trim();
        const resultItem = resultName ? await resolveItemByName(resultName) : null;
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
            postError(MODULE.NAME, 'Recipe craft error', err?.message ?? String(err));
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
