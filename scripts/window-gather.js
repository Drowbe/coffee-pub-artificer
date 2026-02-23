// ==================================================================
// ===== ROLL FOR COMPONENTS WINDOW (Phase 1 gather) ===============
// ==================================================================
// GM selects biome, component types, DC; clicks Request Roll to open
// Blacksmith's Request a Roll dialog (Herbalism Kit). On roll complete,
// we compare to DC and send failure/success chat card + add items.
// ==================================================================

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

import { MODULE } from './const.js';
import {
    getBiomeOptions,
    getComponentTypeOptions,
    setPendingGather,
    handleGatherRollResult
} from './manager-gather.js';

const GATHER_APP_ID = 'artificer-gather';

let _currentGatherWindowRef = null;
let _gatherDelegationAttached = false;

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
        return {
            biomeOptions: getBiomeOptions(),
            componentTypeOptions: getComponentTypeOptions(),
            dc: 10
        };
    }

    /** ApplicationV2 PARTS may not call activateListeners with the part html; use document-level delegation. */
    _attachDelegationOnce() {
        _currentGatherWindowRef = this;
        if (_gatherDelegationAttached) return;
        _gatherDelegationAttached = true;
        document.addEventListener('click', (e) => {
            const w = _currentGatherWindowRef;
            if (!w) return;
            const root = w._getGatherRoot();
            if (!root?.contains?.(e.target)) return;
            const btn = e.target?.closest?.('[data-action="requestRoll"]');
            if (btn) {
                e.preventDefault();
                w._requestRoll();
            }
        });
    }

    _getGatherRoot() {
        const byId = document.getElementById(this.id);
        if (byId) return byId;
        return document.querySelector('.gather-window-root');
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

    _requestRoll() {
        const biomeEl = this.element?.querySelector('#gather-biome');
        const dcEl = this.element?.querySelector('#gather-dc');
        const checkboxes = this.element?.querySelectorAll?.('input.gather-checkbox:checked');
        const biome = biomeEl?.value?.trim() ?? '';
        const dc = Math.max(1, Math.min(30, parseInt(dcEl?.value, 10) || 10));
        const componentTypes = Array.from(checkboxes ?? []).map((cb) => cb.value?.trim()).filter(Boolean);

        if (!biome) {
            ui.notifications?.warn('Select a biome.');
            return;
        }
        if (!componentTypes.length) {
            ui.notifications?.warn('Select at least one component type.');
            return;
        }

        setPendingGather({ dc, biome, componentTypes });

        // Resolve selected tokens on the canvas so the roll is requested for those players
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

        // Herbalism Kit: use tool type if supported, else Nature as proxy. Pass selected actors so the dialog requests the roll for them.
        api.openRequestRollDialog({
            title: 'Forage for components',
            dc,
            initialFilter: 'selected',
            initialType: 'tool',
            initialValue: 'Herbalism Kit',
            actors: selectedActors,
            onRollComplete: (message) => this._onRollComplete(message)
        });
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
     * Called by Blacksmith when the requested roll completes (player clicked and rolled).
     * Extract roll total and actor from the chat message and resolve gather result.
     * @param {ChatMessage} [message]
     */
    _onRollComplete(message) {
        // Log what we received so we can debug callback shape and message structure
        const hasMessage = !!message;
        const speaker = message?.speaker ?? {};
        const actorId = speaker.actor ?? null;
        const rolls = message?.rolls ?? [];
        const first = rolls[0];
        let rollTotal = null;
        if (first != null) {
            if (typeof first.total === 'number') rollTotal = first.total;
            else if (typeof first.total === 'function') rollTotal = first.total();
        }
        const actor = actorId ? game.actors.get(actorId) : null;

        const summary = `onRollComplete: hasMessage=${hasMessage}, rollTotal=${rollTotal ?? 'null'}, actor=${actor?.name ?? actorId ?? 'null'}, rolls.length=${rolls.length}`;
        const detail = first != null ? `first roll keys: ${Object.keys(first).join(', ')}` : 'no rolls';
        BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, summary, detail, true, true);

        if (rollTotal == null) {
            ui.notifications?.warn('Could not read roll result.');
            return;
        }

        handleGatherRollResult(rollTotal, actor ?? null).catch((err) => {
            console.error(`${MODULE.NAME} gather roll result:`, err);
            ui.notifications?.error('Gather result failed.');
        });
    }
}
