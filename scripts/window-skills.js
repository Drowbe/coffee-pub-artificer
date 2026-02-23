// ==================================================================
// ===== ARTIFICER SKILLS WINDOW ====================================
// ==================================================================
// Stacked horizontal skill panels (left) + details pane (right).
// Data driven by resources/skills-details.json.
// Click badge → skill details. Click slot → slot details.

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

import { SkillManager } from './manager-skills.js';

const SKILLS_APP_ID = 'artificer-skills';
const SKILLS_DETAILS_URL = 'modules/coffee-pub-artificer/resources/skills-details.json';

const _skillManager = new SkillManager();

/**
 * Check if actor has item matching name (for kit requirement)
 * @param {Actor|null} actor
 * @param {string} name - Item name to match (e.g. "Herbalism Kit")
 * @returns {boolean}
 */
function actorHasItemNamed(actor, name) {
    if (!actor || !name?.trim()) return true;
    const target = name.trim();
    return actor.items.some((i) => (i.name || '').trim() === target);
}

/** Cached skills data from JSON */
let _skillsDetailsCache = null;

/**
 * Load skills details from JSON. Caches result.
 * @returns {Promise<{skills: Array}>}
 */
async function loadSkillsDetails() {
    if (_skillsDetailsCache) return _skillsDetailsCache;
    try {
        const res = await fetch(SKILLS_DETAILS_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        _skillsDetailsCache = data;
        return data;
    } catch (e) {
        console.warn('Artificer Skills: Could not load skills-details.json', e);
        _skillsDetailsCache = { schemaVersion: 1, skills: [] };
        return _skillsDetailsCache;
    }
}

let _skillsDelegationAttached = false;
let _currentSkillsWindowRef = null;

/**
 * Sort slotIDs by prerequisite order (prereqs first).
 * @param {string[]} slotIDs - Slot IDs to sort
 * @returns {Promise<string[]>}
 */
async function _sortByPrereqs(slotIDs) {
    const { skills = [] } = await loadSkillsDetails();
    const slotById = /** @type {Map<string, { requirement: string, skillId: string }>} */ (new Map());
    for (const skill of skills) {
        for (const s of skill.slots ?? []) {
            const id = s.slotID ?? '';
            if (id) slotById.set(id, { requirement: s.requirement ?? '', skillId: skill.id });
        }
    }
    const prereqId = (slotID) => {
        const info = slotById.get(slotID);
        if (!info?.requirement) return null;
        const skill = skills.find((sk) => sk.id === info.skillId);
        const slot = (skill?.slots ?? []).find((s) => s.name === info.requirement);
        return slot?.slotID ?? null;
    };
    const result = [];
    const remaining = new Set(slotIDs);
    while (remaining.size > 0) {
        let picked = null;
        for (const id of remaining) {
            const pre = prereqId(id);
            if (!pre || !remaining.has(pre)) {
                picked = id;
                break;
            }
        }
        if (picked == null) break;
        remaining.delete(picked);
        result.push(picked);
    }
    for (const id of remaining) result.push(id);
    return result;
}

/**
 * Artificer Skills Window - Skill and slot details driven by JSON.
 */
export class SkillsWindow extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(foundry.utils.mergeObject({}, super.DEFAULT_OPTIONS ?? {}), {
        id: SKILLS_APP_ID,
        classes: ['window-artificer-skills', 'artificer-skills-window'],
        position: { width: 900, height: 600 },
        window: { title: 'Artificer Skills', resizable: true, minimizable: true },
        actions: {
            reset: SkillsWindow._actionReset,
            apply: SkillsWindow._actionApply,
            selectSkillBadge: SkillsWindow._actionSelectSkillBadge,
            selectSkillSlot: SkillsWindow._actionSelectSkillSlot,
            learnSlot: SkillsWindow._actionLearnSlot,
            unlearnSlot: SkillsWindow._actionUnlearnSlot,
            removePendingLearn: SkillsWindow._actionRemovePendingLearn,
            removePendingUnlearn: SkillsWindow._actionRemovePendingUnlearn
        }
    });

    static PARTS = {
        body: {
            template: 'modules/coffee-pub-artificer/templates/window-skills.hbs'
        }
    };

    constructor(options = {}) {
        const opts = foundry.utils.mergeObject({}, options);
        opts.id = opts.id ?? `${SKILLS_APP_ID}-${foundry.utils.randomID().slice(0, 8)}`;
        super(opts);
        /** @type {Actor|null} */
        this._actor = null;
        /** @type {string|null} selected skill id (badge or slot) */
        this._selectedSkillId = null;
        /** @type {number|null} selected slot index (null = viewing skill details) */
        this._selectedSlotIndex = null;
        /** @type {string[]} pending learn slotIDs */
        this._pendingLearn = [];
        /** @type {string[]} pending unlearn slotIDs */
        this._pendingUnlearn = [];
    }

    _getActor() {
        if (game.user?.isGM && canvas.ready) {
            const controlled = canvas.tokens?.controlled ?? [];
            const token = controlled[0];
            if (token?.actor) return token.actor;
        }
        return game.user?.character ?? null;
    }

    async _prepareContext(options = {}) {
        const base = await super._prepareContext?.(options) ?? {};
        return foundry.utils.mergeObject(base, await this.getData(options));
    }

    async getData(options = {}) {
        const actor = this._getActor();
        this._actor = actor;

        const actorName = actor?.name ?? null;
        const actorImg = actor?.img ?? null;
        const [actorPoints, learnedSlots] = actor
            ? await Promise.all([
                _skillManager.getPointsRemaining(actor),
                _skillManager.getLearnedSlots(actor)
            ])
            : [0, []];

        const { skills = [] } = await loadSkillsDetails();

        // Revoke learned slots for skills where kit is now missing
        let actorPointsRev = actorPoints;
        let learnedSlotsRev = [...learnedSlots];
        if (actor) {
            for (const skill of skills) {
                if (!skill.skillEnabled) continue;
                const kit = skill.skillKit ?? '';
                if (!kit) continue;
                const hasKit = actorHasItemNamed(actor, kit);
                if (hasKit) continue;
                const slotIds = (skill.slots ?? []).map((s) => s.slotID).filter(Boolean);
                const toRevoke = slotIds.filter((id) => learnedSlotsRev.includes(id));
                if (toRevoke.length > 0) {
                    await _skillManager.revokeSlots(actor, toRevoke);
                    this._pendingLearn = this._pendingLearn.filter((id) => !toRevoke.includes(id));
                    this._pendingUnlearn = this._pendingUnlearn.filter((id) => !toRevoke.includes(id));
                    const [p, l] = await Promise.all([
                        _skillManager.getPointsRemaining(actor),
                        _skillManager.getLearnedSlots(actor)
                    ]);
                    actorPointsRev = p;
                    learnedSlotsRev = l;
                }
            }
        }

        const actorPointsFinal = actorPointsRev;
        const learnedSlotsFinal = learnedSlotsRev;

        // Build slot lookup for cart and effective state
        const slotById = /** @type {Map<string, { name: string, cost: number }>} */ (new Map());
        for (const skill of skills) {
            for (const s of skill.slots ?? []) {
                const id = s.slotID ?? '';
                if (id) slotById.set(id, { name: s.name ?? `Slot ${s.index ?? ''}`, cost: s.cost ?? 0 });
            }
        }

        const effectiveLearned = (slotID) => {
            const learned = learnedSlotsFinal.includes(slotID);
            const pendingUnl = this._pendingUnlearn.includes(slotID);
            const pendingLn = this._pendingLearn.includes(slotID);
            return (learned && !pendingUnl) || pendingLn;
        };

        const pendingLearnCost = this._pendingLearn.reduce((sum, id) => sum + (slotById.get(id)?.cost ?? 0), 0);
        const pendingUnlearnRefund = this._pendingUnlearn.reduce((sum, id) => sum + (slotById.get(id)?.cost ?? 0), 0);
        const effectivePoints = actorPointsFinal + pendingUnlearnRefund - pendingLearnCost;

        const skillPaths = skills
            .filter((skill) => skill.skillEnabled === true)
            .map((skill) => {
            const rawSlots = (skill.slots ?? []).slice(0, 10);
            const MAX_SLOTS = 10;
            const filledSlots = rawSlots.map((s, idx) => ({
                ...s,
                slotIndex: idx,
                empty: false,
                displayValue: s.cost ?? 0,
                slotApplied: effectiveLearned(s.slotID ?? ''),
                slotMinSkillLevel: s.slotMinSkillLevel ?? 0,
                slotMaxSkillLevel: s.slotMaxSkillLevel ?? 0,
                slotSkillLearnedBackgroundColor: s.slotSkillLearnedBackgroundColor ?? 'rgba(47, 63, 56, 0.4)',
                iconClass: s.icon ? (s.icon.startsWith('fa-') ? `fa-solid ${s.icon}` : `fa-solid fa-${s.icon}`) : null,
                selected: this._selectedSkillId === skill.id && this._selectedSlotIndex === idx
            }));
            const emptyCount = MAX_SLOTS - filledSlots.length;
            const emptySlots = Array.from({ length: emptyCount }, (_, i) => ({
                empty: true,
                slotIndex: filledSlots.length + i
            }));
            const slots = [...filledSlots, ...emptySlots];

            const totalCost = rawSlots.reduce((sum, s) => sum + (s.cost ?? 0), 0);
            const learnedPoints = rawSlots
                .filter((s) => effectiveLearned(s.slotID ?? ''))
                .reduce((sum, s) => sum + (s.cost ?? 0), 0);

            const skillKit = skill.skillKit ?? '';
            const hasKit = skillKit ? actorHasItemNamed(actor, skillKit) : true;
            return {
                id: skill.id,
                name: skill.name,
                img: skill.img,
                description: skill.description ?? '',
                skillEnabled: true,
                skillPanelColor: skill.skillPanelColor ?? 'rgba(0, 0, 0, 0.2)',
                skillBadgeColor: skill.skillBadgeColor ?? 'rgba(0, 0, 0, 0.2)',
                skillKit,
                hasKit,
                slots,
                totalCost,
                totalCostDots: Array.from({ length: totalCost }, (_, i) => ({ learned: i < learnedPoints })),
                badgeSelected: this._selectedSkillId === skill.id && this._selectedSlotIndex === null
            };
        });

        let selectedDetail = null;
        const selSkill = skillPaths.find((p) => p.id === this._selectedSkillId);
        if (selSkill) {
            if (this._selectedSlotIndex != null) {
                const slot = selSkill.slots?.[this._selectedSlotIndex];
                if (slot && !slot.empty) {
                    const slotID = slot.slotID ?? '';
                    const cost = slot.cost ?? 0;
                    const isEffectiveLearned = effectiveLearned(slotID);
                    const prereqSlotId = selSkill.slots?.find((s) => s.name === slot.requirement)?.slotID ?? '';
                    const isKitRequirement = (slot.requirement ?? '') === (selSkill.skillKit ?? '');
                    let prereqMet = !(slot.requirement ?? '');
                    if (!prereqMet) {
                        if (isKitRequirement) prereqMet = selSkill.hasKit;
                        else if (prereqSlotId) prereqMet = effectiveLearned(prereqSlotId);
                        else prereqMet = actorHasItemNamed(actor, slot.requirement);
                    }
                    const canAfford = effectivePoints >= cost;
                    const kitMissing = !selSkill.hasKit && !!selSkill.skillKit;
                    const canLearn = !kitMissing && !isEffectiveLearned && prereqMet && canAfford;
                    let canUnlearn = false;
                    let unlearnBlockedReason = '';
                    if (isEffectiveLearned) {
                        const dependents = await _skillManager.getDependentSlotIds(slotID);
                        const stillLearned = dependents.filter((d) => effectiveLearned(d));
                        if (stillLearned.length > 0) {
                            canUnlearn = false;
                            const names = stillLearned.map((d) => slotById.get(d)?.name ?? d).join(', ');
                            unlearnBlockedReason = `This can't be unlearned until ${names} are unlearned first.`;
                        } else {
                            canUnlearn = true;
                        }
                    }
                    selectedDetail = {
                        type: 'slot',
                        skill: selSkill,
                        slot,
                        requirementLabel: slot.requirement ? slot.requirement : 'none',
                        costDisplay: cost ?? 0,
                        kitMissing: !selSkill.hasKit && !!selSkill.skillKit,
                        canLearn,
                        showUnlearn: isEffectiveLearned,
                        canUnlearn,
                        unlearnBlockedReason
                    };
                } else {
                    selectedDetail = { type: 'skill', skill: selSkill, slot: null };
                }
            } else {
                selectedDetail = { type: 'skill', skill: selSkill, slot: null };
            }
        }

        const pendingLearnItems = this._pendingLearn.map((id) => {
            const info = slotById.get(id) ?? { name: id, cost: 0 };
            return { slotID: id, name: info.name, cost: info.cost, pointsDelta: -info.cost, isUnlearn: false };
        });
        const pendingUnlearnItems = this._pendingUnlearn.map((id) => {
            const info = slotById.get(id) ?? { name: id, cost: 0 };
            return { slotID: id, name: info.name, cost: info.cost, pointsDelta: info.cost, isUnlearn: true };
        });
        const skillChanges = [...pendingLearnItems, ...pendingUnlearnItems];
        const hasPendingChanges = skillChanges.length > 0;

        return {
            appId: this.id,
            actorName,
            actorImg,
            availablePoints: effectivePoints,
            skillPaths,
            selectedDetail,
            skillChanges,
            hasPendingChanges
        };
    }

    _getSkillsRoot() {
        const byId = document.getElementById(this.id);
        if (byId) return byId;
        return document.querySelector('.skills-window-root') ?? this.element ?? null;
    }

    static _actionReset(event, target) {
        const w = _currentSkillsWindowRef;
        if (!w) return;
        event?.preventDefault?.();
        w._pendingLearn = [];
        w._pendingUnlearn = [];
        w._selectedSkillId = null;
        w._selectedSlotIndex = null;
        w.render();
    }

    static async _actionApply(event, target) {
        const w = _currentSkillsWindowRef;
        if (!w || !w._actor) return;
        event?.preventDefault?.();
        if (w._pendingLearn.length === 0 && w._pendingUnlearn.length === 0) return;
        const actor = w._actor;
        for (const slotID of w._pendingUnlearn) {
            const result = await _skillManager.unlearnSlot(actor, slotID);
            if (!result.ok) ui.notifications?.warn?.(result.reason ?? 'Could not unlearn slot');
        }
        const sortedLearn = await _sortByPrereqs(w._pendingLearn);
        for (const slotID of sortedLearn) {
            const result = await _skillManager.learnSlot(actor, slotID);
            if (!result.ok) ui.notifications?.warn?.(result.reason ?? 'Could not learn slot');
        }
        w._pendingLearn = [];
        w._pendingUnlearn = [];
        w.render();
    }

    static _actionLearnSlot(event, target) {
        const w = _currentSkillsWindowRef;
        if (!w) return;
        event?.preventDefault?.();
        const slotID = target?.dataset?.slotId ?? '';
        if (!slotID) return;
        if (w._pendingLearn.includes(slotID)) return;
        w._pendingUnlearn = w._pendingUnlearn.filter((id) => id !== slotID);
        w._pendingLearn.push(slotID);
        w.render();
    }

    static _actionUnlearnSlot(event, target) {
        const w = _currentSkillsWindowRef;
        if (!w) return;
        event?.preventDefault?.();
        const slotID = target?.dataset?.slotId ?? '';
        if (!slotID) return;
        const btn = target?.closest?.('[data-action="unlearnSlot"]');
        if (btn?.hasAttribute?.('disabled')) return;
        if (w._pendingUnlearn.includes(slotID)) return;
        w._pendingLearn = w._pendingLearn.filter((id) => id !== slotID);
        w._pendingUnlearn.push(slotID);
        w.render();
    }

    static _actionRemovePendingLearn(event, target) {
        const w = _currentSkillsWindowRef;
        if (!w) return;
        event?.preventDefault?.();
        const slotID = target?.dataset?.slotId ?? '';
        if (!slotID) return;
        w._pendingLearn = w._pendingLearn.filter((id) => id !== slotID);
        w.render();
    }

    static _actionRemovePendingUnlearn(event, target) {
        const w = _currentSkillsWindowRef;
        if (!w) return;
        event?.preventDefault?.();
        const slotID = target?.dataset?.slotId ?? '';
        if (!slotID) return;
        w._pendingUnlearn = w._pendingUnlearn.filter((id) => id !== slotID);
        w.render();
    }

    static _actionSelectSkillBadge(event, target) {
        const w = _currentSkillsWindowRef;
        if (!w) return;
        event?.preventDefault?.();
        const badge = target?.closest?.('.skills-panel-badge[data-skill]');
        if (!badge) return;
        const skillId = badge.dataset?.skill;
        if (!skillId) return;
        w._selectedSkillId = skillId;
        w._selectedSlotIndex = null;
        w.render();
    }

    static _actionSelectSkillSlot(event, target) {
        const w = _currentSkillsWindowRef;
        if (!w) return;
        event?.preventDefault?.();
        const slot = target?.closest?.('.skills-slot');
        if (!slot) return;
        const skillId = slot.dataset?.skill;
        const idx = slot.dataset?.slotIndex;
        if (skillId == null || idx == null) return;
        const idxNum = parseInt(idx, 10);
        if (isNaN(idxNum)) return;
        w._selectedSkillId = skillId;
        w._selectedSlotIndex = idxNum;
        w.render();
    }

    _attachDelegationOnce() {
        _currentSkillsWindowRef = this;
        if (_skillsDelegationAttached) return;
        _skillsDelegationAttached = true;

        document.addEventListener('click', (e) => {
            const w = _currentSkillsWindowRef;
            if (!w) return;
            const root = w._getSkillsRoot();
            if (!root?.contains?.(e.target)) return;

            const resetBtn = e.target?.closest?.('[data-action="reset"]');
            if (resetBtn) {
                SkillsWindow._actionReset.call(null, e, resetBtn);
                return;
            }
            const applyBtn = e.target?.closest?.('[data-action="apply"]');
            if (applyBtn) {
                SkillsWindow._actionApply.call(null, e, applyBtn);
                return;
            }
            const badge = e.target?.closest?.('.skills-panel-badge[data-action="selectSkillBadge"]');
            if (badge) {
                e.preventDefault?.();
                SkillsWindow._actionSelectSkillBadge.call(null, e, badge);
                return;
            }
            const slot = e.target?.closest?.('.skills-slot');
            if (slot) {
                e.preventDefault?.();
                SkillsWindow._actionSelectSkillSlot.call(null, e, slot);
                return;
            }
            const learnBtn = e.target?.closest?.('[data-action="learnSlot"]');
            if (learnBtn) {
                e.preventDefault?.();
                SkillsWindow._actionLearnSlot.call(null, e, learnBtn);
                return;
            }
            const unlearnBtn = e.target?.closest?.('[data-action="unlearnSlot"]');
            if (unlearnBtn) {
                e.preventDefault?.();
                SkillsWindow._actionUnlearnSlot.call(null, e, unlearnBtn);
                return;
            }
            const removeLearnBtn = e.target?.closest?.('[data-action="removePendingLearn"]');
            if (removeLearnBtn) {
                e.preventDefault?.();
                SkillsWindow._actionRemovePendingLearn.call(null, e, removeLearnBtn);
                return;
            }
            const removeUnlearnBtn = e.target?.closest?.('[data-action="removePendingUnlearn"]');
            if (removeUnlearnBtn) {
                e.preventDefault?.();
                SkillsWindow._actionRemovePendingUnlearn.call(null, e, removeUnlearnBtn);
                return;
            }
        });
    }

    /**
     * ApplicationV2 PARTS may not call activateListeners; attach delegation on first render.
     */
    async _onFirstRender(_context, options) {
        await super._onFirstRender?.(_context, options);
        this._attachDelegationOnce();
    }

    activateListeners(html) {
        super.activateListeners(html);
        this._attachDelegationOnce();
    }
}
