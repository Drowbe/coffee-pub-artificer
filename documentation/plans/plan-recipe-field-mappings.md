# Recipe field mappings, for Blacksmith's importer declarations

**Audience:** us, while the work is in flight

**Status: raw input for Blacksmith, not an Artificer plan.** Sent ahead of step 8 (Journal,
the rendered form), per their request for recipe requirements before the design rather than
after. Delete when the declaration exists upstream and our parallel import pipeline is
retired.

Format is friendly field to target, matching Librarian's `declaration-field-mappings.md`.
"Required" is what `validateRecipePayload`
([`scripts/utility-artificer-recipe-import.js:73`](../../scripts/utility-artificer-recipe-import.js#L73))
actually rejects an entry for today.

---

## Kind identity

| | Recipe |
|---|---|
| Host kind | `journal` |
| Profile | `recipe` |
| documentName | `JournalEntryPage` |
| Document type | `text` — **no data model.** See "The round-trip problem" below. |
| Destination | pages of the journal named in world setting `recipeJournalName`, inside folder setting `recipeJournalFolder`; created if absent |
| Form | `rendered` |
| Schema version | 0 — not yet a schema |

Construction today: `importRecipes` validates, calls `buildRecipePageHtml`, and creates one
page with `type: 'text'` and the whole recipe as `text.content`. That is your rendered form
almost exactly — friendly fields into a template, one HTML string at `pages[].text.content`.

---

## The round-trip problem, and why we are not just another Area

**This is the part worth reading before the field table.**

Your rendered profiles are one-way. `journal-area.hbs` compiles a payload into HTML and
nothing ever reads it back — the HTML *is* the artifact. Ours is not. `RecipeParser`
([`scripts/parsers/parser-recipe.js`](../../scripts/parsers/parser-recipe.js)) re-reads
every page at runtime, matches on the bolded label text, and reconstructs an
`ArtificerRecipe` from it. The rendered HTML is our **storage format**, not our output
format.

Consequences, in rough order of how much they should shape the design:

1. **The template is a schema, and changing it is a data migration.** Renaming a section
   heading is cosmetic; renaming a `<strong>` label silently orphans that field on every
   recipe already in a world. If a declared template ever regenerates our HTML with
   different labels, existing recipes lose fields with no error — they parse, they
   validate, they just come back with less.

2. **A rendered declaration needs to describe the read as well as the write**, or we keep
   our parser and you own only half the loop. Our labels are a flat
   `<p><strong>Label:</strong> value</p>` convention with two exceptions
   (`Description` reads the following `div.recipe-description`; `Ingredients` reads the
   following `<ul>`). If a declared field can carry its own label and a small number of
   read shapes, the round trip is declarable. If it cannot, this profile should stay
   `rendered`-write-only and we keep parsing — which works, but leaves the format
   undeclared exactly where it is most load-bearing.

3. **The real fix is a data model, and we would rather have that than a better parser.**
   Everything above is a symptom of `type: 'text'`. Librarian's codex has
   `CodexPageModel` and is therefore `mapped`; our recipes are the quest column of their
   table — the mapping we want, not one that exists. If step 8's passthrough seam lets
   Blacksmith construct a foreign subtype, **we would rather declare
   `coffee-pub-artificer.recipe` as a mapped profile against a real model** and delete both
   the builder and the parser. That is a bigger change on our side than on yours, and we
   are not asking for it in step 8 — but if the rendered form gets designed around our
   current HTML, it will be designed around the thing we most want to stop doing.

---

## Fields

Vocabularies from [`scripts/schema-recipes.js`](../../scripts/schema-recipes.js). "Label"
is the bolded text `buildRecipePageHtml` writes and `RecipeParser` matches on; it is the
de facto target path for a rendered profile whose output is re-read.

| Friendly field | Label in page | Type | Req | Allowed / notes |
|---|---|---|---|---|
| `name` | `Name` | string | **yes** | Also the page name. Rejected if absent or non-string. |
| `resultItemName` | `Result` | string | **yes** | Falls back to `name` when absent, then rejected if still blank. Resolved by name at runtime against compendia then world — **never a UUID**, deliberately, same reasoning as codex `related[]`. Parser strips `@UUID[...]{Label}` back to the label if it finds one. |
| `description` | `Description` | HTML string | **yes** | The only other hard rejection. Rendered into `div.recipe-description`; parser reads that div's `innerHTML`, so HTML survives the round trip. |
| `traits[]` | `Traits` | array of string | no | Comma-joined. **`acceptsKeys: ['tags']`** — a key alias; older pages say `Tags:` and the parser still accepts that label. Not the shared `tags` fragment: these drive recipe matching. |
| `ingredients[]` | `Ingredients` | array of `{type, family?, name, quantity}` | no | Rendered as `<li>Family: Name (qty)</li>`; parser reads the following `<ul>`. Each needs `name` (string) or the entry is rejected. `type` is `Component` \| `Creation` \| `Tool`; legacy `ingredient` / `component` / `essence` are **value** aliases onto `Component`. `quantity` defaults to 1. See note 2. |
| `type` | `Type` | string | no | `Weapon` \| `Armor` \| `Consumable` \| `Tool` \| `Gadget` \| `Trinket` \| `ArcaneDevice`. Default `Consumable`. An unknown value warns and falls back rather than failing. |
| `category` | `Category` | string | no | Free text within type (e.g. `Potion`). |
| `rarity` | `Rarity` | string | no | `common` \| `uncommon` \| `rare` \| `very rare` \| `legendary`, lowercased. Unknown values are dropped on read, not rejected. |
| `skill` | `Skill` | string | no | Must match an enabled id in the configured skills mapping JSON — **a runtime-configurable vocabulary, not a fixed list.** See note 1. |
| `skillLevel` | `Skill Level` | integer | no | 0–20, default 1. **Note this floor is 0, unlike item flags where it is 1.** |
| `skillKit` | `Skill Kit` | string | no | Required kit (`Alchemist's Supplies`). **`acceptsKeys: ['toolName', 'tool']`**; the parser also matches a `Tool:` label. Actor must have it in inventory at craft time. |
| `processType` | `Process Type` | string | no | `heat` \| `grind`. Default `heat`. |
| `processLevel` | `Process Level` | integer | no | 0–3. Default 0. Meaning depends on `processType`: heat is Off/Low/Medium/High, grind is Off/Coarse/Medium/Fine. Parser accepts those words as **value** aliases, and a 0–100 number as a percentage. |
| `time` | `Time` | number | no | Process duration in **seconds**, max 120. Distinct from `workHours` and not a translation of it. Parser accepts `"30 sec"` / `"2 min"` forms. |
| `apparatusName` | `Apparatus` | string | no | Vessel crafted *in* (beaker, mortar). Resolved by name at runtime. **`acceptsKeys: ['containerName', 'container']`** on import — see note 3, this alias is a trap. |
| `containerName` | `Container` | string | no | Vessel the result goes *into* (vial, flask). Resolved by name at runtime. |
| `goldCost` | `Gold Cost` | number | no | gp after ingredient deduction. |
| `workHours` | `Work Hours` | number | no | In-game hours to craft. |
| `successDC` | `Success DC` | integer | no | 1–30. |
| `source` | `Source` | string | no | Free text. **No longer defaulted** — see note 4. |
| `license` | `License` | string | no | Free text. |
| — | `Heat` | integer | no | **Read-only legacy.** The builder has never written this label; the parser still accepts it for pages predating `processType`/`processLevel`. Declare as accepted-on-read, never emitted. |

`id`, `journalPageId` and the model's `source`-as-journal-UUID are assigned at
construction and never authored.

---

## Notes

1. **`skill` has no static vocabulary and this is the one that will bite.** Valid ids come
   from a user-configurable skills mapping JSON read at runtime
   (`getEnabledCraftingSkillIds()`), so the allowed set differs per world and changes while
   a world is live. A declaration validating `skill` against a fixed `values` list would
   reject legitimate recipes in any world with custom skills. We need either a
   declared-vocabulary-by-callback, or `skill` left unvalidated with the check staying
   ours. **Codex and quest have no equivalent** — every other vocabulary in all three
   modules is static, so if the model gains one dynamic-vocabulary mechanism, this is the
   field driving it.

2. **Ingredients are matched, not linked.** An Artificer ingredient matches on TYPE plus
   optional FAMILY plus name; a plain D&D item with no Artificer flags matches on name
   only. So `family` narrows and `type` gates, and neither is decoration. Names are
   normalised for punctuation on both write and read (curly quotes to ASCII) so stored
   text matches what a user types — worth knowing if a declared transform would normalise
   differently.

3. **The `container` to `apparatus` alias is a real bug, not just a compatibility note.**
   On import, `apparatusName` falls back to `containerName` then `container`
   (`utility-artificer-recipe-import.js:96`), and the parser does the same in reverse: a
   `Container:` value lands in `apparatusName` if apparatus is not yet set
   (`parser-recipe.js:95-102`). Both exist because the two concepts were once one field.
   The import path hides it — apparatus is defaulted to `Mixing Bowl` so it is never
   blank — but a hand-authored page with a blank `Apparatus:` and a filled `Container:`
   round-trips with the container as the apparatus. **Do not preserve this in a
   declaration.** It is ours to fix, and we would rather fix it before you declare the
   profile than have it become documented compatibility surface.

4. **`source` no longer defaults to `"Artificer"`.** Removed 2026-08-25 under the rule that
   a default may supply a zero but never an attribution. Recipes already in worlds keep the
   stamp; nothing new invents one. A declaration should not reintroduce it.

5. **Duplicate policy is undeclared and differs from yours.** `importRecipes` always
   creates a new page — no name match, no in-place update — so re-importing a recipe
   silently produces a second copy. Your Area profile updates in place. Neither is
   declared today, and if `duplicatePolicy` becomes a declared option we want
   update-in-place for recipes, not the create-always we currently have.

6. **We render our own button on your menubar to open our own importer.** Worth stating
   plainly since it is the thing this whole conversation circles: nothing about our recipe
   pipeline is load-bearing to us as *our* code. If a declared profile can carry the
   fields above, we would rather delete the window, the parser, the normalisers, the
   name resolver and the result screen than port any of it.
