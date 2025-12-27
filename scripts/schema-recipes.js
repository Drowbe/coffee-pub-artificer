// ================================================================== 
// ===== RECIPE SCHEMA DEFINITIONS ==================================
// ================================================================== 

/**
 * Recipe ingredient requirement
 * @typedef {Object} RecipeIngredient
 * @property {string} type - Type: 'ingredient', 'component', or 'essence'
 * @property {string} name - Ingredient/component/essence name (reference)
 * @property {number} quantity - Required quantity
 */

/**
 * @typedef {Object} ArtificerRecipe
 * @property {string} id - Unique identifier (UUID)
 * @property {string} name - Recipe name
 * @property {string} type - Item type (Weapon, Armor, Consumable, Tool, Gadget, Trinket, ArcaneDevice)
 * @property {string} category - Category within type (e.g., "Potion" for Consumable)
 * @property {string} skill - Required skill (Herbalism, Metallurgy, Artifice, Alchemy, MonsterHandling)
 * @property {number} skillLevel - Minimum skill level required
 * @property {string|null} workstation - Required workstation (if any)
 * @property {RecipeIngredient[]} ingredients - Required ingredients/components/essences
 * @property {string} resultItemUuid - UUID of resulting item (Item document UUID)
 * @property {string[]} tags - Recipe tags
 * @property {string} description - Recipe description/notes
 * @property {string} source - Source journal UUID
 * @property {string} journalPageId - Journal page ID within source journal
 */

/**
 * Item Types (D&D 5e compatible)
 * @enum {string}
 */
export const ITEM_TYPES = {
    WEAPON: 'Weapon',
    ARMOR: 'Armor',
    CONSUMABLE: 'Consumable',
    TOOL: 'Tool',
    GADGET: 'Gadget',
    TRINKET: 'Trinket',
    ARCANE_DEVICE: 'ArcaneDevice'
};

/**
 * Crafting Skills
 * @enum {string}
 */
export const CRAFTING_SKILLS = {
    HERBALISM: 'Herbalism',
    METALLURGY: 'Metallurgy',
    ARTIFICE: 'Artifice',
    ALCHEMY: 'Alchemy',
    MONSTER_HANDLING: 'MonsterHandling'
};

