# Recipe field mappings, for Blacksmith's importer declarations

**Audience:** us, while the work is in flight

**Status: DONE, 2026-10-08.** Recipes import exclusively through Blacksmith's Unified Import
window now — no Artificer-owned import window, matching how items already worked (a declared
profile, no bespoke UI). This document started as a field-mapping reference for a hand-written
declaration, became a two-track plan (Track A: construction only, keep our window; Track B:
retire the window too), and ended with Track B shipping in full the same day it was proposed,
once it was clear items never had a separate window either. The field table below is kept as
the BEHAVIOURAL reference (vocabularies, aliases, what note 3's bug was) — it was never
hand-transcribed into the declaration; `declarationFromModel` derives it from `RecipePageModel`.

**What shipped.** `scripts/declarations/declaration-artificer-recipe.js` is a `mapped` profile
built via `declarationFromModel(RecipePageModel, options)`, covering BOTH construction and
destination:
- `journaltype` selector (`extraFields`) — how the Unified Import window routes a payload here.
- `title` → `path: 'name'`, `description` → `path: 'text.content'` — both outside `system`
  (page title, native ProseMirror body), declared via `extraFields` the same way Bibliosoph's
  `injury-import-profile.js` maps its own `title`. Blacksmith's `writePath()` is a plain
  dotted-path setter, not restricted to `system.*`, so this needed no new mechanism.
- `containerNameFrom: 'book'`, `folderNameFrom: 'skill'` — the world's actual organisation
  (confirmed against a live screenshot): folder = skill (Alchemy, Herbalism, Poisoncraft, ...),
  journal = a recipe book inside that folder, page = one recipe, several books per skill is
  normal. No folder-casing transform: `ensureJournalFolder` matches an existing folder
  case-insensitively and creates a new one verbatim (a transform was tried before, it mangled
  proper nouns, and was removed on purpose — confirmed directly with Blacksmith, do not add one).
- No image field — recipes don't have one. Every icon on a recipe page is resolved at RENDER
  TIME, by name, from the item cache (`sheet-recipe-page.js`), not stored on the page.

Two bugs found only by running the harness live, both fixed before any of the above: a first
pass passed `RecipePageModel.schema` (the compiled `SchemaField` instance) instead of the model
CLASS, which made `declarationFromModel` walk the wrong shape entirely; and Blacksmith's
registry unconditionally requires `document.containerName` or `containerNameFrom` on *any*
`JournalEntryPage` declaration at registration time, which a Track-A-only declaration (no real
destination yet) satisfied with an inert placeholder — removed once `containerNameFrom` became
real.

**Also done:** `storage-recipes.js` finds recipes by page type across every world journal
instead of one configured journal (several books per skill needs that); the
`recipeJournalName`/`recipeJournalFolder` settings are deleted outright (module unreleased,
single world, confirmed zero legacy pages exist); `window-artificer-recipe-import.js` and its
button are deleted; `utility-artificer-recipe-import.js` is trimmed to the legacy HTML builder
only (still used by `cleanAndRewriteRecipePages`/`applyPotionBrewingData` for a world that does
have old-format pages) and renamed to `utility-artificer-recipe-legacy-html.js`.

**Still open with Blacksmith, not blocking:** a profile-level `preamble` for the DM-persona and
process framing `prompts/artificer-recipe.txt` carries (no mechanism today — a declared journal
profile's Prompt Template is JSON-schema only, derived entirely from `guidance`/`examples`/
`rules`), and whether there's any slot for a separate image-generation prompt (there isn't one
today; Blacksmith's own image prompts are two fixed, Blacksmith-owned templates a profile can't
register into). Dependent vocabularies (category depends on type; ingredient family depends on
ingredient type) and world-configurable closed vocabularies (skill, skillkit, apparatus,
container, process) stay prose-only in `guidance` — not solvable by any of this, and no worse
than the static prompt file already was.

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
