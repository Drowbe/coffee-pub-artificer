// ================================================================== 
// ===== TAG MANAGER ================================================
// ================================================================== 

import { INGREDIENT_FAMILIES } from '../schema-ingredients.js';

/**
 * Tag Categories
 * @enum {string}
 */
export const TAG_CATEGORIES = {
    PRIMARY: 'primary',
    SECONDARY: 'secondary',
    QUIRK: 'quirk',
    ELEMENT: 'element',
    STRUCTURAL: 'structural'
};

/**
 * TagManager - Manages tag validation, categories, and families
 */
export class TagManager {
    constructor() {
        // Define tag families and their associated tags
        this._tagFamilies = {
            [INGREDIENT_FAMILIES.HERBS]: ['Herb', 'Floral', 'Medicinal', 'Toxic', 'Aromatic', 'Pungent', 'Soothing'],
            [INGREDIENT_FAMILIES.MINERALS]: ['Metal', 'Ore', 'Alloy-Friendly', 'Hard', 'Dense', 'Malleable'],
            [INGREDIENT_FAMILIES.GEMS]: ['Crystal', 'Resonant', 'Arcane', 'Brilliant', 'Reflective', 'Conductive'],
            [INGREDIENT_FAMILIES.CREATURE_PARTS]: ['MonsterBits', 'Bone', 'Venom', 'Scale', 'Fur', 'Claw', 'Horn'],
            [INGREDIENT_FAMILIES.ENVIRONMENTAL]: ['Water', 'Fire', 'Earth', 'Air', 'Corrupted', 'Pure', 'Volatile']
        };
        
        // Component tags
        this._componentTags = [
            'Refined', 'Alloy', 'Stabilized', 'Binding', 'Reactive', 
            'Haft', 'Plate', 'Wire', 'Thread', 'Extract', 'Powder', 'Oil'
        ];
        
        // Essence/Affinity tags
        this._essenceTags = [
            'Heat', 'Cold', 'Electric', 'Light', 'Shadow', 
            'Time', 'Mind', 'Life', 'Death', 'Chaos', 'Order'
        ];
        
        // Quirk tags (optional modifiers)
        this._quirkTags = [
            'Volatile', 'Soothing', 'Stable', 'Reactive', 'Rare', 
            'Common', 'Bright', 'Dark', 'Sharp', 'Smooth'
        ];
        
        // Build reverse lookup maps
        this._tagToFamily = this._buildTagToFamilyMap();
        this._tagToCategory = this._buildTagToCategoryMap();
    }
    
    /**
     * Build reverse lookup map: tag -> family
     * @private
     * @returns {Map<string, string>}
     */
    _buildTagToFamilyMap() {
        const map = new Map();
        for (const [family, tags] of Object.entries(this._tagFamilies)) {
            for (const tag of tags) {
                map.set(tag.toLowerCase(), family);
            }
        }
        return map;
    }
    
    /**
     * Build reverse lookup map: tag -> category
     * @private
     * @returns {Map<string, string>}
     */
    _buildTagToCategoryMap() {
        const map = new Map();
        
        // Component tags are structural
        for (const tag of this._componentTags) {
            map.set(tag.toLowerCase(), TAG_CATEGORIES.STRUCTURAL);
        }
        
        // Essence tags are elements
        for (const tag of this._essenceTags) {
            map.set(tag.toLowerCase(), TAG_CATEGORIES.ELEMENT);
        }
        
        // Quirk tags are quirks
        for (const tag of this._quirkTags) {
            map.set(tag.toLowerCase(), TAG_CATEGORIES.QUIRK);
        }
        
        // Primary tags (first tag in family list is typically primary)
        for (const tags of Object.values(this._tagFamilies)) {
            if (tags.length > 0) {
                map.set(tags[0].toLowerCase(), TAG_CATEGORIES.PRIMARY);
            }
        }
        
        return map;
    }
    
