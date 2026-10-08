// ==================================================================
// ===== ARTIFICER RECIPE DECLARATION ================================
// ==================================================================
// Our recipe subtype, declared to Blacksmith's importer as a MAPPED PROFILE --
// built via `declarationFromModel`, not hand-transcribed.
//
// TRACK B: Blacksmith's Unified Import window is the ONLY way a recipe is
// imported. We do not keep a separate Artificer import window -- recipes work
// exactly like items already do (a declared profile/field group, imported
// entirely through Blacksmith's own UI, nothing bespoke on our side). See
// documentation/plans/plan-recipe-field-mappings.md for the full history: this
// started as Track A (construction only, keep our own window) and was
// explicitly widened to Track B by the author once it was clear items never
// had a separate Artificer window either.
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
// EXTRA FIELDS -- what the model cannot express, same shape as Bibliosoph's
// injury-import-profile.js (INJURY_EXTRA_FIELDS):
// - `journaltype` (role: 'selector') is how the Unified Import window routes a
//   payload to this profile at all. Required at the import boundary, forbidden
//   at the authoring boundary -- RecipePageModel must never carry it.
// - `title` -> `path: 'name'`. The recipe name is the page title, never stored
//   twice (see RecipePageModel's `get name()`), so it is a page-level path
//   rather than a system one and cannot come from the schema walk.
// - `description` -> `path: 'text.content'`. The free-form notes live in the
//   page's native ProseMirror content (RecipePageModel's `get description()`),
//   not a system field either. `writePath()` in Blacksmith's assembler is a
//   plain dotted-path setter, not restricted to `system.*`, so this works the
//   same way `path: 'name'` does.
// - `book` (role: 'input') names the JournalEntry (the recipe BOOK) this
//   recipe files into. Not document data and not derivable -- it is where the
//   containing entry goes, not a value on the page -- so it never lands on a
//   path, exactly like Blacksmith's own three journal profiles declare
//   `foldername`.
//
// DESTINATION: `containerNameFrom: 'book'`, `folderNameFrom: 'skill'`. The
// world's actual organisation (confirmed against a live screenshot, not
// assumed): folder = skill (Alchemy, Herbalism, Poisoncraft, ...), journal =
// a recipe book inside that folder, page = one recipe, several books per
// skill allowed. `skill` is already a declared model field (`system.skill`),
// and the same field name can be both a normal path AND a folderNameFrom
// source -- Blacksmith's destination resolution reads the raw entry value by
// field name, independent of what assemble() writes into `system`.
//
// NO containerName CONSTANT, and no `document.containerName` placeholder
// either -- that was a Track-A-only workaround for a registry requirement we
// now satisfy for real via `containerNameFrom`. Do not reintroduce it; the
// registry rejects declaring both.
//
// NO image field. Unlike Bibliosoph's injuries (which store `system.image`),
// RecipePageModel has none -- every icon shown on a recipe page is resolved at
// RENDER TIME, by name, from the item cache (sheet-recipe-page.js
// `cachedImages()`), not stored on the recipe itself. Confirmed by reading the
// sheet; nothing to declare here.
//
// FOLDER CASING: no transform, none needed. `ensureJournalFolder`
// (Blacksmith's utility-journal-destination.js) matches an EXISTING folder
// case-insensitively and creates a new one verbatim -- a folder transform was
// tried before, it mangled proper nouns, and was removed on purpose. A `skill`
// value differing only in case from an existing folder still files correctly;
// only a skill with NO existing folder yet creates one spelled however that
// recipe's `skill` value was spelled. Not a mechanism gap -- confirmed with
// Blacksmith directly, do not add `folderNameTransform` (it does not exist).
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
    skill: 'The crafting skill this recipe is rolled against, and the folder its book files into (e.g. "Alchemy"). Must be an id enabled in the world\'s skills mapping -- not validated against a fixed list, since that mapping is per-world.',
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
 * What RecipePageModel's schema cannot express -- the page name, the page's
 * own body text, how the payload selects this profile, and which book it
 * files into. Same shape as Bibliosoph's INJURY_EXTRA_FIELDS.
 */
