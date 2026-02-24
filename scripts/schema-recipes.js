// ================================================================== 
// ===== RECIPE SCHEMA DEFINITIONS ==================================
// ================================================================== 

/**
 * Recipe ingredient requirement. Uses TYPE > FAMILY (architecture-artificer.md).
 * @typedef {Object} RecipeIngredient
 * @property {string} type - TYPE: 'Component' | 'Creation' | 'Tool' (top-level Artificer bucket). Legacy ingredient/component/essence normalize to Component.
 * @property {string} [family] - Optional FAMILY within type (e.g. Plant, Essence, Potion, Apparatus). Identity within type.
 * @property {string} name - Item name (resolved at runtime from item cache).
 * @property {number} quantity - Required quantity
 * @description Artificer items match by TYPE (+ optional family) and name. Normal D&D items (no Artificer flags) match by name only.
 */

/**
 * @typedef {Object} ArtificerRecipe
 * @property {string} id - Unique identifier (UUID)
 * @property {string} name - Recipe name
 * @property {string} type - Item type (Weapon, Armor, Consumable, Tool, Gadget, Trinket, ArcaneDevice)
 * @property {string} category - Category within type (e.g., "Potion" for Consumable)
 * @property {string} skill - Required skill (see CRAFTING_SKILLS; must match skills-details.json ids)
 * @property {number} skillLevel - Minimum skill level required (0–20). Default 1.
 * @property {number|null} heat - (Legacy) Heat level 0–3. Prefer processType + processLevel.
 * @property {string|null} processType - Process type: 'heat' | 'grind' (null = any / legacy heat)
 * @property {number|null} processLevel - Process level 0–3: heat 0=Off,1=Low,2=Medium,3=High; grind 0=Off,1=Coarse,2=Medium,3=Fine (null = any)
 * @property {number|null} time - Process time in seconds. Duration of the crafting process. Not derived from workHours.
 * @property {string|null} apparatusName - Apparatus item name: vessel to craft in (beaker, mortar, crucible). Resolved at runtime.
 * @property {string|null} containerName - Container item name: vessel to put result in (vial, flask, herb bag). Resolved at runtime.
 * @property {string|null} skillKit - Required kit for this skill (e.g. Alchemist's Supplies, Herbalism Kit). Actor must have in inventory.
 * @property {number|null} goldCost - Cost to make in gp after ingredient deduction (Phase 2)
 * @property {number|null} workHours - In-game duration (hours to craft). Separate from time; not a translation.
 * @property {RecipeIngredient[]} ingredients - Required ingredients (TYPE + optional family + name + quantity)
 * @property {string} resultItemName - Name of resulting item. Resolved at runtime via compendia + world.
 * @property {string[]} traits - Recipe traits (modifiers; do not repeat type/family). Legacy "tags" map to traits.
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
 * Crafting Skills (ids must match resources/skills-details.json)
 * @enum {string}
 */
export const CRAFTING_SKILLS = {
    HERBALISM: 'Herbalism',
    ALCHEMY: 'Alchemy',
    POISONCRAFT: 'Poisoncraft',
    COOKING: 'Cooking',
    SMITHING: 'Smithing',
    LEATHERWORKING: 'Leatherworking',
    TINKERING: 'Tinkering',
    CARTOGRAPHY: 'Cartography',
    INSCRIPTION: 'Inscription',
    ENCHANTING: 'Enchanting',
    GEMCRAFT: 'Gemcraft',
    TAILORING: 'Tailoring',
    MASONRY: 'Masonry'
};

/** Skill level range for recipes and components (gathering). Default 1. */
export const SKILL_LEVEL_MIN = 0;
export const SKILL_LEVEL_MAX = 20;

/** Heat levels for temperature slider: 0=Off, 1=Low, 2=Medium, 3=High */
export const HEAT_LEVELS = { 0: 'Off', 1: 'Low', 2: 'Medium', 3: 'High' };
/** Grind levels: 0=Off, 1=Coarse, 2=Medium, 3=Fine */
export const GRIND_LEVELS = { 0: 'Off', 1: 'Coarse', 2: 'Medium', 3: 'Fine' };
export const HEAT_MIN = 0;
export const HEAT_MAX = 3;

/** Process types for crafting (heat vs grind); used with processLevel 0–3 */
export const PROCESS_TYPES = ['heat', 'grind'];

