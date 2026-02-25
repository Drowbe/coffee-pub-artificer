// ==================================================================
// ===== ROLL FOR COMPONENTS WINDOW (Phase 1 gather) ===============
// ==================================================================
// GM selects biome, component types, DC; clicks Request Roll to open
// Blacksmith's Request a Roll dialog (Herbalism Kit). On roll complete,
// we compare to DC and send failure/success chat card + add items.
// ==================================================================

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

import { MODULE } from './const.js';
import { OFFICIAL_BIOMES } from './schema-ingredients.js';
import {
    getBiomeOptionsForMultiselect,
    getComponentTypeOptions,
    setPendingGather,
    consumePendingGather,
    processGatherRollResult,
    sendGatherFailureCard,
    sendGatherNoPoolCard,
    sendGatherSuccessCard
} from './manager-gather.js';

const GATHER_APP_ID = 'artificer-gather';
const GATHER_SETTINGS_KEY = 'gatherWindowSettings';
const DEFAULT_GATHER_SETTINGS = { biomes: [], componentTypes: [], dc: 10 };

let _currentGatherWindowRef = null;
let _gatherDelegationAttached = false;

function getGatherWindowSettings() {
    try {
        const raw = game.settings.get(MODULE.ID, GATHER_SETTINGS_KEY);
        if (raw && typeof raw === 'object' && Array.isArray(raw.biomes) && Array.isArray(raw.componentTypes)) {
            return {
                biomes: raw.biomes,
                componentTypes: raw.componentTypes,
                dc: typeof raw.dc === 'number' && raw.dc >= 1 && raw.dc <= 30 ? raw.dc : 10
            };
        }
    } catch {
        // ignore
    }
    return { ...DEFAULT_GATHER_SETTINGS };
}

function saveGatherWindowSettings(settings) {
    try {
        game.settings.set(MODULE.ID, GATHER_SETTINGS_KEY, settings);
    } catch {
        // ignore
    }
}

/**
 * Roll for Components window - Phase 1 herb gather.
 */
