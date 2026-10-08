# Recipe field mappings, for Blacksmith's importer declarations

**Audience:** us, while the work is in flight

**Status: superseded by a real data model, rewritten 2026-10-07.** The version of this
document Blacksmith originally received (step 8, "raw input for the rendered form") assumed
recipes were permanently `type: 'text'` with no schema, which is no longer true — recipes
have been a real registered subtype (`coffee-pub-artificer.recipe`, `RecipePageModel`,
`scripts/data/models/model-recipe-page.js`) since August. Only the IMPORT path still writes
the legacy format; this document now plans retiring that, not designing around it. The field
table and notes below describe the LEGACY import path's current behaviour, and are kept —
that behaviour is exactly what a new declaration needs to either preserve or deliberately
break, and getting that wrong silently is how note 3's container/apparatus bug happened in
the first place.

---

## Two tracks

**Track A — construction only, keep our own window. DONE 2026-10-07.** Registered a `mapped`
profile for `coffee-pub-artificer.recipe` via `declarationFromModel(RecipePageModel, options)`
(`scripts/declarations/declaration-artificer-recipe.js`) — this confirms the "Open, asked"
question below: yes, it removes nearly all of the field-table transcription, since
`RecipePageModel` already carries `required`/`nullable`/`default`/`choices`/nesting. Only
`guidance` and `examples` (prose a schema cannot carry) are hand-supplied, keyed by dotted
path. The field table below stays as the BEHAVIOURAL reference (vocabularies, aliases, what
note 3's bug was); it is no longer hand-transcribed into `fields:`.

`scripts/utility-artificer-recipe-import.js`'s `importRecipes` now calls
`blacksmithApi.importer.buildDocumentData('journal', 'recipe', entry)` in place of the
hand-rolled JSON-to-HTML construction (`buildRecipePageHtml`, now a fallback for an older
Blacksmith only), merges in `name`/`text.content` (both outside `system`, confirmed absent
from `buildDocumentData`'s own output), and still does its own `createEmbeddedDocuments` with
our existing settings-driven destination/folder resolution, completely unchanged. Confirmed
buildable standalone — Blacksmith's own docs: "any surface that collects friendly fields...
can map them to an entry and get the same document data the importer produces"
(`api-importer.md:42`).

Two bugs found only by running the harness live, both now fixed: `declarationFromModel` needs
the model CLASS (`RecipePageModel`), not `RecipePageModel.schema` (the compiled `SchemaField`
instance Foundry caches on the class) — passing the latter makes it walk the wrong shape
entirely. And Blacksmith's registry unconditionally requires `document.containerName` or
`containerNameFrom` on *any* `JournalEntryPage` declaration, even when `buildDocumentData` is
the only thing ever called — confirmed by reading `assemble()` in Blacksmith's
`manager-declarations.js`, which never reads it; only the window-based import path does. A
constant placeholder (`'Artificer Recipes'`) satisfies registration without doing anything.

**Track B — retire our window for `openWindow`/`attachButton`.** Deferred, but the request is
now **approved by Blacksmith's author (2026-10-07) and logged in their TODO.** Needs Blacksmith
to own destination resolution too, and our destination is GM-configurable via settings
(`recipeJournalName`/`recipeJournalFolder`), not a fixed constant and not naturally a field
on each JSON entry — `containerName` is a constant, `containerNameFrom` reads a *declared*
field on the entry. The candidate mechanism (declare the field `authorable: false`, inject
the setting's value ourselves before import) runs against the documented contract rather
than merely an untested edge of it: `authorable: false` is "for state a subsystem
maintains" (`api-importer.md:155`), i.e. Blacksmith-maintained state across re-imports, not
a value a caller supplies per run. Blacksmith's stated preference for the real mechanism: the
registering module resolves its own setting and passes the VALUE in, not a callback — "a
callback in a declaration is opaque to the mirror check." Nothing to build on either side
until we actually retire the window; when we do, we owe them the exact spec (value vs.
per-import-resolved, and the same question for folder resolution).

**Separate, not yet scoped: migrating existing legacy-format recipes.** Once import writes
the real subtype, a world holds both `type: 'text'` recipes (pre-fix) and real-subtype ones
side by side. Whether/how to upgrade the old ones is not decided here — flagging so it is not
silently conflated with the import-path change, which only affects recipes imported from this
point forward.

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