    /**
     * Validate tags for an ingredient
     * @param {string} primaryTag - Primary tag
     * @param {string[]} secondaryTags - Secondary tags (1-2)
     * @param {string|null} quirk - Optional quirk
     * @returns {Object} { valid: boolean, errors: string[] }
     */
    validateIngredientTags(primaryTag, secondaryTags = [], quirk = null) {
        const errors = [];
        
        // Check primary tag
        if (!primaryTag || typeof primaryTag !== 'string' || primaryTag.trim() === '') {
            errors.push('Primary tag is required');
        }
        
        // Check secondary tags
        if (!Array.isArray(secondaryTags)) {
            errors.push('Secondary tags must be an array');
        } else if (secondaryTags.length < 1 || secondaryTags.length > 2) {
            errors.push('Must have 1-2 secondary tags');
        }
        
        // Count total tags
        const totalTags = 1 + (secondaryTags?.length || 0) + (quirk ? 1 : 0);
        if (totalTags < 2 || totalTags > 5) {
            errors.push(`Total tags must be 2-5 (got ${totalTags})`);
        }
        
        // Check for duplicate tags
        const allTags = [primaryTag, ...(secondaryTags || []), quirk].filter(t => t);
        const uniqueTags = new Set(allTags.map(t => t.toLowerCase()));
        if (uniqueTags.size !== allTags.length) {
            errors.push('Duplicate tags are not allowed');
        }
        
        // Validate tag format (should be noun/adjective, not verb)
        for (const tag of allTags) {
            if (!this.isValidTagFormat(tag)) {
                errors.push(`Tag "${tag}" may not be in valid format (should be noun/adjective)`);
            }
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
    
    /**
     * Validate tag format (basic check - should be noun/adjective, not verb)
     * @param {string} tag - Tag to validate
     * @returns {boolean} True if format appears valid
     */
    isValidTagFormat(tag) {
        if (!tag || typeof tag !== 'string') return false;
        
        // Basic checks:
        // - Should not end in common verb endings (ing, ed, etc.)
        // - Should be a single word or hyphenated word
        // - Should start with capital letter (convention)
        
        const trimmed = tag.trim();
        if (trimmed === '') return false;
        
        // Check for verb endings (simple heuristic)
        const verbEndings = ['ing', 'ed', 'ize', 'ise', 'ate'];
        const lowerTag = trimmed.toLowerCase();
        for (const ending of verbEndings) {
            if (lowerTag.endsWith(ending) && lowerTag.length > ending.length + 2) {
                // Allow some exceptions
                if (!['binding', 'healing', 'soothing'].includes(lowerTag)) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    /**
     * Get tag category (primary, secondary, quirk, element, structural)
     * @param {string} tag - Tag name
     * @returns {string|null} Category or null if unknown
     */
    getTagCategory(tag) {
        if (!tag) return null;
        return this._tagToCategory.get(tag.toLowerCase()) || TAG_CATEGORIES.SECONDARY;
    }
    
    /**
     * Get tag family (Herbs, Minerals, etc.)
     * @param {string} tag - Tag name
     * @returns {string|null} Family or null if unknown
     */
    getTagFamily(tag) {
        if (!tag) return null;
        return this._tagToFamily.get(tag.toLowerCase()) || null;
    }
    
    /**
     * Check if tag is a valid primary tag
     * @param {string} tag - Tag to check
     * @returns {boolean} True if valid primary tag
     */
    isPrimaryTag(tag) {
        return this.getTagCategory(tag) === TAG_CATEGORIES.PRIMARY;
    }
    
    /**
     * Check if tag is a valid secondary tag
     * @param {string} tag - Tag to check
     * @returns {boolean} True if valid secondary tag
     */
    isSecondaryTag(tag) {
        const category = this.getTagCategory(tag);
        return category === TAG_CATEGORIES.SECONDARY || category === TAG_CATEGORIES.PRIMARY;
    }
    
    /**
     * Check if tag is a valid quirk tag
     * @param {string} tag - Tag to check
     * @returns {boolean} True if valid quirk tag
     */
    isQuirkTag(tag) {
        return this.getTagCategory(tag) === TAG_CATEGORIES.QUIRK;
    }
    
    /**
     * Check if tag is an element/essence tag
     * @param {string} tag - Tag to check
     * @returns {boolean} True if element tag
     */
    isElementTag(tag) {
        return this.getTagCategory(tag) === TAG_CATEGORIES.ELEMENT;
    }
    
    /**
     * Check if tag is a structural/component tag
     * @param {string} tag - Tag to check
     * @returns {boolean} True if structural tag
     */
    isStructuralTag(tag) {
        return this.getTagCategory(tag) === TAG_CATEGORIES.STRUCTURAL;
    }
    
    /**
     * Get all tags for a family
     * @param {string} family - Ingredient family
     * @returns {string[]} Tags associated with family
     */
    getTagsForFamily(family) {
        return this._tagFamilies[family] || [];
    }
    
    /**
     * Get all known tags
     * @returns {string[]} All known tags
     */
    getAllTags() {
        const allTags = new Set();
        
        // Add ingredient family tags
        for (const tags of Object.values(this._tagFamilies)) {
            tags.forEach(tag => allTags.add(tag));
        }
        
        // Add component tags
        this._componentTags.forEach(tag => allTags.add(tag));
        
        // Add essence tags
        this._essenceTags.forEach(tag => allTags.add(tag));
        
        // Add quirk tags
        this._quirkTags.forEach(tag => allTags.add(tag));
        
        return Array.from(allTags).sort();
    }
    
    /**
     * Get tags by category
     * @param {string} category - Tag category
     * @returns {string[]} Tags in category
     */
    getTagsByCategory(category) {
        return this.getAllTags().filter(tag => this.getTagCategory(tag) === category);
    }
    
    /**
     * Suggest primary tag for a family
     * @param {string} family - Ingredient family
     * @returns {string|null} Suggested primary tag
     */
    suggestPrimaryTag(family) {
        const tags = this.getTagsForFamily(family);
        return tags.length > 0 ? tags[0] : null;
    }
    
    /**
     * Suggest secondary tags for a family
     * @param {string} family - Ingredient family
     * @param {string} primaryTag - Primary tag to exclude
     * @returns {string[]} Suggested secondary tags
     */
    suggestSecondaryTags(family, primaryTag) {
        const tags = this.getTagsForFamily(family);
        return tags.filter(tag => tag.toLowerCase() !== primaryTag?.toLowerCase()).slice(0, 2);
    }
    
    /**
     * Analyze tag combination for crafting
     * This is the base structure for tag combination logic (will be refined in Phase 2)
     * @param {string[]} tags - Combined tags from ingredients
     * @returns {Object} Analysis result
     */
    analyzeTagCombination(tags) {
        if (!Array.isArray(tags) || tags.length === 0) {
            return {
                valid: false,
                itemCategory: null,
                element: null,
                behavior: null,
                variant: null
            };
        }
        
        const normalizedTags = tags.map(t => t.toLowerCase());
        
        // Extract element tags
        const elementTags = normalizedTags.filter(t => this.isElementTag(t));
        const element = elementTags.length > 0 ? elementTags[0] : null;
        
        // Extract structural tags
        const structuralTags = normalizedTags.filter(t => this.isStructuralTag(t));
        const structural = structuralTags.length > 0 ? structuralTags[0] : null;
        
        // Determine item category from primary material tags
        let itemCategory = null;
        if (normalizedTags.includes('herb') || normalizedTags.includes('medicinal')) {
            itemCategory = 'Consumable';
        } else if (normalizedTags.includes('metal') || normalizedTags.includes('ore')) {
            itemCategory = 'Weapon';
        } else if (normalizedTags.includes('crystal') || normalizedTags.includes('arcane')) {
            itemCategory = 'ArcaneDevice';
        } else if (normalizedTags.includes('bone') || normalizedTags.includes('scale')) {
            itemCategory = 'Armor';
        }
        
        // Determine behavior from tags
        let behavior = null;
        if (normalizedTags.includes('medicinal') || normalizedTags.includes('soothing')) {
            behavior = 'healing';
        } else if (normalizedTags.includes('toxic') || normalizedTags.includes('venom')) {
            behavior = 'poison';
        } else if (normalizedTags.includes('volatile') || normalizedTags.includes('reactive')) {
            behavior = 'explosive';
        }
        
        // Determine variant
        const variant = this._determineVariant(normalizedTags);
        
        return {
            valid: itemCategory !== null,
            itemCategory: itemCategory,
            element: element,
            behavior: behavior,
            variant: variant,
            structural: structural
        };
    }
    
    /**
     * Determine variant from tags
     * @private
     * @param {string[]} normalizedTags - Normalized tag array
     * @returns {string|null} Variant name
     */
    _determineVariant(normalizedTags) {
        // Variants based on tag combinations
        if (normalizedTags.includes('floral') && normalizedTags.includes('medicinal')) {
            return 'Floral';
        }
        if (normalizedTags.includes('volatile') && normalizedTags.includes('crystal')) {
            return 'Unstable';
        }
        if (normalizedTags.includes('refined') && normalizedTags.includes('alloy')) {
            return 'Masterwork';
        }
        
        return null;
    }
    
    /**
     * Get tag metadata (category, family, description)
     * @param {string} tag - Tag name
     * @returns {Object} Tag metadata
     */
    getTagMetadata(tag) {
        if (!tag) return null;
        
        return {
            name: tag,
            category: this.getTagCategory(tag),
            family: this.getTagFamily(tag),
            isPrimary: this.isPrimaryTag(tag),
            isSecondary: this.isSecondaryTag(tag),
            isQuirk: this.isQuirkTag(tag),
            isElement: this.isElementTag(tag),
            isStructural: this.isStructuralTag(tag)
        };
    }
}

// Create singleton instance
let tagManagerInstance = null;

/**
 * Get the TagManager singleton instance
 * @returns {TagManager}
 */
export function getTagManager() {
    if (!tagManagerInstance) {
        tagManagerInstance = new TagManager();
    }
    return tagManagerInstance;
}
