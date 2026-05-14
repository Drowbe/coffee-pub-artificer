// ==================================================================
// ===== PINS MANAGER ===============================================
// ==================================================================

import { MODULE } from './const.js';
import { BlacksmithAPI } from '/modules/coffee-pub-blacksmith/api/blacksmith-api.js';
import { requestGatherAndHarvestFromSceneWithOptions } from './manager-gather.js';
import { resolveGatheringImageForScene, getGatherRuntimeDefaultsSync } from './manager-gathering-images.js';
import { FAMILY_LABELS, getPinTagsForComponentFamily } from './schema-artificer-item.js';

const PINS_CONTEXT = `${MODULE.ID}-pins-manager`;
const PIN_TYPE_GATHER_SPOT = 'gather-spot';
const PIN_TYPE_COMPONENT_LOCATION = 'component-location';
const PIN_TRANSITION_TYPES = Object.freeze([PIN_TYPE_GATHER_SPOT, PIN_TYPE_COMPONENT_LOCATION]);
const PIN_CREATE_TYPE = PIN_TYPE_COMPONENT_LOCATION;
const PIN_TEXT = 'Gathering Spot';
const BLACKSMITH_SOUNDS_BASE = 'modules/coffee-pub-blacksmith/sounds';
const BLACKSMITH_MODULE_ID = 'coffee-pub-blacksmith';
const BLACKSMITH_PINS_FLAG_KEY = 'pins';
const DISCOVERY_NODES_FLAG_KEY = 'discoveredNodes';
const PIN_EVENT_ANIMATIONS = Object.freeze({
    hover: { animation: 'ripple', sound: `${BLACKSMITH_SOUNDS_BASE}/interface-pop-03.mp3` },
    click: { animation: null, sound: null },
    doubleClick: { animation: 'scale-medium', sound: `${BLACKSMITH_SOUNDS_BASE}/rustling-grass.mp3` },
    add: { animation: 'ping', sound: `${BLACKSMITH_SOUNDS_BASE}/interface-pop-02.mp3` },
    delete: { animation: 'dissolve', sound: `${BLACKSMITH_SOUNDS_BASE}/interface-pop-01.mp3` }
});

