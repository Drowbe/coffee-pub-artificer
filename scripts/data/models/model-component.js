// ================================================================== 
// ===== ARTIFICER COMPONENT MODEL ==================================
// ================================================================== 

import { MODULE } from '../../const.js';
import { COMPONENT_TYPES } from '../../schema-components.js';
import { INGREDIENT_RARITIES } from '../../schema-ingredients.js';

/**
 * ArtificerComponent - Refined material data model
 * Represents components stored as FoundryVTT Items with artificer flags
 */
export class ArtificerComponent {
    /**
     * Create an ArtificerComponent from a FoundryVTT Item
     * @param {Item} item - FoundryVTT Item document
     * @returns {ArtificerComponent|null} Parsed component or null if invalid
     */
    static fromItem(item) {
        if (!item) return null;
        
        const artificerData = item.flags?.artificer;
        if (!artificerData || artificerData.type !== 'component') {
            return null;
        }
        
        return new ArtificerComponent({
            id: item.uuid,
            name: item.name,
            type: artificerData.componentType,
            tags: artificerData.tags ?? [],
            tier: artificerData.tier ?? 1,
            rarity: artificerData.rarity ?? INGREDIENT_RARITIES.COMMON,
            description: item.system?.description?.value ?? '',
            image: item.img ?? null,
            source: item.compendium?.collection?.metadata?.id ?? null
        });
    }
    
    /**
     * Create an ArtificerComponent from raw data
     * @param {Object} data - Component data
     */
    constructor(data = {}) {
        this.id = data.id ?? '';
        this.name = data.name ?? '';
        this.type = data.type ?? COMPONENT_TYPES.METAL;
        this.tags = data.tags ?? [];
        this.tier = data.tier ?? 1;
        this.rarity = data.rarity ?? INGREDIENT_RARITIES.COMMON;
        this.description = data.description ?? '';
        this.image = data.image ?? null;
        this.source = data.source ?? null;
        
        // Validate
        this._validateAndNormalize();
    }
    
    /**
     * Validate and normalize data
     * @private
     */
    _validateAndNormalize() {
        // Validate type
        if (!Object.values(COMPONENT_TYPES).includes(this.type)) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Invalid component type: ${this.type}. Defaulting to ${COMPONENT_TYPES.METAL}`, null, true, false);
            this.type = COMPONENT_TYPES.METAL;
        }
        
        // Validate rarity
        if (!Object.values(INGREDIENT_RARITIES).includes(this.rarity)) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Invalid component rarity: ${this.rarity}. Defaulting to ${INGREDIENT_RARITIES.COMMON}`, null, true, false);
            this.rarity = INGREDIENT_RARITIES.COMMON;
        }
        
        // Validate tier (1-10)
        if (typeof this.tier !== 'number' || this.tier < 1 || this.tier > 10) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, `Invalid component tier: ${this.tier}. Defaulting to 1`, null, true, false);
            this.tier = 1;
        }
        
        // Ensure tags is array
        if (!Array.isArray(this.tags)) {
            this.tags = [];
        }
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
            tags: [...this.tags],
            tier: this.tier,
            rarity: this.rarity,
            description: this.description,
            image: this.image,
            source: this.source
        };
    }
    
    /**
     * Validate component data
     * @returns {boolean} True if valid
     */
    validate() {
        if (!this.id) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'ArtificerComponent: Missing id', null, true, false);
            return false;
        }
        if (!this.name) {
            BlacksmithUtils.postConsoleAndNotification(MODULE.NAME, 'ArtificerComponent: Missing name', null, true, false);
            return false;
        }
        return true;
    }
}