const RECIPE_EXTRA_FIELDS = [
    {
        name: 'journaltype',
        role: 'selector',
        type: 'string',
        values: ['recipe'],
        example: 'recipe',
        guidance: 'Identifies the profile, and must be exactly "recipe".'
    },
    {
        name: 'title',
        path: 'name',
        type: 'string',
        required: true,
        example: 'Potion of Healing',
        guidance: 'The recipe\'s name, which becomes the page title.'
    },
    {
        name: 'description',
        path: 'text.content',
        type: 'string',
        example: '<p>A quick restorative brew.</p>',
        guidance: 'Free-form notes and instructions, as HTML. Stored as the page\'s own body text, not a system field -- weave the other fields into prose rather than repeating them as a list.'
    },
    {
        name: 'book',
        role: 'input',
        type: 'string',
        required: true,
        example: 'Treatise on Common Transmutations',
        guidance: 'The recipe book (journal) this recipe is filed into, created if it does not exist. Several books per skill is normal -- do not invent one name for every recipe of a given skill.'
    }
];

/**
 * Profile-level framing a per-field `guidance` sentence cannot carry: the generator role,
 * the two-step JSON-then-image process, and relationships BETWEEN fields rather than within
 * one. Renders before the FIELDS list in the generation prompt and after the rules in the
 * authoring guide (Blacksmith's `preamble` support, 2026-10-08). Does not restate the field
 * list -- each field's own `guidance` already does that.
 *
 * Condensed from `prompts/artificer-recipe.txt`'s framing section, which this preamble
 * replaces for anyone using the Unified Import window; the file itself is left alone for the
 * macro/manual-paste use it still serves.
 */
const RECIPE_PREAMBLE = 'You are a Dungeon Master designing a crafting recipe for the Coffee '
    + 'Pub Artificer module. Generate the recipe JSON first; only after it is complete, ask '
    + 'whether an image should be generated for the result -- do not generate or describe an '
    + 'image before the JSON is confirmed. Several fields describe the same recipe from '
    + 'different angles and should agree with each other: skillLevel should rise with rarity '
    + '(roughly common 0-3, uncommon 4-9, rare 10-14, very rare 15-19, legendary 20), and '
    + 'successDC should rise with skillLevel on a similar curve, not be chosen independently. '
    + 'A recipe\'s category is a subtype of its type (for example "Potion" for a Consumable) -- '
    + 'choose category only after type, never before, and do not assume a category vocabulary '
    + 'for a type this sentence does not name; ask rather than guess one. An ingredient\'s '
    + 'family is similarly a subtype of its own type, not of the recipe\'s type. Weave apparatus, '
    + 'container, process and timing into the description as part of how the recipe is made, '
    + 'rather than treating them as isolated facts. Ingredient and result names must come from '
    + 'the AVAILABLE ITEMS list when it is present -- the author can turn that list off, so do '
    + 'not assume it is always there. Traits are two to five tags describing what the recipe is '
    + 'good for -- do not repeat type or category as a trait.';

/**
 * Named catalogs to offer on the recipe prompt. ONLY 'actors' and 'items' are legal -- these
 * select Blacksmith's EXISTING Area-style catalog UI (per-compendium checkboxes with Select
 * All/None, a remembered selection, a World section) rather than declaring our own shape. The
 * object form `{ id, label, type, includeWorld }` was a first draft the author rejected: Area's
 * prompt already has this exact pattern and a declared profile must reuse it, not reinvent a
 * second one. Corrected 2026-10-09, same day it was first added.
 *
 * Source is the GM's Blacksmith Compendium Mapping (plus world items, via the same checkboxes
 * Area uses) -- NOT our own `ingredientCompendium1..N` settings. That split is a deliberate
 * author decision: our settings resolve ingredients and results at CRAFT time, a different
 * purpose from authoring/import, and conflating the two would mean a GM's narrower crafting pool
 * silently constrains what a generator is allowed to invent from. If a GM wants our bundled
 * packs (components/creations/tools) offered here, they map them in Blacksmith's own Compendium
 * Mapping like any other compendium -- do not change our settings or their defaults to
 * compensate. Names only, grouped by compendium and rarity (Area's existing grouping, not ours);
 * no family grouping (our own `family` derivation has a real, demonstrated mislabeling case for
 * anything without Artificer flags or a consumable subtype -- see TODO.md).
 */
const RECIPE_PROMPT_CATALOGS = ['items'];

