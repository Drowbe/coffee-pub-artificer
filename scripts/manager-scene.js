// ==================================================================
// ===== SCENE MANAGER ===============================================
// ==================================================================

import { MODULE } from './const.js';
import { BlacksmithAPI } from '/modules/coffee-pub-blacksmith/api/blacksmith-api.js';
import { getBiomeLabel } from './schema-ingredients.js';
import { getSceneHabitats } from './utils/helpers.js';
import { resolveSceneGatherProfile } from './systems/scene-gather-profile.js';
import { ARTIFICER_TYPES, FAMILIES_BY_TYPE, FAMILY_LABELS } from './schema-artificer-item.js';
import { loadSkillsDetails, resolveGatherDefaults } from './skills-rules.js';
import { postBlacksmithConsole } from './utils/blacksmith-console.js';

const SCENE_SOCKET_EVENT = `${MODULE.ID}.sceneArtificerUpdated`;
const SCENE_CONTEXT = `${MODULE.ID}-scene-manager`;

export class SceneManager {
    static _hookManager = null;
    static _sockets = null;
    static _initialized = false;
    /** @type {string[]} Harvesting skill ids from the ruleset, cached so tab injection stays synchronous. */
    static _defaultHarvestingSkills = [];
    /** @type {Promise<string[]>|null} */
    static _harvestingSkillsPromise = null;

    static async initialize() {
        if (this._initialized) return;
        this._log('SceneManager: initializing');

        this._hookManager = await BlacksmithAPI.getHookManager();

        // Warm the ruleset-derived harvesting skill ids up front so the render hook below
        // never has to await anything (see _injectArtificerTab).
        this._refreshHarvestingSkillDefaults();

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
        this._hookManager.registerHook({
            name: 'renderSceneDirectory',
            description: 'Decorate Scene Directory entries with Artificer gather indicator',
            context: SCENE_CONTEXT,
            key: `${SCENE_CONTEXT}-render-scene-directory`,
            priority: 3,
            callback: (app, html) => this._decorateSceneDirectory(html)
        });
        this._log('SceneManager: hook registered (renderSceneDirectory)');

        this._initialized = true;

        // Sockets are set up AFTER the render hooks on purpose. These awaits sit on
        // Blacksmith's socket handshake, and when that never settles everything below it
        // is skipped — which used to include the Scene Config tab, leaving it missing with
        // nothing logged. Cross-client broadcast is the only thing worth stalling here.
        this._sockets = await BlacksmithAPI.getSockets();
        await this._sockets.waitForReady();
        await this._sockets.register(SCENE_SOCKET_EVENT, (payload) => {
            Hooks.callAll(SCENE_SOCKET_EVENT, payload);
        });
        this._log(`SceneManager: socket registered (${SCENE_SOCKET_EVENT})`);

        this._log('SceneManager: initialized');
    }

    /**
     * Load and cache the ruleset's default harvesting skill ids.
     * Deliberately off the injection path: a failure leaves the list empty and retries on a
     * later render rather than blocking it or poisoning the cache for the session.
     * @returns {Promise<string[]>}
     */
    static _refreshHarvestingSkillDefaults() {
        if (!this._harvestingSkillsPromise) {
            this._harvestingSkillsPromise = loadSkillsDetails()
                .then((details) => {
                    this._defaultHarvestingSkills = resolveGatherDefaults(details).harvestingSkillIds ?? [];
                    return this._defaultHarvestingSkills;
                })
                .catch(() => {
                    // Strict loader already notified the GM; allow a later render to retry.
                    this._harvestingSkillsPromise = null;
                    return this._defaultHarvestingSkills;
                });
        }
        return this._harvestingSkillsPromise;
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
        const isSceneConfig = appName === 'SceneConfig' || app?.document?.documentName === 'Scene';
        if (!isSceneConfig) return;
        this._injectArtificerTab(app, html);
    }

    /**
     * Inject the Artificer tab. Synchronous end to end, on purpose.
     *
     * This runs inside a render hook, and Foundry v13 rebuilds every template part on each
     * render pass (HandlebarsApplicationMixin#_replaceHTML calls priorElement.replaceWith).
     * Awaiting anything here means the nav and body nodes captured beforehand can be detached
     * by a later pass before the tab is appended — the tab then lands on orphaned DOM and is
     * simply absent, with nothing thrown and nothing logged. Every input it needs is cached
     * ahead of time so that window never opens.
     */
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

