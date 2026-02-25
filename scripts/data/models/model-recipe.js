// ================================================================== 
// ===== ARTIFICER RECIPE MODEL =====================================
// ================================================================== 

import { MODULE } from '../../const.js';
import { hashString, normalizeItemNameForMatch } from '../../utils/helpers.js';
import { ITEM_TYPES, CRAFTING_SKILLS, PROCESS_TYPES, SKILL_LEVEL_MIN, SKILL_LEVEL_MAX } from '../../schema-recipes.js';
import { ARTIFICER_TYPES, LEGACY_TYPE_TO_ARTIFICER_TYPE } from '../../schema-artificer-item.js';
import { getArtificerTypeFromFlags, getFamilyFromFlags } from '../../utility-artificer-item.js';

/** Normalize ingredient type to TYPE (Component | Creation | Tool). Legacy ingredient/component/essence → Component. */
function normalizeIngredientType(t) {
    if (!t || typeof t !== 'string') return ARTIFICER_TYPES.COMPONENT;
    const normalized = LEGACY_TYPE_TO_ARTIFICER_TYPE[t.toLowerCase()];
    if (normalized) return normalized;
    if (Object.values(ARTIFICER_TYPES).includes(t)) return t;
    return ARTIFICER_TYPES.COMPONENT;
}

/**
 * ArtificerRecipe - Recipe data model
 * Represents recipes stored as journal entries
 */
export class ArtificerRecipe {
    /**
     * Create an ArtificerRecipe from raw data
     * @param {Object} data - Recipe data
     */
    constructor(data = {}) {
        this.id = data.id ?? '';
        this.name = data.name ?? '';
        this.type = data.type ?? ITEM_TYPES.CONSUMABLE;
        this.category = data.category ?? '';
        this.skill = data.skill ?? CRAFTING_SKILLS.ALCHEMY;
        this.skillLevel = data.skillLevel ?? 1;
        this.heat = data.heat ?? null;
        this.processType = data.processType ?? null;
        this.processLevel = data.processLevel ?? null;
        this.time = data.time ?? null;
        this.apparatusName = data.apparatusName ?? data.containerName ?? null;
        this.containerName = data.containerName ?? null;
        this.skillKit = data.skillKit ?? data.toolName ?? data.tool ?? null;
        this.goldCost = data.goldCost != null ? Number(data.goldCost) : null;
        this.workHours = data.workHours != null ? Number(data.workHours) : null;
        this.successDC = data.successDC != null ? Number(data.successDC) : null;
        this.ingredients = data.ingredients ?? [];
        this.resultItemName = data.resultItemName ?? data.name ?? '';
        this.traits = Array.isArray(data.traits) ? data.traits : (Array.isArray(data.tags) ? data.tags : []);
        this.description = data.description ?? '';
        this.rarity = (data.rarity != null && String(data.rarity).trim()) ? String(data.rarity).trim().toLowerCase() : null;
        this.source = data.source ?? '';
        this.license = data.license ?? '';
        this.journalPageId = data.journalPageId ?? '';
        
        // Validate
        this._validateAndNormalize();
    }
    
