# Plan: recipes as a declared page subtype

**Why now.** Blacksmith's step 8 will support a mapped foreign subtype whether or not ours
exists. If ours does not, recipes stay on the HTML parser and the format stays undeclared
exactly where it is most load-bearing. This is the long pole and it is entirely on our side.

**The target.** `coffee-pub-artificer.recipe` as a real `TypeDataModel`, declared to
Blacksmith as a **mapped** profile, with both `buildRecipePageHtml` and `RecipeParser`
deleted.

---

## What is done

- [`scripts/data/models/model-recipe-page.js`](../../scripts/data/models/model-recipe-page.js)
  — `RecipePageModel` and `RECIPE_PAGE_TYPE`. Field-for-field with `ArtificerRecipe` minus
  `id`, `journalPageId` and `source`-as-journal-UUID. Not registered, not imported by
  anything, changes nothing at runtime.

Two shape decisions worth knowing before the rest is built:

- **`description` lives in `text.content`, not in `system`.** It is free-form prose, so the
  page stays ProseMirror-editable through the standard journal UI, and a mapped declaration
  can still target `text.content` — Librarian's `expandedDetails` already does.
- **`skill` has no `choices`.** Valid ids come from a runtime user-configurable mapping, so
  a fixed list would fail legitimate recipes in any world with custom skills. This is the
  same gap flagged to Blacksmith as the one field driving a dynamic-vocabulary mechanism.

## What is left, in order

1. **Register the subtype.** `documentTypes: { JournalEntryPage: { "recipe": {} } }` in
   `module.json`, and `CONFIG.JournalEntryPage.dataModels` assignment in an `init` hook.
   **Must be `init`, not `ready`** — Foundry validates documents as the world loads, and a
   page naming an unregistered subtype fails validation and will not render. Registering
   late is indistinguishable from not registering.

2. **A sheet.** Until one exists the pages render with Foundry's default, which for a
   subtype with no sheet is not usable. `DocumentSheetConfig.registerSheet` with
   `types: [RECIPE_PAGE_TYPE]`, `makeDefault: true`.

3. **Read path first, write path second.** Point `manager-recipes` at `page.system` when the
   page is a recipe subtype, falling back to `RecipeParser` for `text` pages. Both paths
   live at once — this is the writer-retires-first rule applied to ourselves, and it is what
   makes step 4 safe.

4. **Conversion.** Every recipe in every existing world is a `text` page. A subtype cannot
   be assigned by update — the page must be deleted and recreated, **preserving ownership
   and sort**, which is exactly the "replace, preserving these paths" case Librarian raised
   as an open question. Parse with `RecipeParser`, create as subtype, verify, then delete.
   Never the other order.
   **This is the step that touches live worlds and it needs its own decision, not just its
   own commit.**

5. **Declare it to Blacksmith** as a mapped profile, and delete our import window, parser,
   normalisers, `resolveItemByName` and result reporting.

6. ~~**Fix the blank-apparatus round trip before step 5, not after.**~~ **DONE 2026-08-25.** A blank `Apparatus:`
   with a filled `Container:` round-tripped with the container as the apparatus
   (`parser-recipe.js`, `utility-artificer-recipe-import.js`). Fixed in the model
   already by keeping the two fields separate; the fix also had to land in the parser,
   because the parser is what reads the pages being converted in step 4. Converting with the
   bug live would have written the wrong apparatus into the new schema permanently, where it
   stops being a parser bug and becomes data.

   The fix turned on distinguishing two things the old code conflated: a modern page with a
   **blank** `Apparatus:` label, and a legacy page with **no** `Apparatus:` label at all
   (from before the two fields were split, where `Container:` genuinely meant the apparatus).
   The parser now tracks whether the label appeared, not whether it had a value. On the
   import side, `containerName` no longer falls back into `apparatusName` — only the legacy
   `container` spelling does.

   **Conversion is now unblocked.** More generally: a conversion inherits every defect of
   the reader that feeds it, so this ordering holds for any text-to-subtype conversion.

## Sequencing against Blacksmith

Steps 1-4 are ours alone and block nothing of theirs. Step 5 needs their step 8. The
dynamic-vocabulary mechanism for `skill` needs designing before step 5 but not before step 4,
and they have it recorded.

Nothing here needs to wait for the item field group — different kind, different registry.
