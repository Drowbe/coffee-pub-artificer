// ================================================================== 
// ===== ARTIFICER BLUEPRINT MODEL ==================================
// ================================================================== 

import { MODULE } from '../../const.js';
import { hashString } from '../../utils/helpers.js';
import { CRAFTING_SKILLS, SKILL_LEVEL_MIN, SKILL_LEVEL_MAX } from '../../schema-recipes.js';
import { BLUEPRINT_STAGE_STATES } from '../../schema-blueprints.js';

/**
 * ArtificerBlueprint - Blueprint data model
 * Represents multi-stage blueprints stored as journal entries
 */
export class ArtificerBlueprint {
    /**
     * Create an ArtificerBlueprint from raw data
     * @param {Object} data - Blueprint data
     */
    constructor(data = {}) {
        this.id = data.id ?? '';
        this.name = data.name ?? '';
        this.narrative = data.narrative ?? '';
        this.skill = data.skill ?? CRAFTING_SKILLS.ALCHEMY;
        this.skillLevel = data.skillLevel ?? 1;
        this.stages = data.stages ?? [];
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
        // Validate skill
        if (!Object.values(CRAFTING_SKILLS).includes(this.skill)) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Invalid blueprint skill: ${this.skill}. Defaulting to ${CRAFTING_SKILLS.ALCHEMY}`, null, true, false);
            this.skill = CRAFTING_SKILLS.ALCHEMY;
        }

        // Validate skillLevel (0-20)
        if (typeof this.skillLevel !== 'number' || this.skillLevel < SKILL_LEVEL_MIN || this.skillLevel > SKILL_LEVEL_MAX) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Invalid blueprint skillLevel: ${this.skillLevel}. Defaulting to 1`, null, true, false);
            this.skillLevel = 1;
        }
        
        // Ensure stages is array
        if (!Array.isArray(this.stages)) {
            this.stages = [];
        }
        
        // Validate and normalize stages
        this.stages = this.stages.map((stage, index) => {
            return {
                stageNumber: stage.stageNumber ?? (index + 1),
                name: stage.name ?? `Stage ${index + 1}`,
                state: stage.state ?? BLUEPRINT_STAGE_STATES.ACTIVE,
                requirements: stage.requirements ?? [],
                description: stage.description ?? ''
            };
        });
        
        // Ensure tags is array
        if (!Array.isArray(this.tags)) {
            this.tags = [];
        }
    }
    
    /**
     * Get blueprint number (hash-based, e.g., "B1", "B2")
     * @returns {string} Blueprint number
     */
    getNumber() {
        return hashString(this.id, 'B');
    }
    
    /**
     * Get stage status for actor
     * @param {Actor} actor - Actor to check
     * @param {number} stageIndex - Stage index (0-based)
     * @returns {Object} Stage status
     */
    getStageStatus(actor, stageIndex) {
        if (stageIndex < 0 || stageIndex >= this.stages.length) {
            return { available: false, reason: 'Invalid stage index' };
        }
        
        const stage = this.stages[stageIndex];
        
        // Check if previous stages are completed
        for (let i = 0; i < stageIndex; i++) {
            const prevStage = this.stages[i];
            const prevStatus = this.getStageStatus(actor, i);
            if (prevStatus.state !== BLUEPRINT_STAGE_STATES.COMPLETED) {
                return {
                    available: false,
                    reason: `Previous stage ${prevStage.stageNumber} (${prevStage.name}) must be completed first`,
                    state: BLUEPRINT_STAGE_STATES.ACTIVE
                };
            }
        }
        
        // Check skill requirement
        const skillValue = this.getActorSkill(actor, this.skill);
        if (skillValue < this.skillLevel) {
            return {
                available: false,
                reason: `Requires ${this.skill} ${this.skillLevel}, actor has ${skillValue}`,
                state: BLUEPRINT_STAGE_STATES.ACTIVE
            };
        }
        
        // Check materials
        const missing = this.getMissingMaterials(actor, stageIndex);
        if (missing.length > 0) {
            return {
                available: false,
                reason: `Missing materials: ${missing.map(m => `${m.name} (${m.quantity})`).join(', ')}`,
                state: BLUEPRINT_STAGE_STATES.ACTIVE
            };
        }
        
        // Check if stage is already completed
        const actorProgress = this.getActorProgress(actor);
        const stageProgress = actorProgress.stages[stageIndex];
        if (stageProgress?.state === BLUEPRINT_STAGE_STATES.COMPLETED) {
            return {
                available: false,
                reason: 'Stage already completed',
                state: BLUEPRINT_STAGE_STATES.COMPLETED
            };
        }
        
        return {
            available: true,
            state: stageProgress?.state ?? BLUEPRINT_STAGE_STATES.ACTIVE
        };
    }
    
    /**
     * Check if actor can start a stage
     * @param {Actor} actor - Actor to check
     * @param {number} stageIndex - Stage index (0-based)
     * @returns {boolean} True if can start
     */
    canStartStage(actor, stageIndex) {
        const status = this.getStageStatus(actor, stageIndex);
        return status.available && status.state === BLUEPRINT_STAGE_STATES.ACTIVE;
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
     * Get missing materials for a stage
     * @param {Actor} actor - Actor to check
     * @param {number} stageIndex - Stage index
     * @returns {Array<{type: string, name: string, quantity: number, have: number}>} Missing materials
     */
    getMissingMaterials(actor, stageIndex) {
        if (stageIndex < 0 || stageIndex >= this.stages.length) {
            return [];
        }
        
        const stage = this.stages[stageIndex];
        if (!actor) {
            return stage.requirements.map(req => ({
                ...req,
                have: 0
            }));
        }
        
        const missing = [];
        for (const req of stage.requirements) {
            const items = actor.items.filter(item => {
                const artificerData = item.flags?.[MODULE.ID] || item.flags?.artificer;
                const nameMatches = (item.name || '').trim() === (req.name || '').trim();

                if (artificerData) {
                    return artificerData.type === req.type && nameMatches;
                }
                return nameMatches;
            });

            const getQuantity = (item) => {
                const q = item.system?.quantity;
                return typeof q === 'number' ? q : (q?.value ?? 1);
            };
            const have = items.reduce((sum, item) => sum + getQuantity(item), 0);
            const need = req.quantity;
            
            if (have < need) {
                missing.push({
                    type: req.type,
                    name: req.name,
                    quantity: need - have,
                    have: have
                });
            }
        }
        
        return missing;
    }
    
    /**
     * Get actor's progress on this blueprint
     * @param {Actor} actor - Actor
     * @returns {Object} Progress data
     */
    getActorProgress(actor) {
        if (!actor) {
            return {
                blueprintId: this.id,
                stages: this.stages.map(() => ({ state: BLUEPRINT_STAGE_STATES.ACTIVE }))
            };
        }
        
        const blueprints = actor.flags?.artificer?.blueprints ?? {};
        const progress = blueprints[this.id] ?? {
            stages: this.stages.map(() => ({ state: BLUEPRINT_STAGE_STATES.ACTIVE }))
        };
        
        return {
            blueprintId: this.id,
            ...progress
        };
    }
    
    /**
     * Serialize to plain object
     * @returns {Object} Serialized data
     */
    serialize() {
        return {
            id: this.id,
            name: this.name,
            narrative: this.narrative,
            skill: this.skill,
            skillLevel: this.skillLevel,
            stages: this.stages.map(stage => ({
                stageNumber: stage.stageNumber,
                name: stage.name,
                state: stage.state,
                requirements: [...stage.requirements],
                description: stage.description
            })),
            resultItemUuid: this.resultItemUuid,
            tags: [...this.tags],
            description: this.description,
            source: this.source,
            journalPageId: this.journalPageId
        };
    }
    
    /**
     * Validate blueprint data
     * @returns {boolean} True if valid
     */
    validate() {
        if (!this.id) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'ArtificerBlueprint: Missing id', null, true, false);
            return false;
        }
        if (!this.name) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'ArtificerBlueprint: Missing name', null, true, false);
            return false;
        }
        if (!this.resultItemUuid) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'ArtificerBlueprint: Missing resultItemUuid', null, true, false);
            return false;
        }
        if (this.stages.length === 0) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'ArtificerBlueprint: No stages specified', null, true, false);
            return false;
        }
        return true;
    }
}