    /**
     * Validate and normalize data
     * @private
     */
    _validateAndNormalize() {
        // Validate type
        if (!Object.values(ITEM_TYPES).includes(this.type)) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Invalid recipe type: ${this.type}. Defaulting to ${ITEM_TYPES.CONSUMABLE}`, null, true, false);
            this.type = ITEM_TYPES.CONSUMABLE;
        }
        
        // Validate skill
        if (!Object.values(CRAFTING_SKILLS).includes(this.skill)) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Invalid recipe skill: ${this.skill}. Defaulting to ${CRAFTING_SKILLS.ALCHEMY}`, null, true, false);
            this.skill = CRAFTING_SKILLS.ALCHEMY;
        }
        
        // Validate skillLevel (0-20)
        if (typeof this.skillLevel !== 'number' || this.skillLevel < SKILL_LEVEL_MIN || this.skillLevel > SKILL_LEVEL_MAX) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Invalid recipe skillLevel: ${this.skillLevel}. Defaulting to 1`, null, true, false);
            this.skillLevel = 1;
        }
        
        // Ensure ingredients is array
        if (!Array.isArray(this.ingredients)) {
            this.ingredients = [];
        }
        
        // Validate ingredients (TYPE + optional family; legacy types normalized to Component|Creation|Tool)
        this.ingredients = this.ingredients.map(ing => {
            if (typeof ing === 'string') {
                return {
                    type: ARTIFICER_TYPES.COMPONENT,
                    family: '',
                    name: ing,
                    quantity: 1
                };
            }
            return {
                type: normalizeIngredientType(ing.type),
                family: (ing.family != null && ing.family !== '') ? String(ing.family).trim() : '',
                name: ing.name ?? '',
                quantity: ing.quantity ?? 1
            };
        });

        // Ensure traits is array
        if (!Array.isArray(this.traits)) {
            this.traits = [];
        }

        // Validate heat (0–3, legacy) and time (seconds)
        if (this.heat != null) {
            const h = Number(this.heat);
            if (isNaN(h) || h < 0 || h > 3) this.heat = null;
            else this.heat = Math.round(h);
        }
        if (this.processType != null && !PROCESS_TYPES.includes(this.processType)) this.processType = null;
        if (this.processLevel != null) {
            const l = Number(this.processLevel);
            if (isNaN(l) || l < 0 || l > 3) this.processLevel = null;
            else this.processLevel = Math.round(l);
        }
        if (this.time != null) {
            const t = Number(this.time);
            if (isNaN(t) || t < 0) this.time = null;
            else this.time = t;
        }
    }
    
    /**
     * Get recipe number (hash-based, e.g., "R1", "R2")
     * @returns {string} Recipe number
     */
    getNumber() {
        return hashString(this.id, 'R');
    }
    
    /**
     * Check if actor can craft this recipe
     * @param {Actor} actor - Actor to check
     * @returns {Object} { canCraft: boolean, reasons: string[] }
     */
    canCraft(actor) {
        const reasons = [];
        
        // Check skill level
        const skillValue = this.getActorSkill(actor, this.skill);
        if (skillValue < this.skillLevel) {
            reasons.push(`Requires ${this.skill} ${this.skillLevel}, actor has ${skillValue}`);
        }

        // Check skill kit (e.g. Alchemist's Supplies)
        if (this.skillKit?.trim()) {
            const hasKit = actor.items.some((i) => (i.name || '').trim() === this.skillKit.trim());
            if (!hasKit) {
                reasons.push(`Missing skill kit: ${this.skillKit}`);
            }
        }

        // Check apparatus
        if (this.apparatusName?.trim()) {
            const hasApparatus = actor.items.some((i) => (i.name || '').trim() === this.apparatusName.trim());
            if (!hasApparatus) {
                reasons.push(`Missing apparatus: ${this.apparatusName}`);
            }
        }

        // Check container
        if (this.containerName?.trim()) {
            const hasContainer = actor.items.some((i) => (i.name || '').trim() === this.containerName.trim());
            if (!hasContainer) {
                reasons.push(`Missing container: ${this.containerName}`);
            }
        }
        
        // Check materials
        const missing = this.getMissingMaterials(actor);
        if (missing.length > 0) {
            reasons.push(`Missing materials: ${missing.map(m => `${m.name} (${m.quantity})`).join(', ')}`);
        }
        
        return {
            canCraft: reasons.length === 0,
            reasons: reasons
        };
    }
    
    /**
     * Get actor's skill value
     * @param {Actor} actor - Actor
     * @param {string} skill - Skill name
     * @returns {number} Skill value
     */
    getActorSkill(actor, skill) {
        if (!actor) return 0;
        const skills = actor.flags?.artificer?.skills ?? {};
        return skills[skill] ?? 0;
    }
    
    /**
     * Get missing materials for actor
     * @param {Actor} actor - Actor to check
     * @returns {Array<{type: string, name: string, quantity: number, have: number}>} Missing materials
     */
    getMissingMaterials(actor) {
        if (!actor) {
            return this.ingredients.map(ing => ({
                ...ing,
                have: 0
            }));
        }
        
        const missing = [];
        for (const ing of this.ingredients) {
            const wantType = ing.type || ARTIFICER_TYPES.COMPONENT;
            const wantFamily = (ing.family || '').trim();
            const wantName = normalizeItemNameForMatch(ing.name);
            const items = actor.items.filter(item => {
                const flags = item.flags?.[MODULE.ID] || item.flags?.artificer;
                const nameMatches = normalizeItemNameForMatch(item.name) === wantName;
                if (!nameMatches) return false;
                if (!flags) {
                    // Normal D&D item (no Artificer flags): match by name only
                    return true;
                }
                const itemType = getArtificerTypeFromFlags(flags);
                if ((itemType || ARTIFICER_TYPES.COMPONENT) !== wantType) return false;
                if (wantFamily) {
                    const itemFamily = (getFamilyFromFlags(flags) || '').trim();
                    if (itemFamily && itemFamily !== wantFamily) return false;
                }
                return true;
            });

            const getQuantity = (item) => {
                const q = item.system?.quantity;
                return typeof q === 'number' ? q : (q?.value ?? 1);
            };
            const have = items.reduce((sum, item) => sum + getQuantity(item), 0);
            const need = ing.quantity;
            
            if (have < need) {
                missing.push({
                    type: ing.type,
                    family: ing.family,
                    name: ing.name,
                    quantity: need - have,
                    have: have
                });
            }
        }
        
        return missing;
    }
    
    /**
     * Serialize to plain object
     * @returns {Object} Serialized data
     */
    serialize() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            category: this.category,
            skill: this.skill,
            skillLevel: this.skillLevel,
            heat: this.heat,
            processType: this.processType,
            processLevel: this.processLevel,
            time: this.time,
            apparatusName: this.apparatusName,
            containerName: this.containerName,
            skillKit: this.skillKit,
            goldCost: this.goldCost,
            workHours: this.workHours,
            successDC: this.successDC,
            ingredients: [...this.ingredients],
            resultItemName: this.resultItemName,
            traits: [...this.traits],
            description: this.description,
            rarity: this.rarity,
            source: this.source,
            license: this.license,
            journalPageId: this.journalPageId
        };
    }
    
    /**
     * Validate recipe data
     * @returns {boolean} True if valid
     */
    validate() {
        if (!this.id) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'ArtificerRecipe: Missing id', null, true, false);
            return false;
        }
        if (!this.name) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'ArtificerRecipe: Missing name', null, true, false);
            return false;
        }
        if (!this.resultItemName) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'ArtificerRecipe: Missing resultItemName', null, true, false);
            return false;
        }
        if (this.ingredients.length === 0) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'ArtificerRecipe: No ingredients specified', null, true, false);
            return false;
        }
        return true;
    }
}
