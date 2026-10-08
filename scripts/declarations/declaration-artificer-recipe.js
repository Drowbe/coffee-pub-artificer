// ==================================================================
// ===== ARTIFICER RECIPE DECLARATION ================================
// ==================================================================
// Our recipe subtype, declared to Blacksmith's importer as a MAPPED PROFILE --
// built via `declarationFromModel`, not hand-transcribed.
//
// TRACK A, NOT TRACK B. This declaration exists so `buildDocumentData` can
// construct a recipe page's `system` data for us; it does NOT hand destination
// or window ownership to Blacksmith. We still call `createEmbeddedDocuments`
// ourselves, with our own settings-driven journal/folder resolution
// (`recipeJournalName`/`recipeJournalFolder`) -- unchanged. See
// documentation/plans/plan-recipe-field-mappings.md for why: our destination is
// GM-configurable per world, and neither of Blacksmith's `containerName` /
// `containerNameFrom` resolves from a world setting.
//
// WHY declarationFromModel AND NOT A HAND FIELD TABLE. RecipePageModel already
// IS the schema -- writing `fields: [...]` by hand would be a second copy that
// silently drifts the first time someone adds a model field and forgets the
// declaration, which is exactly the class of bug the whole declaration model
// exists to remove (see CHANGELOG: buildItemSystem's retirement, same reasoning
// for items). `declarationFromModel` walks the schema for type/required/
// nullable/default/values/nesting; only `guidance` and `examples` -- prose a
// schema cannot carry -- are ours to supply, keyed by dotted path.
//
// WHY processType/skill HAVE NO `values` HERE, AND MUST NOT GET THEM. Neither
// field declares `choices` on RecipePageModel, deliberately -- both vocabularies
// are runtime-configurable (a process is an item a GM can author; a crafting
// skill comes from a world's skills-mapping JSON) and a fixed `values` list
// would reject legitimate recipes in any world that differs from ours. Because
// `declarationFromModel`'s `values` comes ONLY from a field's own `choices`,
// this falls out correctly with no special-casing here -- do not patch `values`
// onto these two after the fact.
//
// name AND description ARE NOT HANDLED HERE. Both live outside `system` --
// `name` is the page's own title, `description` is the page's native
// `text.content` (ProseMirror), not a RecipePageModel field at all. Left out of
// this first declaration deliberately, to keep the first `buildDocumentData`
// call minimal and its returned shape easy to read. Revisit once we know what
// that call actually returns -- see the harness check.
// ==================================================================

import { RecipePageModel, RECIPE_PAGE_TYPE } from '../data/models/model-recipe-page.js';
import { MODULE } from '../const.js';

/**
 * Guidance text per dotted `system.*` path. Not generated -- a schema field
 * carries no authoring prose, so every sentence here is the only place that
 * prose exists. Condensed from the behavioural notes in
 * documentation/plans/plan-recipe-field-mappings.md; keep the two in step.
 */
const RECIPE_GUIDANCE = {
    resultItemName: 'The item this recipe produces, by name -- never a UUID. Falls back to the recipe name if left blank.',
    traits: 'Two to five tags describing what this recipe is good for. Drive recipe matching; not validated against a fixed list.',
    'ingredients.type': 'Component, Creation, or Tool -- what kind of item this ingredient is.',
    'ingredients.family': 'Optional. Narrows the match within type (e.g. Plant, Mineral).',
    'ingredients.name': 'The ingredient item, by name.',
    'ingredients.quantity': 'How many of this ingredient the recipe consumes. Defaults to 1.',
    type: 'The crafted result\'s D&D 5e item type.',
    category: 'Free text within type, such as "Potion".',
    rarity: 'Common, Uncommon, Rare, Very Rare, or Legendary. Leave blank if not stated.',
    skill: 'The crafting skill id this recipe is rolled against. Must be an id enabled in the world\'s skills mapping -- not validated against a fixed list, since that mapping is per-world.',
    skillLevel: 'Crafting difficulty, 0 to 20.',
    skillKit: 'The tool kit required in inventory at craft time, such as "Alchemist\'s Supplies".',
    processType: 'The crafting process this recipe uses, by process item name -- not validated against a fixed list, since processes are GM-authored items.',
    processLevel: 'Process intensity, 0 to 3. What each position means is defined by the process itself.',
    time: 'Process duration in seconds, up to 120.',
    apparatusName: 'The vessel this is crafted IN (a beaker, a mortar), by name. Distinct from the container.',
    containerName: 'The vessel the result goes INTO (a vial, a flask), by name. Distinct from the apparatus -- do not conflate the two; that was a real bug in the legacy importer.',
    goldCost: 'Gold cost after ingredient deduction.',
    workHours: 'In-game hours to craft.',
    successDC: 'Crafting roll DC, 1 to 30.',
    source: 'Free-text attribution. Left blank, not defaulted -- a default here would invent an attribution nobody gave.',
    license: 'Free-text license note.'
};

const RECIPE_EXAMPLES = {
    resultItemName: 'Potion of Healing',
    traits: ['Herbal', 'Medicinal'],
    ingredients: [{ type: 'Component', family: 'Plant', name: 'Sunleaf', quantity: 2 }],
    type: 'Consumable',
    category: 'Potion',
    rarity: 'Common',
    skill: 'Alchemy',
    skillLevel: 1,
    processType: 'Heat',
    processLevel: 1,
    time: 30,
    apparatusName: 'Mortar',
    containerName: 'Vial'
};

/**
 * Build the recipe declaration. A FUNCTION, not a module-scope constant --
 * `declarationFromModel` itself lives on the Blacksmith API, which does not
 * exist at module-evaluation time (same reasoning as every other declaration
 * in this module; see declaration-artificer-item-group.js).
 *
 * @param {object} blacksmithApi
 * @returns {object|null} The declaration, or null if this Blacksmith has no
 *   `declarationFromModel`.
 */
export function buildArtificerRecipeDeclaration(blacksmithApi) {
    const fromModel = blacksmithApi?.importer?.declarationFromModel;
    if (typeof fromModel !== 'function') return null;
    return fromModel(RecipePageModel.schema, {
        kind: 'journal',
        id: 'recipe',
        label: 'Artificer Recipe',
        module: MODULE.ID,
        document: { documentName: 'JournalEntryPage', type: RECIPE_PAGE_TYPE },
        guidance: RECIPE_GUIDANCE,
        examples: RECIPE_EXAMPLES
    });
}

/**
 * Register the recipe declaration, if this Blacksmith offers the API.
 *
 * Called from `ready`, same timing and same absence-is-not-an-error reasoning
 * as `registerArtificerItemFieldGroup` -- the importer registry's placeholders
 * clear during Blacksmith's `init`, and an older Blacksmith without
 * `registerDeclaration`/`declarationFromModel` simply does not get this,
 * Artificer keeps working without it.
 *
 * @param {object} blacksmithApi
 * @returns {boolean} Whether the declaration registered.
 */
export function registerArtificerRecipeDeclaration(blacksmithApi) {
    const register = blacksmithApi?.importer?.registerDeclaration;
    if (typeof register !== 'function') return false;
    const declaration = buildArtificerRecipeDeclaration(blacksmithApi);
    if (!declaration) return false;
    blacksmithApi.importer.registerDeclaration(declaration);
    return true;
}