/**
 * "Prefill before copy" questions on the recipe prompt. Six titled sections, in this exact
 * order, per the author's own breakdown of a recipe's parts: Result item, Ingredients, Process,
 * Requirements, Provenance, Instructions. Every `id` here matches a declared field's `name`, so
 * each becomes a CONSTRAINT -- stated as fixed in the prompt and written into the JSON template,
 * Blacksmith's existing behaviour (api-importer.md, "Asking the author a question").
 *
 * `inputType: 'item'`/`'items'` (Blacksmith, 2026-10-09, "Dropping real items") are drag-and-drop
 * fields: dropping an Item writes its NAME (an `item` answer is a string; an `items` answer is
 * `[{name, quantity}]`, one per dropped/typed line). Blacksmith accepts ANY dropped item -- it
 * cannot read our Artificer flags, so it cannot filter by them. Two consequences we accepted
 * rather than asked Blacksmith to solve:
 *
 * 1. PROCESS CAN BE WRONG, AND THIS IS NOT A HARD FAILURE. Our own authoring sheet validates a
 *    dropped process (Process family flag, non-empty levels array); the prompt's `item` field
 *    cannot. `recipeCanCraft` (window-crafting.js) never checks processType at all -- a
 *    non-process name there does not block crafting, it just means `findProcess()` returns null
 *    at use and the bench shows no intensity/animation. Degraded, not broken; the hint says so.
 * 2. INGREDIENT TYPE/FAMILY ARE GENERATOR-WRITTEN, NOT ITEM-READ, FOR A DROPPED LIST. An `items`
 *    answer carries only name and quantity -- Blacksmith cannot read a dropped item's Artificer
 *    flags to fill `type`/`family` the way our own sheet's drop handler does. Confirmed from
 *    `recipeCanCraft`: a WRONG type/family on a FLAGGED ingredient does fail the craft-time match
 *    (an unflagged item still matches by name alone, so this only bites flagged ingredients).
 *    Not asking Blacksmith to carry flag data through a mechanism built for every module, not
 *    just ours -- the fix belongs on our side: resolve `ingredients[].type`/`.family` from the
 *    item cache BY NAME when a recipe is READ, rather than trusting whatever was written at
 *    import. No regression for existing recipes (today a mismatch already fails the match; this
 *    only ever fixes one, never breaks one) and covers every authoring path, not only this one.
 *    Tracked in TODO.md -- not yet implemented; this is prompt-metadata only, that is a change to
 *    already-shipped crafting-match code and deserves its own pass, not a same-night add-on.
 *
 * `type`/`category`/`rarity` (the crafted result's classification) stay OUT for now -- genuinely
 * fixed vocabularies, but asking the author to classify a result before dropping the item that
 * IS the result reads backwards. Revisit once result-item drag-and-drop has been used once.
 *
 * `skill`, `skillKit` are `select` with `dynamicOptions: true` (Blacksmith, 2026-10-09, "A select
 * whose list changes"), NOT a static `select` and NOT free text -- both are world-configurable (a
 * world's skills mapping JSON; the skill's kit list), so no option list can be frozen at
 * registration. Our own sheet already solves exactly this the same way (render-time dropdown, not
 * a schema `choices`), which is why free text was a real downgrade from the sheet, not an
 * acceptable simplification -- the author caught that directly. A `dynamicOptions` field carries
 * NO `options` key (Blacksmith rejects declaring both); the live list is pushed separately via
 * `blacksmith.importer.setPromptFieldOptions`, from `syncRecipeSkillPromptOptions()`
 * (`scripts/skills-rules.js`), called once right after this declaration registers and again every
 * time the skills cache itself reloads, so the two can never disagree. `recipeCanCraft` still
 * never rejects a recipe for an unmapped skill -- it degrades gracefully (no perks/rules apply,
 * crafting still works) -- so an empty list still leaves a working, if unconstrained, field; it
 * does not block anything. Kit is confirmed NOT an item in our model (matched by name against
 * inventory with no flag filtering at all), so it is a dynamic select, not `inputType: 'item'`,
 * even though apparatus/container/process/result all are.
 *
 * `traits` is a plain `textarea` (Blacksmith converts a comma/line-separated answer to an array
 * for an array-of-string field automatically) -- a real gap caught by the author: our sheet offers
 * it with a live-built suggestion list drawn from every tag already used across the item cache,
 * genuinely open vocabulary, no fixed list anywhere. The hint says comma or line separated since
 * nothing else in the prompt UI states that format.
 *
 * Image: no control here, deliberately -- the author's answer is that the image IS the result
 * item's own image, resolved at render time the way every other icon on the page already is
 * (`sheet-recipe-page.js`'s `cachedImages()`). Nothing to build.
 */
