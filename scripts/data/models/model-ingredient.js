// ================================================================== 
// ===== ARTIFICER INGREDIENT MODEL ================================
// ================================================================== 

import { INGREDIENT_FAMILIES, INGREDIENT_RARITIES } from '../../schema-ingredients.js';

/**
 * ArtificerIngredient - Raw material data model
 * Represents ingredients stored as FoundryVTT Items with artificer flags
 */
export class ArtificerIngredient {
    /**
     * Create an ArtificerIngredient from a FoundryVTT Item
     * @param {Item} item - FoundryVTT Item document
     * @returns {ArtificerIngredient|null} Parsed ingredient or null if invalid
     */
    static fromItem(item) {
        if (!item) return null;
        
        const artificerData = item.flags?.artificer;
        if (!artificerData || artificerData.type !== 'ingredient') {
            return null;
        }
        
        return new ArtificerIngredient({
            id: item.uuid,
            name: item.name,
            family: artificerData.family,
            tier: artificerData.tier ?? 1,
            rarity: artificerData.rarity ?? INGREDIENT_RARITIES.COMMON,
            primaryTag: artificerData.primaryTag,
            secondaryTags: artificerData.secondaryTags ?? [],
            quirk: artificerData.quirk ?? null,
            biomes: artificerData.biomes ?? [],
            description: item.system?.description?.value ?? '',
            image: item.img ?? null,
            source: item.compendium?.collection?.metadata?.id ?? null
        });
    }
    
    /**
     * Create an ArtificerIngredient from raw data
     * @param {Object} data - Ingredient data
     */
    constructor(data = {}) {
        this.id = data.id ?? '';
        this.name = data.name ?? '';
        this.family = data.family ?? INGREDIENT_FAMILIES.HERBS;
        this.tier = data.tier ?? 1;
        this.rarity = data.rarity ?? INGREDIENT_RARITIES.COMMON;
        this.primaryTag = data.primaryTag ?? '';
        this.secondaryTags = data.secondaryTags ?? [];
        this.quirk = data.quirk ?? null;
        this.biomes = data.biomes ?? [];
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
        // Validate family
        if (!Object.values(INGREDIENT_FAMILIES).includes(this.family)) {
            console.warn(`Invalid ingredient family: ${this.family}. Defaulting to ${INGREDIENT_FAMILIES.HERBS}`);
            this.family = INGREDIENT_FAMILIES.HERBS;
        }
        
        // Validate rarity
        if (!Object.values(INGREDIENT_RARITIES).includes(this.rarity)) {
            console.warn(`Invalid ingredient rarity: ${this.rarity}. Defaulting to ${INGREDIENT_RARITIES.COMMON}`);
            this.rarity = INGREDIENT_RARITIES.COMMON;
        }
        
        // Validate tier (1-10)
        if (typeof this.tier !== 'number' || this.tier < 1 || this.tier > 10) {
            console.warn(`Invalid ingredient tier: ${this.tier}. Defaulting to 1`);
            this.tier = 1;
        }
        
        // Ensure secondaryTags is array
        if (!Array.isArray(this.secondaryTags)) {
            this.secondaryTags = [];
        }
        
        // Ensure biomes is array
        if (!Array.isArray(this.biomes)) {
            this.biomes = [];
        }
        
        // Validate tags (2-5 tags total: 1 primary + 1-2 secondary + optional quirk)
        const totalTags = 1 + this.secondaryTags.length + (this.quirk ? 1 : 0);
        if (totalTags < 2 || totalTags > 5) {
            console.warn(`Ingredient ${this.name} has ${totalTags} tags. Should have 2-5 tags.`);
        }
    }
    
    /**
     * Get all tags (primary + secondary + quirk if present)
     * @returns {string[]} All tags
     */
    getAllTags() {
        const tags = [this.primaryTag, ...this.secondaryTags];
        if (this.quirk) {
            tags.push(this.quirk);
        }
        return tags.filter(tag => tag && tag.trim());
    }
    
    /**
     * Serialize to plain object
     * @returns {Object} Serialized data
     */
    serialize() {
        return {
            id: this.id,
            name: this.name,
            family: this.family,
            tier: this.tier,
            rarity: this.rarity,
            primaryTag: this.primaryTag,
            secondaryTags: [...this.secondaryTags],
            quirk: this.quirk,
            biomes: [...this.biomes],
            description: this.description,
            image: this.image,
            source: this.source
        };
    }
    
    /**
     * Validate ingredient data
     * @returns {boolean} True if valid
     */
    validate() {
        if (!this.id) {
            console.error('ArtificerIngredient: Missing id');
            return false;
        }
        if (!this.name) {
            console.error('ArtificerIngredient: Missing name');
            return false;
        }
        if (!this.primaryTag) {
            console.error('ArtificerIngredient: Missing primaryTag');
            return false;
        }
        return true;
    }
}
