// ==================================================================
// ===== POTION BREWING & INGREDIENT GATHERING (GM Binder PDF) =====
// ==================================================================
// Recipe name (normalized lowercase) → { rarity, skill }.
// Used by applyPotionBrewingData to set RARITY, SKILLLEVEL, SUCCESSDC on recipe journal pages.
// Source: Potion Brewing and Ingredient Gathering for DnD 5e (Piccolo917), GM Binder.
// Alchemist's Supplies: 40 | Herbalism Kit: 39 | Poisoner's Kit: 39

function entry(rarity, skill) {
    return { rarity, skill };
}

const A = "Alchemy";
const H = "Herbalism";
const P = "Poisoncraft";

/** @type {Record<string, { rarity: string, skill: string }>} */
const POTION_BREWING_RECIPE_DATA = {
    // ---------- Alchemist's Supplies ----------
    "alchemist's fire": entry("common", A),
    "bottled breath": entry("common", A),
    "blasting powder": entry("common", A),
    "fake blood": entry("common", A),
    "grenade, smoke": entry("common", A),
    "smoke grenade": entry("common", A),
    "ink, spell writing (common)": entry("common", A),
    "spell writing ink (common)": entry("common", A),
    "potion of climbing": entry("common", A),
    "potion of swimming": entry("common", A),
    "soothsalts": entry("common", A),
    "ink, spell writing (uncommon)": entry("uncommon", A),
    "spell writing ink (uncommon)": entry("uncommon", A),
    "invisible ink": entry("uncommon", A),
    "lesser potion of mana": entry("uncommon", A),
    "midnight oil": entry("uncommon", A),
    "oil of slipperiness": entry("uncommon", A),
    "elemental droplet": entry("uncommon", A),
    "water elemental droplet": entry("uncommon", A),
    "pixie dust": entry("uncommon", A),
    "potion of animal friendship": entry("uncommon", A),
    "potion of fire breath": entry("uncommon", A),
    "potion of growth": entry("uncommon", A),
    "potion of resistance": entry("uncommon", A),
    "potion of waterbreathing": entry("uncommon", A),
    "potion of water breathing": entry("uncommon", A),
    "ink, spell writing (rare)": entry("rare", A),
    "spell writing ink (rare)": entry("rare", A),
    "oil of dragon's bane": entry("rare", A),
    "potion of aqueous form": entry("rare", A),
    "potion of gaseous form": entry("rare", A),
    "potion of giant strength": entry("rare", A),
    "potion of mana": entry("rare", A),
    "potion of true dreaming": entry("rare", A),
    "oil of etherealness": entry("rare", A),
    "potion of clairvoyance": entry("rare", A),
    "potion of diminution": entry("rare", A),
    "potion of heroism": entry("rare", A),
    "potion of invulnerability": entry("rare", A),
    "potion of mind reading": entry("rare", A),
    "thor's might": entry("rare", A),
    "ink, spell writing (very rare)": entry("very rare", A),
    "spell writing ink (very rare)": entry("very rare", A),
    "oil of sharpness": entry("very rare", A),
    "potion of flying": entry("very rare", A),
    "potion of invisibility": entry("very rare", A),
    "potion of longevity": entry("very rare", A),
    "potion of possibility": entry("very rare", A),
    "potion of speed": entry("very rare", A),
    "potion of truesight": entry("very rare", A),
    "superior potion of mana": entry("very rare", A),

    // ---------- Herbalism Kit ----------
    "antitoxin": entry("common", H),
    "potion of healing": entry("common", H),
    "muroosa balm": entry("common", H),
    "pepper peppers": entry("common", H),
    "potion of plantspeak": entry("common", H),
    "soothing salve": entry("common", H),
    "quenching pilther": entry("common", H),
    "willowshade oil": entry("common", H),
    "blight ichor": entry("uncommon", H),
    "brew of babel": entry("uncommon", H),
    "fire balm": entry("uncommon", H),
    "forgetfulness antidote": entry("uncommon", H),
    "greater antitoxin": entry("uncommon", H),
    "keoghtom's restorative ointment": entry("uncommon", H),
    "keoghtom's ointment": entry("uncommon", H),
    "life's liquor": entry("uncommon", H),
    "murgaxor's elixir of life": entry("uncommon", H),
    "pomander of warding": entry("uncommon", H),
    "potion of advantage": entry("uncommon", H),
    "potion of greater healing": entry("uncommon", H),
    "potion of maximum power": entry("uncommon", H),
    "potion of shapeshifting": entry("uncommon", H),
    "tea of refreshment": entry("uncommon", H),
    "thessaltoxin antidote": entry("uncommon", H),
    "bottled rest": entry("rare", H),
    "elixir of health": entry("rare", H),
    "liquid luck": entry("rare", H),
    "meditative rest": entry("rare", H),
    "polymorph potion": entry("rare", H),
    "potion of restoration": entry("rare", H),
    "potion of revival": entry("rare", H),
    "potion of superior healing": entry("rare", H),
    "tincture of werewolf's bane": entry("rare", H),
    "reincarnation dust": entry("very rare", H),
    "potion of continuous healing": entry("very rare", H),
    "potion of enhanced reactions": entry("very rare", H),
    "potion of legendary resistance": entry("very rare", H),
    "potion of protection": entry("very rare", H),
    "potion of supreme healing": entry("very rare", H),
    "potion of vitality": entry("very rare", H),
    "vampiric essence": entry("very rare", H),

    // ---------- Poisoner's Kit ----------
    "acid tablets": entry("common", P),
    "basic poison": entry("common", P),
    "biza's breath": entry("common", P),
    "bizas breath": entry("common", P),
    "dazzling bomb": entry("common", P),
    "liquid paranoia": entry("common", P),
    "nausea pellet": entry("common", P),
    "perfume of bewitching": entry("common", P),
    "angel's powder": entry("uncommon", P),
    "assassin's blood": entry("uncommon", P),
    "assassins blood": entry("uncommon", P),
    "bane berry extract": entry("uncommon", P),
    "black paste": entry("uncommon", P),
    "directed delay": entry("uncommon", P),
    "lava paste": entry("uncommon", P),
    "malice": entry("uncommon", P),
    "noxious transpiration": entry("uncommon", P),
    "pale tincture": entry("uncommon", P),
    "philter of love": entry("uncommon", P),
    "potion of poison": entry("uncommon", P),
    "truth serum": entry("uncommon", P),
    "taratella: the great humiliator": entry("uncommon", P),
    "taratella the great humiliator": entry("uncommon", P),
    "burnt othur fumes": entry("rare", P),
    "devil's powder": entry("rare", P),
    "devils powder": entry("rare", P),
    "drow poison": entry("rare", P),
    "essence of ether": entry("rare", P),
    "dracula's essence": entry("rare", P),
    "draculas essence": entry("rare", P),
    "forgetfulness": entry("rare", P),
    "fire plague": entry("rare", P),
    "magebane": entry("rare", P),
    "magic's bane": entry("rare", P),
    "magics bane": entry("rare", P),
    "oil of taggit": entry("rare", P),
    "thessaltoxin": entry("rare", P),
    "torpor": entry("rare", P),
    "armourer's blight": entry("very rare", P),
    "armourers blight": entry("very rare", P),
    "coup de poudre": entry("very rare", P),
    "medusa's vengeance": entry("very rare", P),
    "medusas vengeance": entry("very rare", P),
    "black thistle poison": entry("very rare", P),
    "deathsleep": entry("very rare", P),
    "essence of rage": entry("very rare", P),
    "midnight tears": entry("very rare", P),
    "sandman's revenge": entry("very rare", P),
    "sandmans revenge": entry("very rare", P),
    "night hag's curse": entry("very rare", P),
    "night hags curse": entry("very rare", P),
    "water of death": entry("very rare", P)
};

/**
 * Normalize recipe or result name for lookup: lowercase, trim, remove asterisks.
 * @param {string} name
 * @returns {string}
 */
export function normalizeRecipeNameForLookup(name) {
    if (name == null || typeof name !== 'string') return '';
    return name.replace(/\s*\*\s*$/g, '').trim().toLowerCase();
}

/**
 * Get rarity and skill for a recipe by name or result name. Returns null if not in PDF data.
 * @param {string} recipeName
 * @param {string} [resultName]
 * @returns {{ rarity: string, skill: string } | null}
 */
export function getPotionBrewingData(recipeName, resultName) {
    const a = normalizeRecipeNameForLookup(recipeName);
    const b = resultName ? normalizeRecipeNameForLookup(resultName) : '';
    return POTION_BREWING_RECIPE_DATA[a] ?? POTION_BREWING_RECIPE_DATA[b] ?? null;
}

export default POTION_BREWING_RECIPE_DATA;
