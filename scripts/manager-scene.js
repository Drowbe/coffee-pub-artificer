// ==================================================================
// ===== SCENE MANAGER ===============================================
// ==================================================================

import { MODULE } from './const.js';
import { BlacksmithAPI } from '/modules/coffee-pub-blacksmith/api/blacksmith-api.js';
import { OFFICIAL_BIOMES } from './schema-ingredients.js';
import { ARTIFICER_TYPES, FAMILIES_BY_TYPE, FAMILY_LABELS } from './schema-artificer-item.js';

const SCENE_SOCKET_EVENT = `${MODULE.ID}.sceneArtificerUpdated`;
const SCENE_CONTEXT = `${MODULE.ID}-scene-manager`;

export class SceneManager {
    static _hookManager = null;
    static _sockets = null;
    static _initialized = false;

    static async initialize() {
        if (this._initialized) return;
        this._log('SceneManager: initializing');

        this._hookManager = await BlacksmithAPI.getHookManager();
        this._sockets = await BlacksmithAPI.getSockets();
        await this._sockets.waitForReady();

        await this._sockets.register(SCENE_SOCKET_EVENT, (payload) => {
            Hooks.callAll(SCENE_SOCKET_EVENT, payload);
        });
        this._log(`SceneManager: socket registered (${SCENE_SOCKET_EVENT})`);

        this._hookManager.registerHook({
            name: 'renderSceneConfig',
            description: 'Inject Artificer tab into Scene Configuration',
            context: SCENE_CONTEXT,
            key: `${SCENE_CONTEXT}-render-scene-config`,
            priority: 3,
            callback: (app, html) => this._injectArtificerTab(app, html)
        });
        this._log('SceneManager: hook registered (renderSceneConfig)');
        this._hookManager.registerHook({
            name: 'renderApplicationV2',
            description: 'Inject Artificer tab into Scene Configuration (V2)',
            context: SCENE_CONTEXT,
            key: `${SCENE_CONTEXT}-render-application-v2-scene-config`,
            priority: 3,
            callback: (app, html) => this._injectArtificerTabV2(app, html)
        });
        this._log('SceneManager: hook registered (renderApplicationV2)');

        this._hookManager.registerHook({
            name: 'updateScene',
            description: 'Broadcast Artificer scene flag updates',
            context: SCENE_CONTEXT,
            key: `${SCENE_CONTEXT}-update-scene`,
            priority: 3,
            callback: (scene, changed, options, userId) => this._broadcastSceneArtificerUpdate(scene, changed, options, userId)
        });
        this._log('SceneManager: hook registered (updateScene)');

        this._initialized = true;
        this._log('SceneManager: initialized');
    }

    static _resolveRoot(html) {
        if (!html) return null;
        if (html instanceof HTMLElement) return html;
        if (html instanceof DocumentFragment) return html;
        if (html[0] instanceof HTMLElement) return html[0];
        if (typeof html.querySelector === 'function') return html;
        return null;
    }

    static _injectArtificerTabV2(app, html) {
        // Foundry v13+ emits renderApplicationV2 for all apps; only target SceneConfig.
        const appName = app?.constructor?.name ?? '';
        const isSceneConfig = appName === 'SceneConfig' || app?.documentName === 'Scene' || app?.document?.documentName === 'Scene';
        if (!isSceneConfig) return;
        this._injectArtificerTab(app, html);
    }

