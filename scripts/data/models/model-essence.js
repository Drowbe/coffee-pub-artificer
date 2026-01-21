// ================================================================== 
// ===== ARTIFICER ESSENCE MODEL ====================================
// ================================================================== 

import { ESSENCE_AFFINITIES } from '../../schema-essences.js';
import { INGREDIENT_RARITIES } from '../../schema-ingredients.js';

/**
 * ArtificerEssence - Magical affinity data model
 * Represents essences stored as FoundryVTT Items with artificer flags
 */
export class ArtificerEssence {
    /**
     * Create an ArtificerEssence from a FoundryVTT Item
     * @param {Item} item - FoundryVTT Item document
     * @returns {ArtificerEssence|null} Parsed essence or null if invalid
     */
    static fromItem(item) {
        if (!item) return null;
        
        const artificerData = item.flags?.artificer;
        if (!artificerData || artificerData.type !== 'essence') {
            return null;
        }
        
        return new ArtificerEssence({
            id: item.uuid,
            name: item.name,
            affinity: artificerData.affinity,
            tags: artificerData.tags ?? [],
            tier: artificerData.tier ?? 1,
            rarity: artificerData.rarity ?? INGREDIENT_RARITIES.COMMON,
            description: item.system?.description?.value ?? '',
            image: item.img ?? null,
            source: item.compendium?.collection?.metadata?.id ?? null
        });
    }
    
    /**
     * Create an ArtificerEssence from raw data
     * @param {Object} data - Essence data
     */
    constructor(data = {}) {
        this.id = data.id ?? '';
        this.name = data.name ?? '';
        this.affinity = data.affinity ?? ESSENCE_AFFINITIES.HEAT;
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
        // Validate affinity
        if (!Object.values(ESSENCE_AFFINITIES).includes(this.affinity)) {
            console.warn(`Invalid essence affinity: ${this.affinity}. Defaulting to ${ESSENCE_AFFINITIES.HEAT}`);
            this.affinity = ESSENCE_AFFINITIES.HEAT;
        }
        
        // Validate rarity
        if (!Object.values(INGREDIENT_RARITIES).includes(this.rarity)) {
            console.warn(`Invalid essence rarity: ${this.rarity}. Defaulting to ${INGREDIENT_RARITIES.COMMON}`);
            this.rarity = INGREDIENT_RARITIES.COMMON;
        }
        
        // Validate tier (1-10)
        if (typeof this.tier !== 'number' || this.tier < 1 || this.tier > 10) {
            console.warn(`Invalid essence tier: ${this.tier}. Defaulting to 1`);
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
            affinity: this.affinity,
            tags: [...this.tags],
            tier: this.tier,
            rarity: this.rarity,
            description: this.description,
            image: this.image,
            source: this.source
        };
    }
    
    /**
     * Validate essence data
     * @returns {boolean} True if valid
     */
    validate() {
        if (!this.id) {
            console.error('ArtificerEssence: Missing id');
            return false;
        }
        if (!this.name) {
            console.error('ArtificerEssence: Missing name');
            return false;
        }
        return true;
    }
}
