// ==================================================================
// ===== ARTIFICER SKILLS WINDOW ====================================
// ==================================================================
// Stacked horizontal skill panels (left) + details pane (right).
// Data driven by resources/skills-details.json.
// Click badge → skill details. Click perk → perk details.

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

import { MODULE } from './const.js';
import { SkillManager } from './manager-skills.js';

const SKILLS_APP_ID = 'artificer-skills';
const SKILLS_DETAILS_URL = 'modules/coffee-pub-artificer/resources/skills-details.json';
const SKILLS_RULES_URL = 'modules/coffee-pub-artificer/resources/skills-rules.json';

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
let _skillsRulesCache = null;

/**
 * Load skills rules from JSON. Caches result.
 * @returns {Promise<{ skills: Record<string, { perks: Record<string, { benefits?: Array<{ title?: string, description?: string }> }> } }>}
 */
async function loadSkillsRules() {
    if (_skillsRulesCache) return _skillsRulesCache;
    try {
        const res = await fetch(SKILLS_RULES_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        _skillsRulesCache = data;
        return data;
    } catch (e) {
        console.warn('Artificer Skills: Could not load skills-rules.json', e);
        _skillsRulesCache = { schemaVersion: 1, skills: {} };
        return _skillsRulesCache;
    }
}

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
 * Sort perkIDs by prerequisite order (prereqs first).
 * @param {string[]} perkIDs - Perk IDs to sort
 * @returns {Promise<string[]>}
 */
async function _sortByPrereqs(perkIDs) {
    const { skills = [] } = await loadSkillsDetails();
    const perkById = /** @type {Map<string, { requirement: string, skillId: string }>} */ (new Map());
    for (const skill of skills) {
        for (const p of skill.perks ?? []) {
            const id = p.perkID ?? '';
            if (id) perkById.set(id, { requirement: p.requirement ?? '', skillId: skill.id });
        }
    }
    const prereqId = (perkID) => {
        const info = perkById.get(perkID);
        if (!info?.requirement) return null;
        const skill = skills.find((sk) => sk.id === info.skillId);
        const perk = (skill?.perks ?? []).find((p) => p.name === info.requirement);
        return perk?.perkID ?? null;
    };
    const result = [];
    const remaining = new Set(perkIDs);
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
 * Artificer Skills Window - Skill and perk details driven by JSON.
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
            selectSkillPerk: SkillsWindow._actionSelectSkillPerk,
            learnPerk: SkillsWindow._actionLearnPerk,
            unlearnPerk: SkillsWindow._actionUnlearnPerk,
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
        /** @type {string|null} selected skill id (badge or perk) */
        this._selectedSkillId = null;
        /** @type {number|null} selected perk index (null = viewing skill details) */
        this._selectedPerkIndex = null;
        /** @type {string[]} pending learn perkIDs */
        this._pendingLearn = [];
        /** @type {string[]} pending unlearn perkIDs */
        this._pendingUnlearn = [];
        /** @type {boolean} when true, hide skills whose required kit is missing */
        this._hideUnavailable = game.settings.get(MODULE.ID, 'skillsWindowHideUnavailable') ?? false;
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
        const [actorPoints, learnedPerks] = actor
            ? await Promise.all([
                _skillManager.getPointsRemaining(actor),
                _skillManager.getLearnedPerks(actor)
            ])
            : [0, []];

        const { skills = [] } = await loadSkillsDetails();

        // Revoke learned perks for skills where kit is now missing
        let actorPointsRev = actorPoints;
        let learnedPerksRev = [...learnedPerks];
        if (actor) {
            for (const skill of skills) {
                if (!skill.skillEnabled) continue;
                const kit = skill.skillKit ?? '';
                if (!kit) continue;
                const hasKit = actorHasItemNamed(actor, kit);
                if (hasKit) continue;
                const perkIds = (skill.perks ?? []).map((p) => p.perkID).filter(Boolean);
                const toRevoke = perkIds.filter((id) => learnedPerksRev.includes(id));
                if (toRevoke.length > 0) {
                    await _skillManager.revokePerks(actor, toRevoke);
                    this._pendingLearn = this._pendingLearn.filter((id) => !toRevoke.includes(id));
                    this._pendingUnlearn = this._pendingUnlearn.filter((id) => !toRevoke.includes(id));
                    const [p, l] = await Promise.all([
                        _skillManager.getPointsRemaining(actor),
                        _skillManager.getLearnedPerks(actor)
                    ]);
                    actorPointsRev = p;
                    learnedPerksRev = l;
                }
            }
        }

        const actorPointsFinal = actorPointsRev;
        const learnedPerksFinal = learnedPerksRev;

        // Build perk lookup for cart and effective state
        const perkById = /** @type {Map<string, { name: string, cost: number }>} */ (new Map());
        for (const skill of skills) {
            for (const p of skill.perks ?? []) {
                const id = p.perkID ?? '';
                if (id) perkById.set(id, { name: p.name ?? `Perk ${p.index ?? ''}`, cost: p.cost ?? 0 });
            }
        }

        const effectiveLearned = (perkID) => {
            const learned = learnedPerksFinal.includes(perkID);
            const pendingUnl = this._pendingUnlearn.includes(perkID);
            const pendingLn = this._pendingLearn.includes(perkID);
            return (learned && !pendingUnl) || pendingLn;
        };

        const pendingLearnCost = this._pendingLearn.reduce((sum, id) => sum + (perkById.get(id)?.cost ?? 0), 0);
        const pendingUnlearnRefund = this._pendingUnlearn.reduce((sum, id) => sum + (perkById.get(id)?.cost ?? 0), 0);
        const effectivePoints = actorPointsFinal + pendingUnlearnRefund - pendingLearnCost;

        const skillPaths = skills
            .filter((skill) => skill.skillEnabled === true)
            .map((skill) => {
            const rawPerks = (skill.perks ?? []).slice(0, 10);
            const MAX_PERKS = 10;
            const filledPerks = rawPerks.map((p, idx) => ({
                ...p,
                perkIndex: idx,
                empty: false,
                displayValue: p.cost ?? 0,
                perkApplied: effectiveLearned(p.perkID ?? ''),
                perkMinSkillLevel: p.perkMinSkillLevel ?? 0,
                perkMaxSkillLevel: p.perkMaxSkillLevel ?? 0,
                perkLearnedBackgroundColor: p.perkLearnedBackgroundColor ?? 'rgba(47, 63, 56, 0.4)',
                iconClass: p.icon ? (p.icon.startsWith('fa-') ? `fa-solid ${p.icon}` : `fa-solid fa-${p.icon}`) : null,
                selected: this._selectedSkillId === skill.id && this._selectedPerkIndex === idx
            }));
            const emptyCount = MAX_PERKS - filledPerks.length;
            const emptyPerks = Array.from({ length: emptyCount }, (_, i) => ({
                empty: true,
                perkIndex: filledPerks.length + i
            }));
            const perks = [...filledPerks, ...emptyPerks];

            const totalCost = rawPerks.reduce((sum, p) => sum + (p.cost ?? 0), 0);
            const learnedPoints = rawPerks
                .filter((p) => effectiveLearned(p.perkID ?? ''))
                .reduce((sum, p) => sum + (p.cost ?? 0), 0);

            const skillKit = skill.skillKit ?? '';
            const hasKit = skillKit
                ? (actor ? actorHasItemNamed(actor, skillKit) : false)
                : true;
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
                perks,
                totalCost,
                totalCostDots: Array.from({ length: totalCost }, (_, i) => ({ learned: i < learnedPoints })),
                badgeSelected: this._selectedSkillId === skill.id && this._selectedPerkIndex === null
            };
        });

        let selectedDetail = null;
        const selSkill = skillPaths.find((p) => p.id === this._selectedSkillId);
        if (selSkill) {
            if (this._selectedPerkIndex != null) {
                const perk = selSkill.perks?.[this._selectedPerkIndex];
                if (perk && !perk.empty) {
                    const perkID = perk.perkID ?? '';
                    const cost = perk.cost ?? 0;
                    const isEffectiveLearned = effectiveLearned(perkID);
                    const prereqPerkId = selSkill.perks?.find((p) => p.name === perk.requirement)?.perkID ?? '';
                    const isKitRequirement = (perk.requirement ?? '') === (selSkill.skillKit ?? '');
                    let prereqMet = !(perk.requirement ?? '');
                    if (!prereqMet) {
                        if (isKitRequirement) prereqMet = selSkill.hasKit;
                        else if (prereqPerkId) prereqMet = effectiveLearned(prereqPerkId);
                        else prereqMet = actorHasItemNamed(actor, perk.requirement);
                    }
                    const canAfford = effectivePoints >= cost;
                    const kitMissing = !selSkill.hasKit && !!selSkill.skillKit;
                    const canLearn = !kitMissing && !isEffectiveLearned && prereqMet && canAfford;
                    let canUnlearn = false;
                    let unlearnBlockedReason = '';
                    if (isEffectiveLearned) {
                        const dependents = await _skillManager.getDependentPerkIds(perkID);
                        const stillLearned = dependents.filter((d) => effectiveLearned(d));
                        if (stillLearned.length > 0) {
                            canUnlearn = false;
                            const names = stillLearned.map((d) => perkById.get(d)?.name ?? d).join(', ');
                            unlearnBlockedReason = `This can't be unlearned until ${names} are unlearned first.`;
                        } else {
                            canUnlearn = true;
                        }
                    }
                    const rulesData = await loadSkillsRules();
                    const skillRules = rulesData?.skills?.[selSkill.id];
                    const perkRules = skillRules?.perks?.[perkID];
                    const benefits = Array.isArray(perkRules?.benefits)
                        ? perkRules.benefits.map((b) => ({ title: b.title ?? '', description: b.description ?? '' }))
                        : [];
                    selectedDetail = {
                        type: 'perk',
                        skill: selSkill,
                        perk,
                        requirementLabel: perk.requirement ? perk.requirement : 'none',
                        costDisplay: cost ?? 0,
                        kitMissing: !selSkill.hasKit && !!selSkill.skillKit,
                        canLearn,
                        showUnlearn: isEffectiveLearned,
                        canUnlearn,
                        unlearnBlockedReason,
                        benefits
                    };
                } else {
                    selectedDetail = { type: 'skill', skill: selSkill, perk: null };
                }
            } else {
                selectedDetail = { type: 'skill', skill: selSkill, perk: null };
            }
        }

        const pendingLearnItems = this._pendingLearn.map((id) => {
            const info = perkById.get(id) ?? { name: id, cost: 0 };
            return { perkID: id, name: info.name, cost: info.cost, pointsDelta: -info.cost, isUnlearn: false };
        });
        const pendingUnlearnItems = this._pendingUnlearn.map((id) => {
            const info = perkById.get(id) ?? { name: id, cost: 0 };
            return { perkID: id, name: info.name, cost: info.cost, pointsDelta: info.cost, isUnlearn: true };
        });
        const skillChanges = [...pendingLearnItems, ...pendingUnlearnItems];
        const hasPendingChanges = skillChanges.length > 0;

        const visibleSkillPaths = this._hideUnavailable
            ? skillPaths.filter((p) => p.hasKit || !p.skillKit)
            : skillPaths;
        const selectedStillVisible = !selectedDetail?.skill || visibleSkillPaths.some((p) => p.id === selectedDetail.skill.id);
        const finalSelectedDetail = selectedStillVisible ? selectedDetail : null;
        if (!selectedStillVisible && selectedDetail?.skill) {
            this._selectedSkillId = null;
            this._selectedPerkIndex = null;
        }

        return {
            appId: this.id,
            actorName,
            actorImg,
            availablePoints: effectivePoints,
            canEditPoints: !!actor && !!game.user?.isGM,
            skillPaths: visibleSkillPaths,
            selectedDetail: finalSelectedDetail,
            skillChanges,
            hasPendingChanges,
            hideUnavailable: this._hideUnavailable,
            toggleHideUnavailableId: `${this.id}-hide-unavailable`
        };
    }

    _getSkillsRoot() {
        const byId = document.getElementById(this.id);
        if (byId) return byId;
        return document.querySelector('.skills-window-root') ?? this.element ?? null;
    }

    /**
     * Save scroll positions of scrollable panes so we can restore after render (prevents jumping to top on skill/perk click).
     * @returns {{ panels: number, details: number, windowContent: number }}
     */
    _saveScrollPositions() {
        const root = this._getSkillsRoot();
        const panels = root?.querySelector?.('.skills-window-panels');
        const details = root?.querySelector?.('.skills-details-content');
        const windowContent = this.element?.closest?.('.window-content');
        return {
            panels: panels ? panels.scrollTop : 0,
            details: details ? details.scrollTop : 0,
            windowContent: windowContent ? windowContent.scrollTop : 0
        };
    }

    /**
     * Restore scroll positions after render. Call in requestAnimationFrame or after await render() so DOM is ready.
     * @param {{ panels: number, details: number, windowContent: number }} saved
     */
    _restoreScrollPositions(saved) {
        if (!saved) return;
        const root = this._getSkillsRoot();
        const panels = root?.querySelector?.('.skills-window-panels');
        const details = root?.querySelector?.('.skills-details-content');
        const windowContent = this.element?.closest?.('.window-content');
        if (panels && saved.panels) panels.scrollTop = saved.panels;
        if (details && saved.details) details.scrollTop = saved.details;
        if (windowContent && saved.windowContent) windowContent.scrollTop = saved.windowContent;
    }

    async render(force = false) {
        const scrolls = this._saveScrollPositions();
        const result = await super.render(force);
        requestAnimationFrame(() => {
            this._restoreScrollPositions(scrolls);
            this._attachHideUnavailableListener();
        });
        return result;
    }

    /**
     * Attach change listener for Hide Unavailable checkbox. Re-attach after each render so the
     * checkbox (which is re-created when the template re-renders) is in the element we listen to.
     */
    _attachHideUnavailableListener() {
        const root = this._getSkillsRoot();
        if (!root) return;
        if (this._hideUnavailableChangeEl) {
            this._hideUnavailableChangeEl.removeEventListener('change', this._hideUnavailableChangeBound);
            this._hideUnavailableChangeEl = null;
        }
        if (!this._hideUnavailableChangeBound) {
            this._hideUnavailableChangeBound = (e) => {
                if (e.target?.id === `${this.id}-hide-unavailable`) {
                    this._hideUnavailable = !!e.target.checked;
                    game.settings.set(MODULE.ID, 'skillsWindowHideUnavailable', this._hideUnavailable);
                    this.render();
                }
            };
        }
        root.addEventListener('change', this._hideUnavailableChangeBound);
        this._hideUnavailableChangeEl = root;
    }

    static _actionReset(event, target) {
        const w = _currentSkillsWindowRef;
        if (!w) return;
        event?.preventDefault?.();
        w._pendingLearn = [];
        w._pendingUnlearn = [];
        w._selectedSkillId = null;
        w._selectedPerkIndex = null;
        w.render();
    }

    static async _actionApply(event, target) {
        const w = _currentSkillsWindowRef;
        if (!w || !w._actor) return;
        event?.preventDefault?.();
        BlacksmithUtils.playSound(BlacksmithConstants.SOUNDPOP01, 0.5);
        if (w._pendingLearn.length === 0 && w._pendingUnlearn.length === 0) return;
        const actor = w._actor;
        for (const perkID of w._pendingUnlearn) {
            const result = await _skillManager.unlearnPerk(actor, perkID);
            if (!result.ok) ui.notifications?.warn?.(result.reason ?? 'Could not unlearn perk');
        }
        const sortedLearn = await _sortByPrereqs(w._pendingLearn);
        for (const perkID of sortedLearn) {
            const result = await _skillManager.learnPerk(actor, perkID);
            if (!result.ok) ui.notifications?.warn?.(result.reason ?? 'Could not learn perk');
        }
        w._pendingLearn = [];
        w._pendingUnlearn = [];
        w.render();
    }

    static _actionLearnPerk(event, target) {
        const w = _currentSkillsWindowRef;
        if (!w) return;
        event?.preventDefault?.();
        BlacksmithUtils.playSound(BlacksmithConstants.SOUNDPOP01, 0.5);
        const perkID = target?.dataset?.perkId ?? '';
        if (!perkID) return;
        if (w._pendingLearn.includes(perkID)) return;
        w._pendingUnlearn = w._pendingUnlearn.filter((id) => id !== perkID);
        w._pendingLearn.push(perkID);
        w.render();
    }

    static _actionUnlearnPerk(event, target) {
        const w = _currentSkillsWindowRef;
        if (!w) return;
        event?.preventDefault?.();
        BlacksmithUtils.playSound(BlacksmithConstants.SOUNDPOP01, 0.5);
        const perkID = target?.dataset?.perkId ?? '';
        if (!perkID) return;
        const btn = target?.closest?.('[data-action="unlearnPerk"]');
        if (btn?.hasAttribute?.('disabled')) return;
        if (w._pendingUnlearn.includes(perkID)) return;
        w._pendingLearn = w._pendingLearn.filter((id) => id !== perkID);
        w._pendingUnlearn.push(perkID);
        w.render();
    }

    static _actionRemovePendingLearn(event, target) {
        const w = _currentSkillsWindowRef;
        if (!w) return;
        event?.preventDefault?.();
        const perkID = target?.dataset?.perkId ?? '';
        if (!perkID) return;
        w._pendingLearn = w._pendingLearn.filter((id) => id !== perkID);
        w.render();
    }

    static _actionRemovePendingUnlearn(event, target) {
        const w = _currentSkillsWindowRef;
        if (!w) return;
        event?.preventDefault?.();
        const perkID = target?.dataset?.perkId ?? '';
        if (!perkID) return;
        w._pendingUnlearn = w._pendingUnlearn.filter((id) => id !== perkID);
        w.render();
    }

    static async _actionEditPoints(event, target) {
        const w = _currentSkillsWindowRef;
        if (!w || !w._actor || !game.user?.isGM) return;
        event?.preventDefault?.();
        const actor = w._actor;
        const current = await _skillManager.getPointsRemaining(actor);
        const inputId = `skills-edit-points-${foundry.utils.randomID()}`;
        new Dialog({
            title: 'Edit skill points',
            content: `
                <p class="skills-edit-points-desc">Points remaining for <strong>${actor.name ?? 'this character'}</strong>:</p>
                <div class="form-group">
                    <label for="${inputId}">Points</label>
                    <input type="number" id="${inputId}" name="points" value="${current}" min="0" step="1" style="max-width:6em;" />
                </div>
            `,
            buttons: {
                set: {
                    icon: '<i class="fas fa-check"></i>',
                    label: 'Set',
                    callback: async (html) => {
                        const raw = (html?.jquery ? html.find(`#${inputId}`).val() : html?.querySelector?.(`#${inputId}`)?.value) ?? '';
                        const value = parseInt(String(raw).trim(), 10);
                        if (Number.isNaN(value) || value < 0) {
                            ui.notifications?.warn?.('Enter a number 0 or greater.');
                            return;
                        }
                        await _skillManager.setPointsRemaining(actor, value);
                        w.render();
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: 'Cancel'
                }
            },
            default: 'set'
        }, { width: 320 }).render(true);
    }

    static _actionSelectSkillBadge(event, target) {
        const w = _currentSkillsWindowRef;
        if (!w) return;
        event?.preventDefault?.();
        BlacksmithUtils.playSound(BlacksmithConstants.SOUNDPOP02, 0.5);
        const badge = target?.closest?.('.skills-panel-badge[data-skill]');
        if (!badge) return;
        const skillId = badge.dataset?.skill;
        if (!skillId) return;
        w._selectedSkillId = skillId;
        w._selectedPerkIndex = null;
        w.render();
    }

    static _actionSelectSkillPerk(event, target) {
        const w = _currentSkillsWindowRef;
        if (!w) return;
        event?.preventDefault?.();
        BlacksmithUtils.playSound(BlacksmithConstants.SOUNDPOP01, 0.5);
        const perkEl = target?.closest?.('.skills-perk');
        if (!perkEl) return;
        const skillId = perkEl.dataset?.skill;
        const idx = perkEl.dataset?.perkIndex;
        if (skillId == null || idx == null) return;
        const idxNum = parseInt(idx, 10);
        if (isNaN(idxNum)) return;
        w._selectedSkillId = skillId;
        w._selectedPerkIndex = idxNum;
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
            const perk = e.target?.closest?.('.skills-perk');
            if (perk) {
                e.preventDefault?.();
                SkillsWindow._actionSelectSkillPerk.call(null, e, perk);
                return;
            }
            const learnBtn = e.target?.closest?.('[data-action="learnPerk"]');
            if (learnBtn) {
                e.preventDefault?.();
                SkillsWindow._actionLearnPerk.call(null, e, learnBtn);
                return;
            }
            const unlearnBtn = e.target?.closest?.('[data-action="unlearnPerk"]');
            if (unlearnBtn) {
                e.preventDefault?.();
                SkillsWindow._actionUnlearnPerk.call(null, e, unlearnBtn);
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
            const editPointsBtn = e.target?.closest?.('[data-action="editPoints"]');
            if (editPointsBtn) {
                e.preventDefault?.();
                e.stopPropagation?.();
                e.stopImmediatePropagation?.();
                SkillsWindow._actionEditPoints.call(null, e, editPointsBtn);
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
