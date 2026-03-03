// ==================================================================
// ===== SCENE MANAGER ===============================================
// ==================================================================

import { MODULE } from './const.js';
import { BlacksmithAPI } from '/modules/coffee-pub-blacksmith/api/blacksmith-api.js';

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
        if (html[0] instanceof HTMLElement) return html[0];
        return null;
    }

    static _injectArtificerTab(app, html) {
        const root = this._resolveRoot(html);
        if (!root) return;

        const form = root.matches?.('form') ? root : (root.querySelector?.('form') ?? root);
        const tabsNav = form.querySelector?.('.sheet-tabs[data-group], .tabs[data-group]');
        if (!tabsNav) return;
        if (tabsNav.querySelector('[data-tab="artificer"]')) return;

        const dataGroup = tabsNav.dataset.group || 'main';

        const tabButton = document.createElement('a');
        tabButton.className = 'item';
        tabButton.dataset.tab = 'artificer';
        tabButton.dataset.group = dataGroup;
        tabButton.innerHTML = '<i class="fa-solid fa-hammer"></i> Artificer';
        tabsNav.appendChild(tabButton);

        const tabBodyHost = form.querySelector('.sheet-body') ?? form;
        const sceneFlags = app?.document?.getFlag(MODULE.ID, 'scene') ?? {};
        const enabled = !!sceneFlags.enabled;
        const profile = (sceneFlags.profile ?? '').toString();
        const notes = (sceneFlags.notes ?? '').toString();

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
        `;
        tabBodyHost.appendChild(tabPanel);
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
