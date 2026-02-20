// ==================================================================
// ===== ARTIFICER SKILLS WINDOW ====================================
// ==================================================================
// Stacked horizontal skill panels (left) + details pane (right).
// Same header and button bar pattern as window-crafting.
// Architecture placeholder: skill point investment and unlock logic TBD.

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import { CRAFTING_SKILLS } from './schema-recipes.js';

const SKILLS_APP_ID = 'artificer-skills';

/** Default skill path config: id, name, Font Awesome icon class */
const SKILL_PATH_CONFIG = [
    { id: CRAFTING_SKILLS.HERBALISM, name: 'Herbalism', icon: 'fa-solid fa-leaf' },
    { id: CRAFTING_SKILLS.METALLURGY, name: 'Metallurgy', icon: 'fa-solid fa-hammer' },
    { id: CRAFTING_SKILLS.ARTIFICE, name: 'Artifice', icon: 'fa-solid fa-gem' },
    { id: CRAFTING_SKILLS.ALCHEMY, name: 'Alchemy', icon: 'fa-solid fa-flask' },
    { id: CRAFTING_SKILLS.MONSTER_HANDLING, name: 'Monster Handling', icon: 'fa-solid fa-paw' }
];

/** Placeholder: build stub slots for a skill path (unlocked/locked for UI demo) */
function buildPlaceholderSlots(skillId, count = 6) {
    const slots = [];
    for (let i = 0; i < count; i++) {
        slots.push({
            name: `${skillId} ${i + 1}`,
            icon: 'fa-solid fa-circle',
            unlocked: i < 2,
            locked: i >= 2,
            selected: false,
            requirement: i === 0 ? null : `Requires ${skillId} ${i}`,
            cost: 1
        });
    }
    return slots;
}

let _skillsDelegationAttached = false;
let _currentSkillsWindowRef = null;

/**
 * Artificer Skills Window - Invest skill points, unlock levels.
 * Layout: header (avatar, title, points) | body [ stacked skill panels | details ] | Reset / Apply.
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
        /** @type {string|null} skillId */
        this._selectedSkillId = null;
        /** @type {number|null} slot index */
        this._selectedSlotIndex = null;
        /** Placeholder: available points to spend (TBD: read from actor flags) */
        this._availablePoints = 3;
    }

    /** Resolve actor: same pattern as crafting (GM → controlled token, else player character) */
    _getActor() {
        if (game.user?.isGM && canvas.ready) {
            const controlled = canvas.tokens?.controlled ?? [];
            const token = controlled[0];
            if (token?.actor) return token.actor;
        }
        const player = game.user;
        const char = player?.character;
        return char ?? null;
    }

    getData(options = {}) {
        const actor = this._getActor();
        this._actor = actor;

        const actorName = actor?.name ?? null;
        const actorImg = actor?.img ?? null;
        const availablePoints = this._availablePoints;

        const skillPaths = SKILL_PATH_CONFIG.map((cfg) => {
            const slots = buildPlaceholderSlots(cfg.id);
            const selId = this._selectedSkillId;
            const selIdx = this._selectedSlotIndex;
            if (selId === cfg.id && selIdx != null && slots[selIdx]) {
                slots[selIdx] = { ...slots[selIdx], selected: true };
            }
            return {
                id: cfg.id,
                name: cfg.name,
                icon: cfg.icon,
                slots
            };
        });

        let selectedSkill = null;
        if (this._selectedSkillId != null && this._selectedSlotIndex != null) {
            const path = skillPaths.find((p) => p.id === this._selectedSkillId);
            const slot = path?.slots?.[this._selectedSlotIndex];
            if (slot) selectedSkill = slot;
        }

        return {
            appId: this.id,
            actorName,
            actorImg,
            availablePoints,
            skillPaths,
            selectedSkill
        };
    }

    _getSkillsRoot() {
        return document.querySelector('.skills-window-root') ?? this.element ?? null;
    }

    static _actionReset(event, target) {
        const w = _currentSkillsWindowRef;
        if (!w) return;
        event?.preventDefault?.();
        w._availablePoints = 3;
        w._selectedSkillId = null;
        w._selectedSlotIndex = null;
        w.render();
    }

    static _actionApply(event, target) {
        const w = _currentSkillsWindowRef;
        if (!w) return;
        event?.preventDefault?.();
        // Placeholder: persist to actor flags TBD
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
            const slot = e.target?.closest?.('.skills-slot[data-action="selectSkillSlot"]');
            if (slot) {
                SkillsWindow._actionSelectSkillSlot.call(null, e, slot);
                return;
            }
        });
    }

    activateListeners(html) {
        super.activateListeners(html);
        this._attachDelegationOnce();
    }
}
