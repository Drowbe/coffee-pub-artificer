// ==================================================================
// ===== PINS MANAGER ===============================================
// ==================================================================

import { MODULE } from './const.js';
import { BlacksmithAPI } from '/modules/coffee-pub-blacksmith/api/blacksmith-api.js';
import { requestGatherAndHarvestFromSceneWithOptions } from './manager-gather.js';
import { resolveGatheringImageForScene } from './manager-gathering-images.js';

const PINS_CONTEXT = `${MODULE.ID}-pins-manager`;
const PIN_TYPE_GATHER_SPOT = 'gather-spot';
const PIN_TEXT = 'Gathering Spot';
const PIN_SIZE = 100;
const PIN_DEFAULT_IMAGE = 'fa-solid fa-seedling';
const LEGACY_WORKING_IMAGE_PATHS = new Set([
    'modules/coffee-pub-artificer/images/animations/gathering-leaf-swirl-00.webp',
    'modules/coffee-pub-artificer/images/animations/swirl-leaves/gathering-leaf-swirl-00.webp',
    'images/animations/gathering-leaf-swirl-00.webp',
    '/modules/coffee-pub-artificer/images/animations/gathering-leaf-swirl-00.webp'
]);

export class PinsManager {
    static _hookManager = null;
    static _pins = null;
    static _initialized = false;
    static _syncInProgress = new Set();

    static async initialize() {
        if (this._initialized) return;
        this._log('PinsManager: initializing');

        this._hookManager = await BlacksmithAPI.getHookManager();
        const blacksmith = await BlacksmithAPI.get();
        this._pins = blacksmith?.pins ?? null;

        if (!this._pins?.isAvailable?.()) {
            throw new Error('Blacksmith Pins API not available');
        }

        this._pins.registerPinType?.(MODULE.ID, PIN_TYPE_GATHER_SPOT, 'Gathering Spot');
        this._pins.on('doubleClick', (evt) => this._onPinDoubleClick(evt), { moduleId: MODULE.ID });
        this._log('PinsManager: pin double-click handler registered');

        this._hookManager.registerHook({
            name: 'canvasReady',
            description: 'Sync Artificer gather pins for active scene',
            context: PINS_CONTEXT,
            key: `${PINS_CONTEXT}-canvas-ready`,
            priority: 3,
            callback: () => this.syncActiveScenePins()
        });
        this._log('PinsManager: hook registered (canvasReady)');

        this._hookManager.registerHook({
            name: 'updateScene',
            description: 'Sync Artificer gather pins when scene settings change',
            context: PINS_CONTEXT,
            key: `${PINS_CONTEXT}-update-scene`,
            priority: 3,
            callback: (scene, changed) => this._onUpdateScene(scene, changed)
        });
        this._log('PinsManager: hook registered (updateScene)');

        this._initialized = true;
        this._log('PinsManager: initialized');

        // Initial sync when module is ready and canvas already active.
        await this.syncActiveScenePins();
    }

    static async _onUpdateScene(scene, changed) {
        if (!scene?.id || scene.id !== canvas?.scene?.id) return;
        const changedSceneData = foundry.utils.getProperty(changed, `flags.${MODULE.ID}.scene`);
        if (!changedSceneData) return;
        await this.syncScenePins(scene.id);
    }

    static async syncActiveScenePins() {
        const sceneId = canvas?.scene?.id;
        if (!sceneId) return;
        await this.syncScenePins(sceneId);
    }

    static async syncScenePins(sceneId) {
        if (!sceneId || !game.user?.isGM) return;
        if (this._syncInProgress.has(sceneId)) return;
        this._syncInProgress.add(sceneId);

        try {
            if (!this._pins?.isReady?.()) {
                await this._pins.whenReady?.();
            }
            if (!this._pins?.isReady?.()) return;

            const scene = game.scenes?.get(sceneId);
            if (!scene) return;

            const sceneFlags = scene.getFlag(MODULE.ID, 'scene') ?? {};
            const enabled = !!sceneFlags.enabled;
            const targetCount = enabled ? Math.max(0, Number(sceneFlags.gatherSpots) || 0) : 0;
            const bounds = this._getSpawnBounds(scene);
            const existingPins = this._pins.list({
                sceneId,
                moduleId: MODULE.ID,
                type: PIN_TYPE_GATHER_SPOT
            }) ?? [];
            let changed = false;
            for (const pin of existingPins) {
                const updates = {};
                if ((pin?.ownership?.default ?? 0) < 2) {
                    updates.ownership = { default: 2 };
                }
                if (this._isLegacyWorkingImage(pin?.image)) {
                    const resolvedIdleImage = await resolveGatheringImageForScene(scene, 'idle');
                    updates.image = resolvedIdleImage || PIN_DEFAULT_IMAGE;
                    updates.shape = 'none';
                }
                if (this._isSeedlingIcon(pin?.image)) {
                    const resolvedIdleImage = await resolveGatheringImageForScene(scene, 'idle');
                    if (resolvedIdleImage) updates.image = resolvedIdleImage;
                    updates.shape = 'none';
                }
                if (Object.keys(updates).length) {
                    await this._pins.update(pin.id, updates, { sceneId });
                    changed = true;
                }
                if (!this._isPointInBounds(pin?.x, pin?.y, bounds)) {
                    const { x, y } = this._getRandomPointInBounds(bounds);
                    await this._pins.update(pin.id, { x, y }, { sceneId });
                    changed = true;
                }
            }

            if (existingPins.length > targetCount) {
                const toDelete = existingPins.slice(targetCount);
                for (const pin of toDelete) {
                    await this._pins.delete(pin.id, { sceneId });
                }
                changed = changed || toDelete.length > 0;
            }

            if (existingPins.length < targetCount) {
                const toCreate = targetCount - existingPins.length;
                for (let i = 0; i < toCreate; i++) {
                    const { x, y } = this._getRandomPointInBounds(bounds);
                    await this._pins.create({
                        id: foundry.utils.randomID(),
                        moduleId: MODULE.ID,
                        type: PIN_TYPE_GATHER_SPOT,
                        x,
                        y,
                        text: PIN_TEXT,
                        ownership: { default: 2 },
                        image: (await resolveGatheringImageForScene(scene, 'idle')) || PIN_DEFAULT_IMAGE,
                        shape: 'none',
                        dropShadow: true,
                        textLayout: 'arc-below',
                        textDisplay: 'hover',
                        size: { w: PIN_SIZE, h: PIN_SIZE },
                        style: {
                            fill: '#0f0f0f',
                            stroke: '#ffffff',
                            strokeWidth: 3,
                            iconColor: '#eaffe5'
                        }
                    }, { sceneId });
                }
                changed = changed || toCreate > 0;
            }

            if (changed) {
                await this._pins.reload();
                this._log(`PinsManager: synced gather spots for scene "${scene.name}" target=${targetCount}`);
            }
        } catch (error) {
            this._log('PinsManager: sync failed', error?.message ?? String(error), true, false);
        } finally {
            this._syncInProgress.delete(sceneId);
        }
    }