    static _injectArtificerTab(app, html) {
        const root = this._resolveRoot(html) || this._resolveRoot(app?.element) || this._resolveRoot(app?._element);
        if (!root) {
            this._log('SceneManager: tab inject skipped (no render root)');
            return;
        }

        const form = root.matches?.('form') ? root : (root.querySelector?.('form') ?? root);
        const tabsNav = form.querySelector?.('.sheet-tabs[data-group], .tabs[data-group], .sheet-tabs, .tabs, nav.tabs');
        if (!tabsNav) {
            this._log('SceneManager: tab inject skipped (no tabs nav found)');
            return;
        }
        if (tabsNav.querySelector('[data-tab="artificer"]')) return;

        const firstTabWithGroup = tabsNav.querySelector?.('[data-group]');
        const dataGroup = firstTabWithGroup?.dataset?.group || tabsNav.dataset.group || 'sheet';

        const useButton = tabsNav.firstElementChild?.tagName?.toLowerCase() === 'button';
        const tabButton = document.createElement(useButton ? 'button' : 'a');
        tabButton.className = 'item';
        if (useButton) tabButton.type = 'button';
        tabButton.dataset.action = 'tab';
        tabButton.dataset.tab = 'artificer';
        tabButton.dataset.group = dataGroup;
        tabButton.innerHTML = '<i class="fa-solid fa-hammer"></i> Artificer';
        tabsNav.appendChild(tabButton);

        const existingTabPanel = form.querySelector('.tab[data-tab]');
        const tabBodyHost = existingTabPanel?.parentElement ?? form.querySelector('.sheet-body') ?? form;
        const sceneFlags = app?.document?.getFlag(MODULE.ID, 'scene') ?? {};
        const enabled = !!sceneFlags.enabled;
        const profile = (sceneFlags.profile ?? '').toString();
        const notes = (sceneFlags.notes ?? '').toString();
        const selectedHabitats = new Set(Array.isArray(sceneFlags.habitats) ? sceneFlags.habitats : []);
        const componentFamilies = FAMILIES_BY_TYPE[ARTIFICER_TYPES.COMPONENT] ?? [];
        const selectedComponentTypes = new Set(Array.isArray(sceneFlags.componentTypes) ? sceneFlags.componentTypes : []);
        const gatherSpots = Number.isFinite(Number(sceneFlags.gatherSpots)) ? Math.max(0, Number(sceneFlags.gatherSpots)) : 0;
        const habitatOptionsHtml = OFFICIAL_BIOMES.map((biome) => {
            const checked = selectedHabitats.has(biome) ? 'checked' : '';
            return `
                <label class="checkbox">
                    <input type="checkbox" name="flags.${MODULE.ID}.scene.habitats" value="${foundry.utils.escapeHTML(biome)}" ${checked} />
                    ${foundry.utils.escapeHTML(biome)}
                </label>
            `;
        }).join('');
        const componentTypeOptionsHtml = componentFamilies.map((family) => {
            const checked = selectedComponentTypes.has(family) ? 'checked' : '';
            const label = FAMILY_LABELS[family] ?? family;
            return `
                <label class="checkbox">
                    <input type="checkbox" name="flags.${MODULE.ID}.scene.componentTypes" value="${foundry.utils.escapeHTML(family)}" ${checked} />
                    ${foundry.utils.escapeHTML(label)}
                </label>
            `;
        }).join('');

        const tabPanel = document.createElement('div');
        tabPanel.className = 'tab';
        tabPanel.dataset.tab = 'artificer';
        tabPanel.dataset.group = dataGroup;
        tabPanel.innerHTML = `
            <div class="form-group">
                <label>Enable Artificer Features</label>
                <input type="checkbox" name="flags.${MODULE.ID}.scene.enabled" ${enabled ? 'checked' : ''} />
                <p class="notes">Enable scene-scoped Artificer controls and data.</p>
            </div>
            <div class="form-group">
                <label>Artificer Profile</label>
                <input type="text" name="flags.${MODULE.ID}.scene.profile" value="${foundry.utils.escapeHTML(profile)}" placeholder="Default" />
                <p class="notes">Optional scene profile id for future Artificer scene behaviors.</p>
            </div>
            <div class="form-group stacked">
                <label>Artificer Notes</label>
                <textarea name="flags.${MODULE.ID}.scene.notes" rows="4" placeholder="Notes for this scene's Artificer setup">${foundry.utils.escapeHTML(notes)}</textarea>
            </div>
            <div class="form-group stacked">
                <label>Habitats</label>
                <div class="form-fields" style="display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;">
                    ${habitatOptionsHtml}
                </div>
                <p class="notes">Habitat filters for scene-based gathering.</p>
            </div>
            <div class="form-group stacked">
                <label>Component Types</label>
                <div class="form-fields" style="display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;">
                    ${componentTypeOptionsHtml}
                </div>
                <p class="notes">Allowed component families for scene-based gathering.</p>
            </div>
            <div class="form-group">
                <label>Gather Spots</label>
                <input type="number" min="0" step="1" name="flags.${MODULE.ID}.scene.gatherSpots" value="${gatherSpots}" />
                <p class="notes">Number of gather spots to add to this scene.</p>
            </div>
        `;
        tabBodyHost.appendChild(tabPanel);

        // Keep Save Changes last in the form flow.
        const footer = form.querySelector('.form-footer, footer.application-footer');
        if (footer?.parentElement) {
            footer.parentElement.appendChild(footer);
        }

        this._log(`SceneManager: Artificer tab injected for scene "${app?.document?.name ?? 'Unknown'}"`);
    }

    static _broadcastSceneArtificerUpdate(scene, changed, options, userId) {
        const changedSceneData = foundry.utils.getProperty(changed, `flags.${MODULE.ID}.scene`);
        if (changedSceneData == null) return;
        if (userId !== game.user.id) return;

        this._sockets.emit(SCENE_SOCKET_EVENT, {
            sceneId: scene?.id ?? null,
            userId,
            changed: changedSceneData
        });
    }

    static _log(message, details = null, isError = false, notify = false) {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, message, details, isError, notify);
        }
    }
}
