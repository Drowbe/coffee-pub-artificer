# Plan: Recipe Type/Subtype becomes derived from the dropped result item

Raised 2026-10-09, during the `_captureFormState` bug fix session, from the user noticing the
recipe sheet's Category suggestion popup rendered in the wrong place. Investigating that bug
surfaced a bigger question: what are `type`/`category` on a recipe actually for, and why do they
exist as separate authored fields at all when the recipe already requires dropping the result
item that they describe.

## Decision, made live with the author

`type`/`category` stop being authored (typed, picked from a fixed list, or generator-guessed) and
become **fully derived, read-only**, set automatically from the dropped Result item at drop time --
the same pattern already used for ingredient `type`/`family` (`#bindDropZones`, `target ===
'ingredient'` branch, `sheet-recipe-page.js`).

**Renamed to `type` / `subtype`, not `type` / `category`.** Components' existing filter already
uses "Type | Family" for the Artificer bucket vocabulary (`artificerType`/`family`). Labeling the
recipe's fields "Type | Family" too would just move the same-word-different-meaning collision from
"Type" to "Family" -- they are still two unrelated vocabularies. "Subtype" is dnd5e's own schema
term for the field being read (`system.type.subtype`), does not collide with Components' labels,
and does not imply this is the same kind of classification as the Artificer bucket.

## What `type`/`subtype` actually read

Confirmed from the dropped item's own document, not the item cache (`cache-items.js`'s cached
`type`/`dndType` fields read `system.type.value` as PRIMARY with `item.type` as fallback -- built
for deriving an Artificer ingredient *family* hint from a consumable subtype, not for exposing the
item's own top-level document type. Reusing it here would misread the semantics):

- `type` <- `doc.type` (Foundry's own Document#type: `weapon`, `consumable`, `equipment`, `loot`,
  `tool`, `container`, ...).
- `subtype` <- `doc.system?.type?.value ?? doc.system?.type?.subtype ?? doc.system?.consumableType
  ?? ''` (cross-version dnd5e field names; same fallback chain `cache-items.js:155-156` already
  uses for the same reason).

## Scope

**In scope -- the live JournalEntryPage recipe path only:**

- `scripts/data/models/model-recipe-page.js` -- `type` field loses `choices: Object.values(ITEM_TYPES)`
  and its `ITEM_TYPES.CONSUMABLE` initial; becomes a plain blank-by-default `StringField`, same
  shape as `category`/`rarity` already are ("blank means not stated").
- `scripts/sheets/sheet-recipe-page.js` -- `#bindDropZones`: a new `target === 'resultItemName'`
  branch (before the generic "stage the name" branch) stages `system.type`/`system.category` from
  the dropped `doc` alongside the name. `_preparePartContext` drops the `itemTypes` select-options
  context (no longer a picker) and the now-dead `#bindCategoryPicker()` added earlier this session
  (category is no longer free text, so its suggestion dropdown has nothing to suggest into).
- `templates/page-recipe-fields-edit.hbs` -- Type/Subtype becomes a read-only display next to
  Rarity (which stays a real picker -- rarity is never derivable from the item), matching how
  ingredient type/family are already shown as read-only badges, not controls. Hidden inputs carry
  the values through submit the same way the biomes/traits hidden fields already do.
- `scripts/declarations/declaration-artificer-recipe.js` -- the `type`/`category` guidance entries
  (lines 111-112) are rewritten to state plainly that both are set automatically when the result
  item is dropped in the authoring sheet, not something the generator should try to fill. They were
  already excluded from `promptFields` (comment at lines 265-267 anticipated exactly this: "revisit
  once result-item drag-and-drop has been used once").
- `testing/suites/suite-recipe-declaration.js` -- the assertion `'type' DOES have a values list` no
  longer holds once `choices` is removed; update to assert the opposite, with a note why.
- **New: Recipe Browser / Crafting Station filter.** A "Type | Subtype" dropdown pair next to the
  existing "All journals" filter in `window-crafting.js`'s recipe list, mirroring the structure of
  Components' existing "Type | Family" filter (`typeOptions`/`familyOptions`, `window-crafting.js`
  ~1073-1091) -- NOT its vocabulary source. Components' options come from the fixed
  `ARTIFICER_TYPES`/`FAMILIES_BY_TYPE` constants; recipes have no such fixed vocabulary (dnd5e's own
  item types are not enumerated anywhere in this module -- confirmed zero `CONFIG.DND5E` reads
  exist today). Options are built from the DISTINCT `type`/`category` values actually present
  across the currently loaded recipe set, the same way the journal filter's options are already
  built from what is actually there rather than a fixed list.

**Corrected mid-implementation -- `model-recipe.js` is NOT legacy-only and was NOT left alone.**
The first draft of this plan assumed `ArtificerRecipe` (`scripts/data/models/model-recipe.js`) was
part of the legacy-HTML path and scoped it out. Wrong: `RecipeParser.fromSubtypePage`
(`parser-recipe.js:48`) -- the live reader for every `coffee-pub-artificer.recipe` page, old and
new recipes alike -- constructs `new ArtificerRecipe({ type: system.type, ... })` for every
recipe load, and `ArtificerRecipe#_validateAndNormalize()` hard-checked `type` against the old
`ITEM_TYPES` enum, silently resetting anything else back to `'Consumable'` with a console warning.
Left alone, every derived dnd5e type (`weapon`, `loot`, ...) would have been silently stomped back
to `'Consumable'` the moment a GM opened the Crafting Station -- caught by actually reading
`parser-recipe.js` rather than assuming its relationship to the legacy path from its name. Fixed:
the constructor's `type` default and the validator's `ITEM_TYPES` check are both removed; `type`
is free, like `category` already was. `ITEM_TYPES` itself is deleted from `schema-recipes.js` --
confirmed by repo-wide grep to have no remaining reader anywhere, legacy or otherwise.

Only `RecipeParser.parseSinglePage` (the actual legacy-HTML `type: 'text'` page parser) is
genuinely out of scope -- it never read a dnd5e-derived value either way, and this change does not
touch it.
- A picker UI for overriding the derived value. The author chose fully derived/read-only over
  pre-filled-but-editable specifically to avoid needing a `CONFIG.DND5E`-driven type/subtype picker.

## Known one-time staleness, not a regression

The handful of recipes already authored live this session (`Muscle Balm`, the `ASF` test page) carry
the OLD `type` value (`'Consumable'`, capitalized -- the old `ITEM_TYPES` vocabulary) which happens
to resemble but not equal a real dnd5e document type (`'consumable'`, lowercase). After this change
those recipes show a blank Type/Subtype until their Result item slot is re-dropped once. Showing
blank rather than a stale, wrong-looking value is correct per this project's blank-vs-absent rule
(`CLAUDE.md`) -- it is not worth a migration script for a handful of unreleased test pages.

## Verification

- Syntax (`node --input-type=module --check`), `check-imports.mjs`, `check-doc-links.mjs` on every
  touched file.
- `suite-recipe-declaration.js` updated and passing (headless tier, via the test harness).
- Live, in a world: drop a Consumable item (e.g. a potion) as a recipe's Result item, confirm Type
  shows the item's real document type and Subtype shows its dnd5e subtype, re-dropping a different
  item updates both. Confirm the classification badge (`sheet-recipe-page.js`, the "Consumable *
  Potion * Common" line) still reads correctly from the new values. Confirm the new Recipe Browser
  Type/Subtype filter narrows the list and its option lists match what is actually on the loaded
  recipes.