function _stableSerialize(value) {
    if (Array.isArray(value)) {
        return `[${value.map((v) => _stableSerialize(v)).join(',')}]`;
    }
    if (value && typeof value === 'object') {
        const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
        return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${_stableSerialize(v)}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

function _isEventAnimationEqual(a, b) {
    return _stableSerialize(a ?? null) === _stableSerialize(b ?? null);
}

export class PinsManager {
    static _hookManager = null;
    static _pins = null;
    static _initialized = false;
    static _syncInProgress = new Set();
    static _syncQueued = new Set();
    static _pinDeletedHookRegistered = false;

    static async initialize() {
        if (this._initialized) return;
        this._log('PinsManager: initializing');

        const blacksmith = await BlacksmithAPI.get();
        this._pins = blacksmith?.pins ?? null;

        if (!this._pins) {
            throw new Error('Blacksmith Pins API not available');
        }

        // Register the double-click handler on ALL clients — players need this to trigger gather.
        this._pins.on('doubleClick', (evt) => this._onPinDoubleClick(evt), { moduleId: MODULE.ID });
        this._log('PinsManager: pin double-click handler registered');

        this._initialized = true;

        if (!game.user?.isGM) {
            this._log('PinsManager: initialized (player mode)');
            return;
        }

        // GM-only: pin type registration, sync hooks, delete hooks.
        if (!this._pins.isAvailable?.()) {
            throw new Error('Blacksmith Pins API not available for GM');
        }

        this._hookManager = await BlacksmithAPI.getHookManager();
        this._pins.registerPinType?.(MODULE.ID, PIN_TYPE_GATHER_SPOT, 'Gathering Spot');
        this._pins.registerPinType?.(MODULE.ID, PIN_TYPE_COMPONENT_LOCATION, 'Component Location');

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
        this._registerPinDeleteRefreshHook();

        this._log('PinsManager: initialized (GM mode)');

        // Initial sync when module is ready and canvas already active.
        await this.syncActiveScenePins();
    }

    static async _onUpdateScene(scene, changed) {
        if (!scene?.id || scene.id !== canvas?.scene?.id) return;
        const changedArtificerScene = foundry.utils.getProperty(changed, `flags.${MODULE.ID}.scene`);
        const changedBlacksmithPins = foundry.utils.getProperty(changed, `flags.${BLACKSMITH_MODULE_ID}.${BLACKSMITH_PINS_FLAG_KEY}`);

        if (game.user?.isGM) {
            if (!changedArtificerScene) return;
            await this.syncScenePins(scene.id);
            return;
        }

        if (changedArtificerScene || changedBlacksmithPins !== undefined) {
            await this._reloadPinsForCurrentScene(scene.id);
        }
    }

    static async syncActiveScenePins() {
        const sceneId = canvas?.scene?.id;
        if (!sceneId) return;
        await this.syncScenePins(sceneId);
    }

    static async syncScenePins(sceneId) {
        if (!sceneId) return;
        if (!game.user?.isGM) {
            await this._reloadPinsForCurrentScene(sceneId);
            return;
        }
        if (this._syncInProgress.has(sceneId)) {
            // If updates arrive while a sync is running, queue a second pass.
            this._syncQueued.add(sceneId);
            return;
        }
        this._syncInProgress.add(sceneId);

        try {
            do {
                this._syncQueued.delete(sceneId);

                if (!this._pins?.isReady?.()) {
                    await this._pins.whenReady?.();
                }
                if (!this._pins?.isReady?.()) return;

                const scene = game.scenes?.get(sceneId);
                if (!scene) return;

                const sceneFlags = scene.getFlag(MODULE.ID, 'scene') ?? {};
                const enabled = !!sceneFlags.enabled;
                const discoveredNodes = enabled && Array.isArray(sceneFlags[DISCOVERY_NODES_FLAG_KEY])
                    ? sceneFlags[DISCOVERY_NODES_FLAG_KEY].filter((n) => n && typeof n === 'object' && n.id)
                    : [];
                const targetCount = discoveredNodes.length;
                const bounds = this._getSpawnBounds(scene);
                const componentTags = this._getComponentLocationTaxonomyTags();
                const existingPins = PIN_TRANSITION_TYPES.flatMap((pinType) => (
                    this._pins.list({
                        sceneId,
                        moduleId: MODULE.ID,
                        type: pinType
                    }) ?? []
                ));
                const existingById = new Map(existingPins.map((p) => [String(p.id), p]));
                const discoveredIdSet = new Set(discoveredNodes.map((n) => String(n.id)));
                let changed = false;

                // Remove pins that are no longer represented by discovered nodes.
                for (const pin of existingPins) {
                    if (!discoveredIdSet.has(String(pin.id))) {
                        await this._pins.delete(pin.id, { sceneId });
                        changed = true;
                    }
                }

                // Ensure each discovered node has an up-to-date pin.
                for (const node of discoveredNodes) {
                    const nodeId = String(node.id);
                    const pin = existingById.get(nodeId) ?? null;
                    const updates = {};

                    if (!pin) {
                        const nodeX = Number(node?.x);
                        const nodeY = Number(node?.y);
                        const hasNodePoint = Number.isFinite(nodeX) && Number.isFinite(nodeY) && this._isPointInBounds(nodeX, nodeY, bounds);
                        const { x, y } = hasNodePoint ? { x: nodeX, y: nodeY } : this._getRandomPointInBounds(bounds);
                        const defaultDesign = this._getGatherSpotDefaultDesign();
                        const defaultStyle = (defaultDesign.style && typeof defaultDesign.style === 'object')
                            ? defaultDesign.style
                            : {
                                fill: '#0f0f0f',
                                stroke: '#ffffff',
                                strokeWidth: 3,
                                iconColor: '#eaffe5'
                            };
                        const _rt = getGatherRuntimeDefaultsSync();
                        const _pd = _rt.pinDesign;
                        await this._pins.create({
                            ...defaultDesign,
                            id: nodeId,
                            moduleId: MODULE.ID,
                            type: PIN_CREATE_TYPE,
                            tags: getPinTagsForComponentFamily(node?.sourceFamily, { taxonomyTags: componentTags }),
                            x,
                            y,
                            text: this._getNodePinText(node),
                            ownership: { default: 2 },
                            image: node?.idleImage || (await resolveGatheringImageForScene(scene, 'idle', { families: [node?.sourceFamily] })) || _rt.pinDefaultImage,
                            shape: defaultDesign.shape ?? 'none',
                            dropShadow: defaultDesign.dropShadow ?? true,
                            imageFit: defaultDesign.imageFit ?? _pd.imageFit,
                            imageZoom: defaultDesign.imageZoom ?? _pd.imageZoom,
                            textLayout: defaultDesign.textLayout ?? 'arc-below',
                            textDisplay: defaultDesign.textDisplay ?? 'hover',
                            textColor: defaultDesign.textColor ?? _pd.textColor,
                            textSize: defaultDesign.textSize ?? _pd.textSize,
                            textMaxLength: defaultDesign.textMaxLength ?? _pd.textMaxLength,
                            textMaxWidth: defaultDesign.textMaxWidth ?? _pd.textMaxWidth,
                            textScaleWithPin: defaultDesign.textScaleWithPin ?? _pd.textScaleWithPin,
                            eventAnimations: PIN_EVENT_ANIMATIONS,
                            size: defaultDesign.size ?? { w: _rt.pinSize, h: _rt.pinSize },
                            style: defaultStyle
                        }, { sceneId });
                        changed = true;
                        continue;
                    }

                    if ((pin?.ownership?.default ?? 0) < 2) {
                        updates.ownership = { default: 2 };
                    }
                    // Use the node's stored idleImage if present; otherwise keep the pin's
                    // current image. Never re-call the random resolver on existing pins.
                    const resolvedIdleImage = node?.idleImage || pin?.image || getGatherRuntimeDefaultsSync().pinDefaultImage;
                    if (String(pin?.image ?? '') !== String(resolvedIdleImage ?? '')) {
                        updates.image = resolvedIdleImage;
                        updates.shape = 'none';
                    }
                    const nextText = this._getNodePinText(node);
                    if (pin?.text !== nextText) {
                        updates.text = nextText;
                    }
                    if (!_isEventAnimationEqual(pin?.eventAnimations, PIN_EVENT_ANIMATIONS)) {
                        updates.eventAnimations = PIN_EVENT_ANIMATIONS;
                    }
                    if (!this._isPointInBounds(pin?.x, pin?.y, bounds)) {
                        const { x, y } = this._getRandomPointInBounds(bounds);
                        updates.x = x;
                        updates.y = y;
                    }
                    if (Object.keys(updates).length) {
                        await this._pins.update(pin.id, updates, { sceneId });
                        changed = true;
                    }
                }

                if (changed) {
                    await this._pins.reload();
                    this._log(`PinsManager: synced gather spots for scene "${scene.name}" target=${targetCount}`);
                }
            } while (this._syncQueued.has(sceneId));
        } catch (error) {
            this._log('PinsManager: sync failed', error?.message ?? String(error), true, false);
        } finally {
            this._syncInProgress.delete(sceneId);
        }
    }

    static async _reloadPinsForCurrentScene(sceneId) {
        if (!this._pins) return;
        if (sceneId !== canvas?.scene?.id) return;
        try {
            if (!this._pins?.isReady?.()) {
                await this._pins.whenReady?.();
            }
            if (!this._pins?.isReady?.()) return;
            await this._pins.reload?.();
        } catch {
            // no-op: player refresh is best-effort
        }
    }

    static _registerPinDeleteRefreshHook() {
        if (this._pinDeletedHookRegistered) return;

        // Single pin deleted — payload includes pinId; remove the matching node directly.
        Hooks.on('blacksmith.pins.deleted', async (payload) => {
            const moduleId = String(payload?.moduleId ?? '');
            const type = String(payload?.type ?? '');
            const sceneId = payload?.sceneId ?? null;
            if (moduleId !== MODULE.ID) return;
            if (!PIN_TRANSITION_TYPES.includes(type)) return;
            if (!sceneId) return;
            if (game.user?.isGM) {
                const pinId = String(payload?.pinId ?? payload?.id ?? '');
                if (pinId) await this._removeNodeForPin(sceneId, pinId);
            }
            if (sceneId === canvas?.scene?.id) await this._reloadPinsForCurrentScene(sceneId);
        });

        // Bulk deletes carry no per-pin IDs — reconcile via live list comparison.
        const onBulkDelete = async (payload) => {
            const moduleId = String(payload?.moduleId ?? '');
            const sceneId = payload?.sceneId ?? null;
            if (moduleId !== MODULE.ID) return;
            if (!sceneId) return;
            if (game.user?.isGM) await this._reconcileNodesAfterBulkDelete(sceneId);
            if (sceneId === canvas?.scene?.id) await this._reloadPinsForCurrentScene(sceneId);
        };
        Hooks.on('blacksmith.pins.deletedAll', onBulkDelete);
        Hooks.on('blacksmith.pins.deletedAllByType', onBulkDelete);

        this._pinDeletedHookRegistered = true;
    }

    static async _removeNodeForPin(sceneId, pinId) {
        const scene = game.scenes?.get?.(sceneId);
        if (!scene) return;
        const sceneFlags = scene.getFlag(MODULE.ID, 'scene') ?? {};
        const existing = Array.isArray(sceneFlags[DISCOVERY_NODES_FLAG_KEY]) ? sceneFlags[DISCOVERY_NODES_FLAG_KEY] : [];
        if (!existing.length) return;
        const updated = existing.filter((n) => String(n?.id) !== pinId);
        if (updated.length === existing.length) return;
        await scene.setFlag(MODULE.ID, 'scene', { ...sceneFlags, [DISCOVERY_NODES_FLAG_KEY]: updated });
    }

    static async _reconcileNodesAfterBulkDelete(sceneId) {
        const scene = game.scenes?.get?.(sceneId);
        if (!scene || !this._pins?.list) return;
        const sceneFlags = scene.getFlag(MODULE.ID, 'scene') ?? {};
        const existing = Array.isArray(sceneFlags[DISCOVERY_NODES_FLAG_KEY]) ? sceneFlags[DISCOVERY_NODES_FLAG_KEY] : [];
        if (!existing.length) return;
        const livePinIds = new Set(
            PIN_TRANSITION_TYPES.flatMap((t) =>
                (this._pins.list({ sceneId, moduleId: MODULE.ID, type: t }) ?? []).map((p) => String(p.id))
            )
        );
        const updated = existing.filter((n) => livePinIds.has(String(n?.id)));
        if (updated.length === existing.length) return;
        await scene.setFlag(MODULE.ID, 'scene', { ...sceneFlags, [DISCOVERY_NODES_FLAG_KEY]: updated });
    }

    static _getRandomPointOnCanvas() {
        const bounds = this._getSpawnBounds(canvas?.scene ?? null);
        return this._getRandomPointInBounds(bounds);
    }

    static _getSpawnBounds(scene = canvas?.scene ?? null) {
        const dims = canvas?.dimensions ?? {};
        const edgePadding = Math.max(20, Math.floor(getGatherRuntimeDefaultsSync().pinSize / 2));
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

    static _getNodePinText(node) {
        const family = String(node?.sourceFamily ?? '').trim();
        if (!family) return PIN_TEXT;
        const label = FAMILY_LABELS?.[family] ?? family;
        return `Gather: ${label}`;
    }

    static _getComponentLocationTaxonomyTags() {
        const taxonomy = this._pins?.getModuleTaxonomy?.(MODULE.ID);
        const typeDef = taxonomy?.[PIN_TYPE_COMPONENT_LOCATION];
        return Array.isArray(typeDef?.tags) ? typeDef.tags : [];
    }

    static _getGatherSpotDefaultDesign() {
        const rt = getGatherRuntimeDefaultsSync();
        const pd = rt.pinDesign;

        if (pd.overrideDefaultPinDesign) {
            return {
                shape: pd.shape,
                dropShadow: pd.dropShadow,
                imageFit: pd.imageFit,
                imageZoom: pd.imageZoom,
                textLayout: pd.textLayout,
                textDisplay: pd.textDisplay,
                textColor: pd.textColor,
                textSize: pd.textSize,
                textMaxLength: pd.textMaxLength,
                textMaxWidth: pd.textMaxWidth,
                textScaleWithPin: pd.textScaleWithPin,
                style: { fill: pd.fill, stroke: pd.stroke, strokeWidth: pd.strokeWidth, iconColor: pd.iconColor }
            };
        }

        const raw = this._pins?.getDefaultPinDesign?.(MODULE.ID, PIN_CREATE_TYPE)
            ?? this._pins?.getDefaultPinDesign?.(MODULE.ID, PIN_TYPE_GATHER_SPOT)
            ?? null;
        if (!raw || typeof raw !== 'object') return {};

        const out = {};
        if (raw.size && typeof raw.size === 'object') {
            const w = Number(raw.size.w);
            const h = Number(raw.size.h);
            if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) out.size = { w, h };
        }
        if (typeof raw.shape === 'string') out.shape = raw.shape;
        if (typeof raw.dropShadow === 'boolean') out.dropShadow = raw.dropShadow;
        if (raw.style && typeof raw.style === 'object') out.style = { ...raw.style };
        if (typeof raw.textLayout === 'string') out.textLayout = raw.textLayout;
        if (typeof raw.textDisplay === 'string') out.textDisplay = raw.textDisplay;
        if (typeof raw.textColor === 'string') out.textColor = raw.textColor;
        if (Number.isFinite(Number(raw.textSize))) out.textSize = Number(raw.textSize);
        if (Number.isFinite(Number(raw.textMaxLength))) out.textMaxLength = Number(raw.textMaxLength);
        if (Number.isFinite(Number(raw.textMaxWidth))) out.textMaxWidth = Number(raw.textMaxWidth);
        if (typeof raw.textScaleWithPin === 'boolean') out.textScaleWithPin = raw.textScaleWithPin;
        if (typeof raw.imageFit === 'string') out.imageFit = raw.imageFit;
        if (Number.isFinite(Number(raw.imageZoom))) out.imageZoom = Number(raw.imageZoom);
        return out;
    }

    static async _onPinDoubleClick(evt) {
        const pin = evt?.pin ?? null;
        const clickingUserId = evt?.userId ?? null;
        this._log(`Pin double-click received`, { pinId: pin?.id ?? '(none)', moduleId: pin?.moduleId ?? '(none)', type: pin?.type ?? '(none)', clickingUserId, myUserId: game.user?.id });
        // pins.on fires on all clients — only the clicking user's client should process the gather.
        if (clickingUserId && clickingUserId !== game.user?.id) return;
        if (!pin) { this._log('Pin double-click: no pin in event, ignoring'); return; }
        if (pin.moduleId !== MODULE.ID) { this._log(`Pin double-click: moduleId mismatch (${pin.moduleId}), ignoring`); return; }
        if (!PIN_TRANSITION_TYPES.includes(pin.type ?? '')) { this._log(`Pin double-click: type "${pin.type}" not in transition types, ignoring`); return; }
        this._log(`Pin double-click: launching gather for pin ${pin.id}`);
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