        // renderSceneConfig and renderApplicationV2 both fire for the same render pass;
        // whichever lands second is a no-op while both halves are still present. A re-render
        // replaces the nav without the button, so this correctly falls through and re-injects.
        if (tabsNav.querySelector('[data-tab="artificer"]')
            && form.querySelector('.tab.artificer-scene-tab[data-tab="artificer"]')) return;

        this._doInjectArtificerTabInner(app, form, tabsNav);
    }

    static _doInjectArtificerTabInner(app, form, tabsNav) {
        // Remove stale injected content — in Foundry v13 ApplicationV2 the tab nav is
        // rebuilt on every render but the tab body container persists, so the nav-button
        // check alone allows a fresh panel to be appended on each render pass.
        tabsNav.querySelector('[data-tab="artificer"]')?.remove();
        form.querySelector('.tab.artificer-scene-tab[data-tab="artificer"]')?.remove();

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

        // ANCHOR ON A CORE ELEMENT FIRST, not on another panel. Deriving the host from
        // `.tab[data-tab]` makes our position a function of what other modules have
        // already injected -- correct here only because we load alphabetically before
        // Blacksmith and therefore inject first, which is load order doing the work of
        // a decision. Blacksmith hit the mirror image of this: they anchored on the LAST
        // tab panel, which turned out to be ours.
        const tabBodyHost = form.querySelector('.sheet-body')
            ?? form.querySelector('.tab[data-tab]')?.parentElement
            ?? form;
        // ONE RESOLVER, SHARED WITH THE GATHER PATH. This block used to compute its own
        // defaults, and they disagreed with the engine's: the form fell back to every
        // component family when the flag was empty, the gather path fell back to nothing,
        // so an unconfigured scene displayed all six ticked and found none of them.
        // Whatever this form shows is now literally what gathering will use.
        //
        // `_defaultHarvestingSkills` is cached at initialize() because this render hook
        // must not await -- see _injectArtificerTab. The resolver is synchronous for that
        // reason and takes the defaults as an argument.
        if (!this._defaultHarvestingSkills.length) this._refreshHarvestingSkillDefaults();
        const profile = resolveSceneGatherProfile(app?.document, this._defaultHarvestingSkills);
        const componentFamilies = FAMILIES_BY_TYPE[ARTIFICER_TYPES.COMPONENT] ?? [];
        const selectedComponentTypes = new Set(profile.componentTypes);
        const selectedHarvestingSkills = new Set(profile.harvestingSkills);
        const discoveryBaseDC = profile.discoveryBaseDC;
        const harvestDC = profile.harvestDC;
        const discoveryOffsetCommon = profile.discoveryOffsets.common;
        const discoveryOffsetUncommon = profile.discoveryOffsets.uncommon;
        const discoveryOffsetRare = profile.discoveryOffsets.rare;
        const discoveryOffsetVeryRare = profile.discoveryOffsets.veryRare;
        const discoveryOffsetLegendary = profile.discoveryOffsets.legendary;
        const gatherSpots = profile.gatherSpots;
        const discoveryRadiusUnits = profile.discoveryRadiusUnits;
        // HABITAT IS READ-ONLY HERE. It moved to Blacksmith's Geography tab, which owns it
        // for the whole suite -- Minstrel reads it too, and gated its habitat automation on
        // Artificer being installed precisely because we used to own it. Two editable lists
        // of the same twelve values on one sheet is the duplication the move removes, so
        // this shows what geography holds and sends the GM there to change it.
        const habitatLabels = getSceneHabitats(app?.document)
            .map((key) => getBiomeLabel(key) ?? key);
        const habitatSummary = habitatLabels.length
            ? `${foundry.utils.escapeHTML(habitatLabels.join(', '))} &mdash; set on the Geography tab.`
            : 'None set. Choose them on the Geography tab; gathering needs at least one.';
        const componentTypeOptionsHtml = componentFamilies.map((family) => {
            const checked = selectedComponentTypes.has(family) ? 'checked' : '';
            const label = FAMILY_LABELS[family] ?? family;
            return `
                <label class="checkbox artificer-scene-checkbox">
                    <input type="checkbox" name="flags.${MODULE.ID}.scene.componentTypes" value="${foundry.utils.escapeHTML(family)}" ${checked} />
                    <span>${foundry.utils.escapeHTML(label)}</span>
                </label>
            `;
        }).join('');
        const harvestingSkillOptionsHtml = this._defaultHarvestingSkills.map((skillId) => {
            const checked = selectedHarvestingSkills.has(skillId) ? 'checked' : '';
            return `
                <label class="checkbox artificer-scene-checkbox">
                    <input type="checkbox" name="flags.${MODULE.ID}.scene.harvestingSkills" value="${foundry.utils.escapeHTML(skillId)}" ${checked} />
                    <span>${foundry.utils.escapeHTML(skillId)}</span>
                </label>
            `;
        }).join('');

        const tabPanel = document.createElement('div');
        tabPanel.className = 'tab artificer-scene-tab';
        tabPanel.dataset.tab = 'artificer';
        tabPanel.dataset.group = dataGroup;
        tabPanel.innerHTML = `
            <div class="form-group">
                <label>Habitats</label>
                <div class="form-fields">
                    <p class="notes artificer-scene-habitat-note">${habitatSummary}</p>
                </div>
            </div>
            <fieldset class="form-group artificer-scene-fieldset">
                <legend>Component Types</legend>
                <div class="form-fields artificer-scene-checkbox-grid">
                    ${componentTypeOptionsHtml}
                </div>
            </fieldset>
            <fieldset class="form-group artificer-scene-fieldset">
                <legend>Harvesting Skills</legend>
                <div class="form-fields artificer-scene-checkbox-grid">
                    ${harvestingSkillOptionsHtml}
                </div>
            </fieldset>
            <fieldset class="artificer-scene-fieldset artificer-scene-thresholds">
                <legend>Discovery DC Thresholds (Base + Offset)</legend>
                <div class="form-group">
                    <label>Base DC</label>
                    <div class="form-fields">
                        <input type="range" min="0" max="20" step="1" name="flags.${MODULE.ID}.scene.discoveryBaseDC" value="${discoveryBaseDC}" data-artificer-range="discovery-base-dc" />
                        <span class="range-value" data-artificer-range-value="discovery-base-dc">${discoveryBaseDC}</span>
                    </div>
                </div>
                <div class="form-group">
                    <label>Common Offset (+)</label>
                    <div class="form-fields">
                        <input type="range" min="0" max="30" step="1" name="flags.${MODULE.ID}.scene.discoveryOffsetCommon" value="${discoveryOffsetCommon}" data-artificer-range="offset-common" />
                        <span class="range-value" data-artificer-range-value="offset-common">${discoveryOffsetCommon}</span>
                    </div>
                </div>
                <div class="form-group">
                    <label>Uncommon Offset (+)</label>
                    <div class="form-fields">
                        <input type="range" min="0" max="30" step="1" name="flags.${MODULE.ID}.scene.discoveryOffsetUncommon" value="${discoveryOffsetUncommon}" data-artificer-range="offset-uncommon" />
                        <span class="range-value" data-artificer-range-value="offset-uncommon">${discoveryOffsetUncommon}</span>
                    </div>
                </div>
                <div class="form-group">
                    <label>Rare Offset (+)</label>
                    <div class="form-fields">
                        <input type="range" min="0" max="30" step="1" name="flags.${MODULE.ID}.scene.discoveryOffsetRare" value="${discoveryOffsetRare}" data-artificer-range="offset-rare" />
                        <span class="range-value" data-artificer-range-value="offset-rare">${discoveryOffsetRare}</span>
                    </div>
                </div>
                <div class="form-group">
                    <label>Very Rare Offset (+)</label>
                    <div class="form-fields">
                        <input type="range" min="0" max="30" step="1" name="flags.${MODULE.ID}.scene.discoveryOffsetVeryRare" value="${discoveryOffsetVeryRare}" data-artificer-range="offset-very-rare" />
                        <span class="range-value" data-artificer-range-value="offset-very-rare">${discoveryOffsetVeryRare}</span>
                    </div>
                </div>
                <div class="form-group">
                    <label>Legendary Offset (+)</label>
                    <div class="form-fields">
                        <input type="range" min="0" max="30" step="1" name="flags.${MODULE.ID}.scene.discoveryOffsetLegendary" value="${discoveryOffsetLegendary}" data-artificer-range="offset-legendary" />
                        <span class="range-value" data-artificer-range-value="offset-legendary">${discoveryOffsetLegendary}</span>
                    </div>
                </div>
                <p class="hint">Roll checks Legendary, then Very Rare, Rare, Uncommon, and Common. Each threshold is Base DC + Offset.</p>
            </fieldset>
            <div class="form-group">
                <label>Harvest DC</label>
                <div class="form-fields">
                    <input type="range" min="0" max="20" step="1" name="flags.${MODULE.ID}.scene.harvestDC" value="${harvestDC}" data-artificer-range="harvest-dc" />
                    <span class="range-value" data-artificer-range-value="harvest-dc">${harvestDC}</span>
                </div>
                <p class="hint">Difficulty Class for Gather and Harvest rolls in this scene (0-20).</p>
            </div>
            <div class="form-group">
                <label>Gather Spots</label>
                <div class="form-fields">
                    <input type="range" min="1" max="30" step="1" name="flags.${MODULE.ID}.scene.gatherSpots" value="${gatherSpots}" data-artificer-range="spots" />
                    <span class="range-value" data-artificer-range-value="spots">${gatherSpots}</span>
                </div>
                <p class="hint">Maximum discovered gathering spots allowed on this scene (1-30).</p>
            </div>
            <div class="form-group">
                <label>Discovery Radius (ft)</label>
                <div class="form-fields">
                    <input type="range" min="5" max="300" step="5" name="flags.${MODULE.ID}.scene.discoveryRadiusUnits" value="${discoveryRadiusUnits}" data-artificer-range="radius" />
                    <span class="range-value" data-artificer-range-value="radius">${discoveryRadiusUnits}</span>
                </div>
                <p class="hint">New discovery spots spawn around the rolling token within this distance (5-300 ft).</p>
            </div>
        `;
        tabBodyHost.appendChild(tabPanel);
        this._wireRangeDisplays(tabPanel);
        this._syncInjectedTabState(app, form, tabsNav, tabButton, tabPanel, dataGroup);

        // Keep Save Changes last in the form flow.
        const footer = form.querySelector('.form-footer, footer.application-footer');
        if (footer?.parentElement) {
            footer.parentElement.appendChild(footer);
        }

        this._log(`SceneManager: Artificer tab injected for scene "${app?.document?.name ?? 'Unknown'}"`);
    }

    static _syncInjectedTabState(app, form, tabsNav, tabButton, tabPanel, dataGroup) {
        if (!form || !tabsNav || !tabButton || !tabPanel) return;

        const getActiveFromNav = () => {
            const activeNav = tabsNav.querySelector('.item.active, .tab.active, [data-tab].active');
            return activeNav?.dataset?.tab ?? null;
        };

        const tabControllers = Array.isArray(app?._tabs)
            ? app._tabs.filter((tabs) => !dataGroup || tabs?.group === dataGroup)
            : [];

        // Capture Foundry's intended active tab BEFORE re-binding. When 'artificer' was the
        // last active tab, Foundry sets tabs.active = 'artificer' during _onRender but can't
        // activate it (the element isn't in the DOM yet), then falls back to showing 'basics'.
        // After bind the DOM shows 'basics' as active, masking the original intent.
        let preBindActive = null;
        for (const tabs of tabControllers) {
            if (typeof tabs?.active === 'string' && tabs.active) {
                preBindActive = tabs.active;
                break;
            }
        }

        // Re-bind tabs so the newly-injected tab/panel pair participates in normal tab logic.
        for (const tabs of tabControllers) {
            if (typeof tabs?.bind === 'function') {
                try {
                    tabs.bind(form);
                } catch (_) {}
            }
        }

        let activeTab = getActiveFromNav();
        if (!activeTab) {
            for (const tabs of tabControllers) {
                if (typeof tabs?.active === 'string' && tabs.active) {
                    activeTab = tabs.active;
                    break;
                }
            }
        }
        if (!activeTab) {
            const tabOptions = Array.isArray(app?.options?.tabs) ? app.options.tabs : [];
            const configured = tabOptions.find((tab) => (tab?.group ?? 'sheet') === dataGroup);
            if (typeof configured?.initial === 'string' && configured.initial) activeTab = configured.initial;
        }
        if (preBindActive === 'artificer') activeTab = 'artificer';

        if (activeTab === 'artificer') {
            tabButton.classList.add('active');
            tabPanel.classList.add('active');
        }

        for (const tabs of tabControllers) {
            if (!activeTab || typeof tabs?.activate !== 'function') continue;
            try {
                tabs.activate(activeTab, { triggerCallback: false });
            } catch (_) {}
        }
    }

    static _wireRangeDisplays(root) {
        if (!root?.querySelectorAll) return;
        const ranges = root.querySelectorAll('input[type="range"][data-artificer-range]');
        for (const input of ranges) {
            const key = input.dataset.artificerRange;
            const display = root.querySelector(`[data-artificer-range-value="${key}"]`);
            if (!display) continue;
            const sync = () => {
                display.textContent = String(input.value ?? '');
            };
            input.addEventListener('input', sync);
            sync();
        }
    }

    static _broadcastSceneArtificerUpdate(scene, changed, options, userId) {
        const changedSceneData = foundry.utils.getProperty(changed, `flags.${MODULE.ID}.scene`);
        if (changedSceneData == null) return;
        if (userId !== game.user.id) return;

        this._sockets?.emit(SCENE_SOCKET_EVENT, {
            sceneId: scene?.id ?? null,
            userId,
            changed: changedSceneData
        });

        // Keep Scene Directory badge state current after saving Scene Config.
        this._refreshSceneDirectoryIndicator(scene);
    }

    /**
     * Whether the scene-directory badge should show.
     *
     * THE QUESTION CHANGED. This used to answer "may this scene gather", which was the
     * right badge when a GM had to switch each scene on. Every scene with a habitat can
     * gather now, so that badge would mark almost all of them and mean nothing. It
     * answers "has a GM deliberately tuned this scene" instead -- which is what a GM
     * scanning the directory actually wants to know.
     *
     * Both facts still exist on the profile as `isConfigurable` and `isTuned`; this
     * picks the second on purpose.
     */
    static _hasGatheringConfigured(scene) {
        if (!scene) return false;
        return resolveSceneGatherProfile(scene, this._defaultHarvestingSkills).isTuned;
    }

    static _decorateSceneDirectory(html) {
        const root = this._resolveRoot(html);
        if (!root) return;
        const sceneItems = root.querySelectorAll?.('[data-document-id], [data-entry-id]');
        if (!sceneItems?.length) return;

        for (const item of sceneItems) {
            const sceneId = item.dataset?.documentId || item.dataset?.entryId;
            if (!sceneId) continue;
            const scene = game.scenes?.get?.(sceneId);
            const shouldShow = this._hasGatheringConfigured(scene);
            let badge = item.querySelector('.artificer-scene-gather-indicator');

            if (!shouldShow) {
                badge?.remove();
                item.classList?.remove('artificer-scene-has-gather');
                continue;
            }

            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'artificer-scene-gather-indicator';
                badge.innerHTML = '<i class="fa-solid fa-seedling"></i>';
                badge.title = 'Artificer gathering configured';
                item.appendChild(badge);
            }
            item.classList?.add('artificer-scene-has-gather');
        }
    }

    static _refreshSceneDirectoryIndicator(scene) {
        if (!scene?.id) return;
        const directoryRoot = document.querySelector?.('#scenes, .scenes-sidebar, .directory[data-tab="scenes"]');
        if (!directoryRoot) return;
        const item = directoryRoot.querySelector?.(`[data-document-id="${scene.id}"], [data-entry-id="${scene.id}"]`);
        if (!item) return;
        this._decorateSceneDirectory(directoryRoot);
    }

    /**
     * @param {string} message
     * @param {unknown} [details]
     * @param {boolean} [debug] Blacksmith's `blnDebug`: true prints ONLY in global debug mode.
     *                          It is not an error flag, which is how it was previously named.
     * @param {boolean} [notify]
     */
    static _log(message, details = null, debug = false, notify = false) {
        // Routed through the shared helper rather than window.BlacksmithUtils directly: that
        // global is unset whenever Blacksmith's ready chain bails, which is exactly when this
        // manager fails and exactly when its log lines matter.
        postBlacksmithConsole(MODULE.NAME, message, details, debug, notify);
    }
}