const RECIPE_PROMPT_FIELDS = [
    {
        id: 'resultItemName', label: 'Result item', inputType: 'item',
        group: 'Result item', groupIcon: 'fa-solid fa-flask',
        hint: 'Drop the exact item this recipe produces, or type its name. Any item works.'
    },
    {
        id: 'traits', label: 'Traits', inputType: 'textarea',
        group: 'Result item', groupIcon: 'fa-solid fa-flask',
        hint: 'Comma or line separated, e.g. "Herbal, Medicinal". Two to five tags describing what the recipe is good for -- do not repeat type or category.'
    },
    {
        id: 'ingredients', label: 'Ingredients', inputType: 'items',
        group: 'Ingredients', groupIcon: 'fa-solid fa-mortar-pestle',
        hint: 'Drop items or type Name xQuantity, one per line. The generator fills in type and family for each -- for an item carrying Artificer flags, a wrong type or family can fail the crafting match at use; verify flagged ingredients afterward.'
    },
    {
        id: 'processType', label: 'Process', inputType: 'item',
        group: 'Process', groupIcon: 'fa-solid fa-fire',
        hint: 'Drop a Process item (Component/Creation/Tool family "Process"). Any other item is accepted but produces no process animation or intensity at craft time.'
    },
    {
        id: 'processLevel', label: 'Process level', group: 'Process', groupIcon: 'fa-solid fa-fire',
        hint: '0-3. What each position means depends on the process itself (e.g. heat\'s 1-3 are Low/Medium/High).'
    },
    {
        id: 'time', label: 'Process time (seconds)', group: 'Process', groupIcon: 'fa-solid fa-fire',
        hint: '0-120 seconds. Distinct from work hours below -- this is the bench running, not the crafter\'s day.'
    },
    {
        id: 'apparatusName', label: 'Apparatus', inputType: 'item',
        group: 'Process', groupIcon: 'fa-solid fa-fire',
        hint: 'Drop the vessel crafted IN (beaker, mortar). Any item works -- not consumed.'
    },
    {
        id: 'containerName', label: 'Container', inputType: 'item',
        group: 'Process', groupIcon: 'fa-solid fa-fire',
        hint: 'Drop the vessel the result goes INTO (vial, flask). Any item works -- one consumed per craft.'
    },
    {
        id: 'skill', label: 'Crafting skill', inputType: 'select', dynamicOptions: true,
        group: 'Requirements', groupIcon: 'fa-solid fa-hand-sparkles',
        hint: 'This world\'s currently enabled crafting skills. Options are pushed live -- see syncRecipeSkillPromptOptions() in skills-rules.js.'
    },
    {
        id: 'skillLevel', label: 'Skill level', group: 'Requirements', groupIcon: 'fa-solid fa-hand-sparkles',
        hint: '0-20. Minimum crafting skill required.'
    },
    {
        id: 'skillKit', label: 'Required kit', inputType: 'select', dynamicOptions: true,
        group: 'Requirements', groupIcon: 'fa-solid fa-hand-sparkles',
        hint: 'The tool kit the crafter must hold in inventory, e.g. "Alchemist\'s Supplies". Per-world, not a fixed list.'
    },
    {
        id: 'successDC', label: 'Success DC', group: 'Requirements', groupIcon: 'fa-solid fa-hand-sparkles',
        hint: '1-30. The crafting roll DC.'
    },
    {
        id: 'goldCost', label: 'Gold cost (gp)', group: 'Requirements', groupIcon: 'fa-solid fa-hand-sparkles',
        hint: 'Spent on top of the ingredients.'
    },
    {
        id: 'workHours', label: 'Work hours', group: 'Requirements', groupIcon: 'fa-solid fa-hand-sparkles',
        hint: 'In-game hours to craft. Distinct from process time above.'
    },
    {
        id: 'source', label: 'Source', group: 'Provenance', groupIcon: 'fa-solid fa-book',
        hint: 'Free-text attribution. Left blank if not given -- never invented.'
    },
    {
        id: 'license', label: 'License', group: 'Provenance', groupIcon: 'fa-solid fa-book',
        hint: 'Free-text license note.'
    },
    {
        id: 'specificInstructions', label: 'Specific instructions for this recipe', inputType: 'textarea',
        group: 'Instructions', groupIcon: 'fa-solid fa-pen-nib',
        hint: 'Guidance for THIS recipe specifically, on top of the general Additional Guidance above -- does not constrain a field, just adds to what the generator is told.'
    }
];

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
    return fromModel(RecipePageModel, {
        kind: 'journal',
        id: 'recipe',
        label: 'Artificer Recipe',
        module: MODULE.ID,
        document: {
            documentName: 'JournalEntryPage', type: RECIPE_PAGE_TYPE,
            containerNameFrom: 'book',
            folderNameFrom: 'skill'
        },
        guidance: RECIPE_GUIDANCE,
        examples: RECIPE_EXAMPLES,
        extraFields: RECIPE_EXTRA_FIELDS,
        preamble: RECIPE_PREAMBLE,
        promptCatalogs: RECIPE_PROMPT_CATALOGS,
        promptFields: RECIPE_PROMPT_FIELDS
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
