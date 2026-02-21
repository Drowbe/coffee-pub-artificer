// ================================================================== 
// ===== ARTIFICER INGREDIENT MODEL ================================
// ================================================================== 

import { MODULE } from '../../const.js';
import { postDebug, postError } from '../../utils/helpers.js';
import { INGREDIENT_FAMILIES, INGREDIENT_RARITIES } from '../../schema-ingredients.js';
import { getArtificerTypeFromFlags, getFamilyFromFlags, getTraitsFromFlags } from '../../utility-artificer-item.js';
import { ARTIFICER_TYPES, FAMILIES_BY_TYPE, ARTIFICER_FLAG_KEYS } from '../../schema-artificer-item.js';

/**
 * ArtificerIngredient - Raw material data model
 * Represents ingredients stored as FoundryVTT Items with artificer flags.
 * Supports both new (type/family/traits) and legacy (ingredient + primaryTag/secondaryTags/quirk) flags.
 */
export class ArtificerIngredient {
    /**
     * Create an ArtificerIngredient from a FoundryVTT Item
     * @param {Item} item - FoundryVTT Item document
     * @returns {ArtificerIngredient|null} Parsed ingredient or null if not a component (ingredient)
     */
    static fromItem(item) {
        if (!item) return null;
        const flags = item.flags?.[MODULE.ID] ?? item.flags?.artificer;
        const type = getArtificerTypeFromFlags(flags);
        const family = getFamilyFromFlags(flags);
        const traits = getTraitsFromFlags(flags) ?? [];
        const flagType = flags?.[ARTIFICER_FLAG_KEYS.TYPE] ?? flags?.type;
        const isLegacyIngredient = flagType === 'ingredient';
        const isComponent = type === ARTIFICER_TYPES.COMPONENT;
        if (!isComponent && !isLegacyIngredient) return null;
        const primaryTag = traits[0] ?? flags?.primaryTag ?? '';
        const secondaryTags = traits.length > 1 ? traits.slice(1) : (Array.isArray(flags?.secondaryTags) ? flags.secondaryTags : []);
        const quirk = flags?.[ARTIFICER_FLAG_KEYS.QUIRK] ?? flags?.quirk ?? null;
        const flagFamily = flags?.[ARTIFICER_FLAG_KEYS.FAMILY] ?? flags?.family;
        const flagTier = flags?.[ARTIFICER_FLAG_KEYS.SKILL_LEVEL] ?? flags?.skillLevel ?? flags?.tier;
        const flagBiomes = flags?.[ARTIFICER_FLAG_KEYS.BIOMES] ?? flags?.biomes;
        const itemRarity = (item.system?.rarity ?? '').trim();
        return new ArtificerIngredient({
            id: item.uuid,
            name: item.name,
            family: family || flagFamily || INGREDIENT_FAMILIES.HERBS,
            tier: Math.max(1, parseInt(flagTier, 10) || 1),
            rarity: itemRarity || INGREDIENT_RARITIES.COMMON,
            primaryTag,
            secondaryTags,
            quirk,
            biomes: Array.isArray(flagBiomes) ? flagBiomes : [],
            description: item.system?.description?.value ?? '',
            image: item.img ?? null,
            source: item.compendium?.collection?.metadata?.id ?? null
        });
    }
    
    /**
     * Create an ArtificerIngredient from a cache record (no Item fetch).
     * Use when loading from persisted cache to avoid compendium hits.
     * @param {Object} record - Cache record { uuid, name, img, family, tags, tier, rarity, source, artificerType }
     * @returns {ArtificerIngredient|null} Parsed ingredient or null if not an ingredient
     */
    static fromRecord(record) {
        if (!record?.uuid) return null;
        const type = record.artificerType;
        const isIngredient = type === 'ingredient' || type === 'Component';
        if (!isIngredient) return null;
        const tags = Array.isArray(record.tags) ? record.tags : [];
        return new ArtificerIngredient({
            id: record.uuid,
            name: record.name ?? '',
            family: record.family ?? INGREDIENT_FAMILIES.HERBS,
            tier: Math.max(1, record.tier ?? 1),
            rarity: record.rarity ?? INGREDIENT_RARITIES.COMMON,
            primaryTag: tags[0] ?? '',
            secondaryTags: tags.slice(1) ?? [],
            quirk: null,
            biomes: [],
            description: '',
            image: record.img ?? null,
            source: record.source ?? null
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
        const componentFamilies = FAMILIES_BY_TYPE[ARTIFICER_TYPES.COMPONENT] ?? [];
        const legacyFamilies = Object.values(INGREDIENT_FAMILIES);
        const validFamily = componentFamilies.includes(this.family) || legacyFamilies.includes(this.family);
        if (!validFamily) {
            postDebug(MODULE.NAME, `Invalid ingredient family: ${this.family}. Defaulting to ${INGREDIENT_FAMILIES.HERBS}`);
            this.family = INGREDIENT_FAMILIES.HERBS;
        }
        
        // Validate rarity
        if (!Object.values(INGREDIENT_RARITIES).includes(this.rarity)) {
            postDebug(MODULE.NAME, `Invalid ingredient rarity: ${this.rarity}. Defaulting to ${INGREDIENT_RARITIES.COMMON}`);
            this.rarity = INGREDIENT_RARITIES.COMMON;
        }
        
        // Validate tier (1-10)
        if (typeof this.tier !== 'number' || this.tier < 1 || this.tier > 10) {
            postDebug(MODULE.NAME, `Invalid ingredient tier: ${this.tier}. Defaulting to 1`);
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
            postDebug(MODULE.NAME, `Ingredient ${this.name} has ${totalTags} tags. Should have 2-5 tags.`);
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
            postError(MODULE.NAME, 'ArtificerIngredient: Missing id');
            return false;
        }
        if (!this.name) {
            postError(MODULE.NAME, 'ArtificerIngredient: Missing name');
            return false;
        }
        if (!this.primaryTag) {
            postError(MODULE.NAME, 'ArtificerIngredient: Missing primaryTag');
            return false;
        }
        return true;
    }
}
