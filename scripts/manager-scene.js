// ==================================================================
// ===== SCENE MANAGER ===============================================
// ==================================================================

import { MODULE } from './const.js';
import { BlacksmithAPI } from '/modules/coffee-pub-blacksmith/api/blacksmith-api.js';
import { OFFICIAL_BIOMES } from './schema-ingredients.js';
import { ARTIFICER_TYPES, FAMILIES_BY_TYPE, FAMILY_LABELS } from './schema-artificer-item.js';
import { CRAFTING_SKILLS } from './schema-recipes.js';

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
        const normalizeList = (value) => {
            if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
            if (typeof value === 'string' && value.trim()) return [value.trim()];
            return [];
        };
        const enabled = !!sceneFlags.enabled;
        const profile = (sceneFlags.profile ?? '').toString();
        const selectedHabitats = new Set(normalizeList(sceneFlags.habitats));
        const componentFamilies = FAMILIES_BY_TYPE[ARTIFICER_TYPES.COMPONENT] ?? [];
        const selectedComponentTypes = new Set(normalizeList(sceneFlags.componentTypes));
        const defaultHarvestingSkills = [CRAFTING_SKILLS.HERBALISM, CRAFTING_SKILLS.COOKING];
        const currentHarvestingSkills = normalizeList(sceneFlags.harvestingSkills);
        const rawHarvestingSkills = currentHarvestingSkills.length
            ? currentHarvestingSkills
            : defaultHarvestingSkills;
        const selectedHarvestingSkills = new Set(rawHarvestingSkills.map((s) => String(s).trim()).filter(Boolean));
        const fallbackDC = Number(sceneFlags.defaultDC);
        const discoveryDCRaw = Number(sceneFlags.discoveryDC);
        const harvestDCRaw = Number(sceneFlags.harvestDC);
        const discoveryDCFallback = Number.isFinite(discoveryDCRaw)
            ? Math.max(0, Math.min(20, discoveryDCRaw))
            : (Number.isFinite(fallbackDC) ? Math.max(0, Math.min(20, fallbackDC)) : 5);
        const discoveryBaseDCRaw = Number(sceneFlags.discoveryBaseDC);
        const discoveryBaseDC = Number.isFinite(discoveryBaseDCRaw)
            ? Math.max(0, Math.min(20, discoveryBaseDCRaw))
            : discoveryDCFallback;
        const harvestDC = Number.isFinite(harvestDCRaw)
            ? Math.max(0, Math.min(20, harvestDCRaw))
            : (Number.isFinite(fallbackDC) ? Math.max(0, Math.min(20, fallbackDC)) : 5);
        const clampOffset = (raw, fallbackValue) => Number.isFinite(Number(raw))
            ? Math.max(0, Math.min(30, Number(raw)))
            : fallbackValue;
        const discoveryOffsetCommon = clampOffset(sceneFlags.discoveryOffsetCommon, 0);
        const discoveryOffsetUncommon = clampOffset(sceneFlags.discoveryOffsetUncommon, 3);
        const discoveryOffsetRare = clampOffset(sceneFlags.discoveryOffsetRare, 6);
        const discoveryOffsetVeryRare = clampOffset(sceneFlags.discoveryOffsetVeryRare, 10);
        const discoveryOffsetLegendary = clampOffset(sceneFlags.discoveryOffsetLegendary, 14);
        const gatherSpots = Number.isFinite(Number(sceneFlags.gatherSpots)) ? Math.max(0, Math.min(30, Number(sceneFlags.gatherSpots))) : 0;
        const discoveryRadiusUnitsRaw = Number(sceneFlags.discoveryRadiusUnits);
        const discoveryRadiusUnits = Number.isFinite(discoveryRadiusUnitsRaw)
            ? Math.max(5, Math.min(300, Math.round(discoveryRadiusUnitsRaw / 5) * 5))
            : 60;
        const habitatOptionsHtml = OFFICIAL_BIOMES.map((biome) => {
            const checked = selectedHabitats.has(biome) ? 'checked' : '';
            return `
                <label class="checkbox artificer-scene-checkbox">
                    <input type="checkbox" name="flags.${MODULE.ID}.scene.habitats" value="${foundry.utils.escapeHTML(biome)}" ${checked} />
                    <span>${foundry.utils.escapeHTML(biome)}</span>
                </label>
            `;
        }).join('');
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
        const harvestingSkillOptionsHtml = Object.values(CRAFTING_SKILLS).map((skillId) => {
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
                <label>Enable Artificer Features</label>
                <div class="form-fields">
                    <input type="checkbox" name="flags.${MODULE.ID}.scene.enabled" ${enabled ? 'checked' : ''} />
                </div>
            </div>
            <div class="form-group">
                <label>Artificer Profile</label>
                <div class="form-fields">
                    <input type="text" name="flags.${MODULE.ID}.scene.profile" value="${foundry.utils.escapeHTML(profile)}" placeholder="Default" />
                </div>
            </div>
            <fieldset class="form-group artificer-scene-fieldset">
                <legend>Habitats</legend>
                <div class="form-fields artificer-scene-checkbox-grid">
                    ${habitatOptionsHtml}
                </div>
            </fieldset>
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
                    <input type="range" min="0" max="30" step="1" name="flags.${MODULE.ID}.scene.gatherSpots" value="${gatherSpots}" data-artificer-range="spots" />
                    <span class="range-value" data-artificer-range-value="spots">${gatherSpots}</span>
                </div>
                <p class="hint">Maximum discovered gathering spots allowed on this scene (0-30).</p>
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

        // Keep Save Changes last in the form flow.
        const footer = form.querySelector('.form-footer, footer.application-footer');
        if (footer?.parentElement) {
            footer.parentElement.appendChild(footer);
        }

        this._log(`SceneManager: Artificer tab injected for scene "${app?.document?.name ?? 'Unknown'}"`);
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

        this._sockets.emit(SCENE_SOCKET_EVENT, {
            sceneId: scene?.id ?? null,
            userId,
            changed: changedSceneData
        });

        // Keep Scene Directory badge state current after saving Scene Config.
        this._refreshSceneDirectoryIndicator(scene);
    }

    static _hasGatheringConfigured(scene) {
        if (!scene) return false;
        const flags = scene.getFlag(MODULE.ID, 'scene') ?? {};
        const normalizeList = (value) => {
            if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
            if (typeof value === 'string' && value.trim()) return [value.trim()];
            return [];
        };
        const enabled = !!flags.enabled;
        const gatherSpots = Math.max(0, Number(flags.gatherSpots) || 0);
        const habitats = normalizeList(flags.habitats);
        const componentTypes = normalizeList(flags.componentTypes);
        return enabled && gatherSpots > 0 && habitats.length > 0 && componentTypes.length > 0;
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

    static _log(message, details = null, isError = false, notify = false) {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, message, details, isError, notify);
        }
    }
}