export class GatherWindow extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(foundry.utils.mergeObject({}, super.DEFAULT_OPTIONS ?? {}), {
        id: GATHER_APP_ID,
        classes: ['window-gather', 'artificer-gather-window'],
        position: { width: 650, height: 400 },
        window: { title: 'Roll for Components', resizable: true, minimizable: true },
        actions: {
            requestRoll: GatherWindow._actionRequestRoll
        }
    });

    static PARTS = {
        body: {
            template: 'modules/coffee-pub-artificer/templates/window-gather.hbs'
        }
    };

    constructor(options = {}) {
        const opts = foundry.utils.mergeObject({}, options);
        opts.id = opts.id ?? `${GATHER_APP_ID}-${foundry.utils.randomID().slice(0, 8)}`;
        super(opts);
    }

    async _prepareContext(options = {}) {
        const base = await super._prepareContext?.(options) ?? {};
        return foundry.utils.mergeObject(base, await this.getData(options));
    }

    async getData(options = {}) {
        const saved = getGatherWindowSettings();
        const selectedBiomes = this._selectedBiomes ?? saved.biomes;
        const componentTypeOptions = getComponentTypeOptions().map((o) => ({
            ...o,
            checked: saved.componentTypes.includes(o.value)
        }));
        return {
            biomeOptions: getBiomeOptionsForMultiselect(selectedBiomes),
            componentTypeOptions,
            dc: saved.dc
        };
    }

    /** ApplicationV2 PARTS may not call activateListeners with the part html; use document-level delegation. Capture phase + stopPropagation so only delegation runs (avoids double fire with ApplicationV2 action). */
    _attachDelegationOnce() {
        _currentGatherWindowRef = this;
        if (_gatherDelegationAttached) return;
        _gatherDelegationAttached = true;
        document.addEventListener('click', (e) => {
            const w = _currentGatherWindowRef;
            if (!w) return;
            const root = w._getGatherRoot();
            if (!root?.contains?.(e.target)) return;
            const biomeBtn = e.target?.closest?.('[data-action="toggleBiome"]');
            if (biomeBtn?.dataset?.biome) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                w._toggleBiome(biomeBtn.dataset.biome);
                return;
            }

            const btn = e.target?.closest?.('[data-action="requestRoll"]');
            if (btn) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                w._requestRoll();
            }
        }, true);
    }

    _getGatherRoot() {
        const byId = document.getElementById(this.id);
        if (byId) return byId;
        return document.querySelector('.gather-window-root');
    }

    _toggleBiome(biome) {
        if (!OFFICIAL_BIOMES.includes(biome)) return;
        const current = this._selectedBiomes ?? getGatherWindowSettings().biomes;
        const next = current.includes(biome) ? current.filter((b) => b !== biome) : [...current, biome];
        this._selectedBiomes = next;
        this.render();
    }

    async _onFirstRender(_context, options) {
        await super._onFirstRender?.(_context, options);
        this._attachDelegationOnce();
    }

    activateListeners(html) {
        super.activateListeners(html);
        this._attachDelegationOnce();
    }

    static _actionRequestRoll(event, target) {
        const w = _currentGatherWindowRef ?? target?.closest?.('.window-gather')?.__app ?? target?.__app;
        if (w && typeof w._requestRoll === 'function') w._requestRoll();
    }

    async _requestRoll() {
        BlacksmithUtils.playSound(BlacksmithConstants.SOUNDPOP01, 0.5);
        const root = this._getGatherRoot();
        const dcEl = root?.querySelector('#gather-dc');
        const checkboxes = root?.querySelectorAll?.('input.gather-checkbox:checked');
        const biomeBtns = root?.querySelectorAll?.('.gather-biome-btn.active');

        const selectedBiomes = biomeBtns?.length ? Array.from(biomeBtns).map((b) => b.dataset?.biome).filter(Boolean) : (this._selectedBiomes ?? []);
        const dc = Math.max(1, Math.min(30, parseInt(dcEl?.value, 10) || 10));
        const componentTypes = Array.from(checkboxes ?? []).map((cb) => cb.value?.trim()).filter(Boolean);

        if (!selectedBiomes.length) {
            ui.notifications?.warn('Select at least one habitat.');
            return;
        }
        if (!componentTypes.length) {
            ui.notifications?.warn('Select at least one component type.');
            return;
        }

        const settings = { biomes: selectedBiomes, componentTypes, dc };
        saveGatherWindowSettings(settings);

        setPendingGather({ dc, biomes: selectedBiomes, componentTypes });
        this._lastGatherContext = { dc, biomes: selectedBiomes, componentTypes };
        this._gatherRollBuffer = [];

        const selectedActors = this._getSelectedCanvasActors();
        if (!selectedActors.length) {
            ui.notifications?.warn('Select at least one token on the canvas to request the roll.');
            return;
        }

        const api = game.modules.get('coffee-pub-blacksmith')?.api;
        if (!api?.openRequestRollDialog) {
            ui.notifications?.warn('Blacksmith Request a Roll API not available.');
            return;
        }

        // Silent mode: pass actors explicitly so the request has challengers without opening the dialog.
        // API should use options.actors when provided; initialFilter is a fallback for when dialog resolves selection.
        const actorsForRequest = this._getSelectedCanvasActors();
        if (!actorsForRequest.length) {
            ui.notifications?.warn('No tokens selected. Select at least one token on the canvas.');
            return;
        }

        await api.openRequestRollDialog({
            silent: true,
            title: 'Forage for components',
            dc,
            initialFilter: 'selected',
            initialType: 'ability',
            initialValue: 'wis',
            actors: actorsForRequest,
            onRollComplete: (payload) => this._onRollComplete(payload)
        });
        this.close();
    }

    /**
     * Get actors from currently selected tokens on the canvas (unique by actor id).
     * @returns {Actor[]}
     */
    _getSelectedCanvasActors() {
        if (!canvas?.ready || !canvas.tokens?.controlled?.length) return [];
        const seen = new Set();
        const actors = [];
        for (const token of canvas.tokens.controlled) {
            const actor = token?.actor;
            if (actor && !seen.has(actor.id)) {
                seen.add(actor.id);
                actors.push(actor);
            }
        }
        return actors;
    }

    /**
     * Called by Blacksmith when a roll result is delivered. Buffer results; send all cards only when allComplete.
     * @param {{ message?: ChatMessage, messageData?: object, tokenId?: string, result?: { total: number }, allComplete?: boolean }} payload
     */
    async _onRollComplete(payload) {
        const { result, tokenId, message } = payload ?? {};
        const rollTotal = result?.total != null ? result.total : null;
        let actor = null;
        if (tokenId && canvas?.scene) {
            const tokenDoc = canvas.scene.tokens.get(tokenId);
            if (tokenDoc) {
                actor = tokenDoc.actor ?? (tokenDoc.actorId ? game.actors.get(tokenDoc.actorId) : null) ?? null;
            }
        }
        if (!actor && message?.speaker?.actor) {
            actor = game.actors.get(message.speaker.actor) ?? null;
        }

        if (rollTotal == null) {
            ui.notifications?.warn('Could not read roll result.');
            return;
        }

        const pending = this._lastGatherContext ?? consumePendingGather();
        if (!pending) return;

        const outcome = await processGatherRollResult(rollTotal, actor ?? null, pending);
        if (!this._gatherRollBuffer) this._gatherRollBuffer = [];
        this._gatherRollBuffer.push({ actor: actor ?? null, outcome });

        if (!payload.allComplete) return;

        for (const { actor: a, outcome: o } of this._gatherRollBuffer) {
            if (!a) {
                sendGatherFailureCard(a);
                continue;
            }
            if (o.noPool) {
                sendGatherNoPoolCard(a);
                continue;
            }
            if (!o.success) {
                sendGatherFailureCard(a);
                continue;
            }
            if (o.itemRecord) {
                sendGatherSuccessCard(a, [o.itemRecord]);
            } else {
                sendGatherFailureCard(a);
            }
        }

        this._gatherRollBuffer = [];
        consumePendingGather();
        this._lastGatherContext = null;
    }
}
