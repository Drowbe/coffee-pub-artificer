// ================================================================== 
// ===== ARTIFICER RECIPE MODEL =====================================
// ================================================================== 

import { MODULE } from '../../const.js';
import { ITEM_TYPES, CRAFTING_SKILLS } from '../../schema-recipes.js';
import { hashString } from '../../utils/helpers.js';

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
        this.skillLevel = data.skillLevel ?? 0;
        this.workstation = data.workstation ?? null;
        this.heat = data.heat ?? null;
        this.time = data.time ?? null;
        this.containerUuid = data.containerUuid ?? null;
        this.containerName = data.containerName ?? null;
        this.ingredients = data.ingredients ?? [];
        this.resultItemUuid = data.resultItemUuid ?? '';
        this.tags = data.tags ?? [];
        this.description = data.description ?? '';
        this.source = data.source ?? '';
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
            console.warn(`Invalid recipe type: ${this.type}. Defaulting to ${ITEM_TYPES.CONSUMABLE}`);
            this.type = ITEM_TYPES.CONSUMABLE;
        }
        
        // Validate skill
        if (!Object.values(CRAFTING_SKILLS).includes(this.skill)) {
            console.warn(`Invalid recipe skill: ${this.skill}. Defaulting to ${CRAFTING_SKILLS.ALCHEMY}`);
            this.skill = CRAFTING_SKILLS.ALCHEMY;
        }
        
        // Validate skillLevel (0-100)
        if (typeof this.skillLevel !== 'number' || this.skillLevel < 0 || this.skillLevel > 100) {
            console.warn(`Invalid recipe skillLevel: ${this.skillLevel}. Defaulting to 0`);
            this.skillLevel = 0;
        }
        
        // Ensure ingredients is array
        if (!Array.isArray(this.ingredients)) {
            this.ingredients = [];
        }
        
        // Validate ingredients
        this.ingredients = this.ingredients.map(ing => {
            if (typeof ing === 'string') {
                // Legacy format: just a name string
                return {
                    type: 'ingredient',
                    name: ing,
                    quantity: 1
                };
            }
            return {
                type: ing.type ?? 'ingredient',
                name: ing.name ?? '',
                quantity: ing.quantity ?? 1
            };
        });
        
        // Ensure tags is array
        if (!Array.isArray(this.tags)) {
            this.tags = [];
        }

        // Validate heat (0-100) and time (seconds)
        if (this.heat != null) {
            const h = Number(this.heat);
            if (isNaN(h) || h < 0 || h > 100) this.heat = null;
            else this.heat = h;
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
        
        // Check workstation (if required)
        if (this.workstation) {
            // TODO: Check if actor is at required workstation
            // For now, assume workstation check is handled elsewhere
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
            const items = actor.items.filter(item => {
                const artificerData = item.flags?.[MODULE.ID] || item.flags?.artificer;
                const nameMatches = (item.name || '').trim() === (ing.name || '').trim();

                if (artificerData) {
                    // Artificer item: match type and name
                    return artificerData.type === ing.type && nameMatches;
                }
                // Normal D&D item (no Artificer flags): match by name only
                return nameMatches;
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
            workstation: this.workstation,
            heat: this.heat,
            time: this.time,
            containerUuid: this.containerUuid,
            containerName: this.containerName,
            ingredients: [...this.ingredients],
            resultItemUuid: this.resultItemUuid,
            tags: [...this.tags],
            description: this.description,
            source: this.source,
            journalPageId: this.journalPageId
        };
    }
    
    /**
     * Validate recipe data
     * @returns {boolean} True if valid
     */
    validate() {
        if (!this.id) {
            console.error('ArtificerRecipe: Missing id');
            return false;
        }
        if (!this.name) {
            console.error('ArtificerRecipe: Missing name');
            return false;
        }
        if (!this.resultItemUuid) {
            console.error('ArtificerRecipe: Missing resultItemUuid');
            return false;
        }
        if (this.ingredients.length === 0) {
            console.error('ArtificerRecipe: No ingredients specified');
            return false;
        }
        return true;
    }
}