    static _getRandomPointOnCanvas() {
        const bounds = this._getSpawnBounds(canvas?.scene ?? null);
        return this._getRandomPointInBounds(bounds);
    }

    static _getSpawnBounds(scene = canvas?.scene ?? null) {
        const dims = canvas?.dimensions ?? {};
        const edgePadding = Math.max(20, Math.floor(PIN_SIZE / 2));
        const sceneX = Number(dims.sceneX);
        const sceneY = Number(dims.sceneY);
        const sceneWidth = Number(dims.sceneWidth);
        const sceneHeight = Number(dims.sceneHeight);

        if (Number.isFinite(sceneX) && Number.isFinite(sceneY) && Number.isFinite(sceneWidth) && Number.isFinite(sceneHeight)) {
            return {
                minX: sceneX + edgePadding,
                minY: sceneY + edgePadding,
                maxX: Math.max(sceneX + edgePadding + 1, sceneX + sceneWidth - edgePadding),
                maxY: Math.max(sceneY + edgePadding + 1, sceneY + sceneHeight - edgePadding)
            };
        }

        const rect = dims.sceneRect ?? { x: 0, y: 0, width: Number(dims.width) || Number(scene?.width) || 3000, height: Number(dims.height) || Number(scene?.height) || 2000 };
        return {
            minX: Number(rect.x) + edgePadding,
            minY: Number(rect.y) + edgePadding,
            maxX: Math.max(Number(rect.x) + edgePadding + 1, Number(rect.x) + Number(rect.width) - edgePadding),
            maxY: Math.max(Number(rect.y) + edgePadding + 1, Number(rect.y) + Number(rect.height) - edgePadding)
        };
    }

    static _isPointInBounds(x, y, bounds) {
        const px = Number(x);
        const py = Number(y);
        if (!Number.isFinite(px) || !Number.isFinite(py)) return false;
        return px >= bounds.minX && px <= bounds.maxX && py >= bounds.minY && py <= bounds.maxY;
    }

    static _getRandomPointInBounds(bounds) {
        const minX = Number(bounds?.minX) || 0;
        const minY = Number(bounds?.minY) || 0;
        const maxX = Math.max(minX + 1, Number(bounds?.maxX) || minX + 1);
        const maxY = Math.max(minY + 1, Number(bounds?.maxY) || minY + 1);
        const x = Math.floor(Math.random() * (maxX - minX) + minX);
        const y = Math.floor(Math.random() * (maxY - minY) + minY);
        return { x, y };
    }

    static _isLegacyWorkingImage(imagePath) {
        const value = String(imagePath ?? '').trim();
        if (!value) return false;
        if (LEGACY_WORKING_IMAGE_PATHS.has(value)) return true;
        return value.includes('/modules/coffee-pub-artificer/images/animations/gathering-leaf-swirl-00.webp')
            || value.includes('/modules/coffee-pub-artificer/images/animations/swirl-leaves/gathering-leaf-swirl-00.webp')
            || value.endsWith('/images/animations/gathering-leaf-swirl-00.webp');
    }

    static _isSeedlingIcon(imagePath) {
        const value = String(imagePath ?? '').trim().toLowerCase();
        if (!value) return true;
        return value.includes('fa-seedling');
    }

    static async _onPinDoubleClick(evt) {
        const pin = evt?.pin ?? null;
        if (!pin) return;
        if (pin.moduleId !== MODULE.ID) return;
        if ((pin.type ?? '') !== PIN_TYPE_GATHER_SPOT) return;
        await requestGatherAndHarvestFromSceneWithOptions({
            sourcePinId: pin.id,
            requirePinProximity: true,
            maxDistanceUnits: 10
        });
    }

    static _log(message, details = null, isError = false, notify = false) {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, message, details, isError, notify);
        }
    }
}
