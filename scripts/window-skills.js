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
            selectSkillSlot: SkillsWindow._actionSelectSkillSlot
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
        const [availablePoints, learnedSlots] = actor
            ? await Promise.all([
                _skillManager.getPointsRemaining(actor),
                _skillManager.getLearnedSlots(actor)
            ])
            : [0, []];

        const { skills = [] } = await loadSkillsDetails();

        const skillPaths = skills.map((skill) => {
            const rawSlots = (skill.slots ?? []).slice(0, 10);
            const slots = rawSlots.map((s, idx) => ({
                ...s,
                slotIndex: idx,
                displayValue: s.cost ?? 0,
                slotApplied: learnedSlots.includes(s.slotID ?? ''),
                slotMinSkillLevel: s.slotMinSkillLevel ?? 0,
                slotMaxSkillLevel: s.slotMaxSkillLevel ?? 0,
                slotBackgroundColor: s.slotBackgroundColor ?? s.backgroundColor ?? 'rgba(47, 63, 56, 0.4)',
                slotBorderColor: s.slotBorderColor ?? s.borderColor ?? 'rgba(47, 63, 56, 0.6)',
                slotSkillLearnedBackgroundColor: s.slotSkillLearnedBackgroundColor ?? 'rgba(47, 63, 56, 0.4)',
                iconClass: s.icon ? (s.icon.startsWith('fa-') ? `fa-solid ${s.icon}` : `fa-solid fa-${s.icon}`) : null,
                selected: this._selectedSkillId === skill.id && this._selectedSlotIndex === idx
            }));

            const totalCost = rawSlots.reduce((sum, s) => sum + (s.cost ?? 0), 0);

            return {
                id: skill.id,
                name: skill.name,
                img: skill.img,
                description: skill.description ?? '',
                skillEnabled: skill.skillEnabled ?? false,
                skillPanelColor: skill.skillPanelColor ?? 'rgba(0, 0, 0, 0.2)',
                skillBadgeColor: skill.skillBadgeColor ?? 'rgba(0, 0, 0, 0.2)',
                skillKit: skill.skillKit ?? '',
                slots,
                totalCost,
                totalCostDots: Array.from({ length: totalCost }),
                badgeSelected: this._selectedSkillId === skill.id && this._selectedSlotIndex === null
            };
        });

        let selectedDetail = null;
        const selSkill = skillPaths.find((p) => p.id === this._selectedSkillId);
        if (selSkill) {
            if (this._selectedSlotIndex != null) {
                const slot = selSkill.slots?.[this._selectedSlotIndex];
                if (slot) selectedDetail = { type: 'slot', skill: selSkill, slot };
            } else {
                selectedDetail = { type: 'skill', skill: selSkill, slot: null };
            }
        }

        return {
            appId: this.id,
            actorName,
            actorImg,
            availablePoints,
            skillPaths,
            selectedDetail
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
        w._selectedSkillId = null;
        w._selectedSlotIndex = null;
        w.render();
    }

    static _actionApply(event, target) {
        const w = _currentSkillsWindowRef;
        if (!w) return;
        event?.preventDefault?.();
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
