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
  `id`, `journalPageId` and `source`-as-journal-UUID.
- [`scripts/sheets/sheet-recipe-page.js`](../../scripts/sheets/sheet-recipe-page.js) and
  [`templates/page-recipe-fields-edit.hbs`](../../templates/page-recipe-fields-edit.hbs) —
  extends the concrete `JournalEntryPageProseMirrorSheet`, so the description keeps stock
  editing and the structured fields sit above it.
- Registered at `init` in [`scripts/artificer.js`](../../scripts/artificer.js), with
  `documentTypes` in `module.json`.

**Nothing is converted.** Existing recipes are all plain `text` pages and still read through
`RecipeParser`; the subtype is available but unused until step 4. Syntax-checked only — not
yet opened in a live world.

Two shape decisions worth knowing before the rest is built:

- **`description` lives in `text.content`, not in `system`.** It is free-form prose, so the
  page stays ProseMirror-editable through the standard journal UI, and a mapped declaration
  can still target `text.content` — Librarian's `expandedDetails` already does.
- **`skill` has no `choices`.** Valid ids come from a runtime user-configurable mapping, so
  a fixed list would fail legitimate recipes in any world with custom skills. This is the
  same gap flagged to Blacksmith as the one field driving a dynamic-vocabulary mechanism.

## What is left, in order

1. ~~**Register the subtype.**~~ **DONE 2026-08-25.** `documentTypes: { JournalEntryPage: { "recipe": {} } }` in
   `module.json`, and `CONFIG.JournalEntryPage.dataModels` assignment in an `init` hook.
   **Must be `init`, not `ready`** — Foundry validates documents as the world loads, and a
   page naming an unregistered subtype fails validation and will not render. Registering
   late is indistinguishable from not registering.

2. ~~**A sheet.**~~ **DONE 2026-08-25.** Until one exists the pages render with Foundry's default, which for a
   subtype with no sheet is not usable. `DocumentSheetConfig.registerSheet` with
   `types: [RECIPE_PAGE_TYPE]`, `makeDefault: true`.

3. **A Process is an item.** ← NEXT **This is the gate**, not a cleanup. Every other field in a
   recipe now resolves to an item you drag or a skill from the world's mapping; `processType`
   is the only one whose vocabulary still lives in our source, so it is the last thing between
   this sheet and a GM authoring recipes without us. Detail below.

4. **Read path first, write path second.** Point `manager-recipes` at `page.system` when the
   page is a recipe subtype, falling back to `RecipeParser` for `text` pages. Both paths
   live at once — this is the writer-retires-first rule applied to ourselves, and it is what
   makes conversion safe.

5. **Conversion.** Split into its own plan — see
   [`plan-recipe-migration.md`](plan-recipe-migration.md). The short version: the ~161 shipped
   compendium recipes are a *build step*, not a migration, and converting them first exercises
   the converter against real content at zero risk. Only user-authored world recipes need an
   in-world migration, and that one needs a dry run, a file backup, verify-before-delete, and a
   deliberate decision about whether UUIDs survive.
   **This is the step that touches live worlds and it needs its own decision, not just its
   own commit.**

6. **Declare it to Blacksmith** as a mapped profile, and delete our import window, parser,
   normalisers, `resolveItemByName` and result reporting.

7. ~~**Fix the blank-apparatus round trip before conversion, not after.**~~ **DONE 2026-08-25.** A blank `Apparatus:`
   with a filled `Container:` round-tripped with the container as the apparatus
   (`parser-recipe.js`, `utility-artificer-recipe-import.js`). Fixed in the model
   already by keeping the two fields separate; the fix also had to land in the parser,
   because the parser is what reads the pages being converted. Converting with the
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

## Step 3 in detail: a Process is an item

`processType` is a fixed `['heat', 'grind']` in `schema-recipes.js`, and `HEAT_LEVELS` /
`GRIND_LEVELS` are two hardcoded label maps selected by an `if`. Ferment, smith, write and
inscribe are all wanted, and none of their intensity vocabularies is either of those.

**A Process should be an Artificer item, dragged into the recipe like everything else.**
It reads as a stretch until you list what a process actually is, and it is four things:

| | |
|---|---|
| **Method name** | `heat`, `grind`, `ferment`, `smith`, `write` — free text, not an enum |
| **Levels** | three positions, each with a name and a colour. `Off/Low/Medium/High` and `Off/Coarse/Medium/Fine` are just two sets of words bound to the same three positions |
| **Animation** | today `heating` and `grinding`; should be an agnostic named set the author picks from |
| **Colour flow** | the selected level's colour is passed to the animation |

That is the whole definition. It is data, it has no behaviour, and it is exactly the shape of
an item flag block. Making it an item means a GM can author any number of processes without
touching code, and the recipe sheet's Process field becomes a drop slot like the others —
which also deletes the `if (processType === 'grind')` branching in both the sheet and the view.

**This one slot DOES need a type check, and that is not a contradiction.** Apparatus and
container are *roles* any item can fill — a sack is a container if the GM says so, which is
why those slots filter nothing. A process is not a role; it is a definition object, and an
item that carries no process flags has no method, no levels and no animation to offer. So the
process slot rejects items without the flag, and it rejects them because they cannot function,
not because of what they are called.

**Related, worth a pass of its own:** we have no flag that marks *what kind of Artificer thing*
an item is beyond `artificerType` (Component/Creation/Tool). Adding Process means adding a
fourth, and it is worth auditing the existing item data at the same time — what is actually
tagged, what is inconsistent, and whether the drop slots that legitimately do need a check
have anything reliable to check against.

### The shape

Store the process the same way every other item reference is stored: **by name, plus a level
index**. `processType: 'heat'` becomes `processName: 'Heat'`; `processLevel: 0-3` is unchanged
and now indexes the levels the process item declares.

### The migration is nearly free, because of that

Ship **Heat** and **Grind** as Process items carrying today's level names and colours, then map
legacy `processType: 'heat'` to the item named `Heat`. `HEAT_LEVELS` and `GRIND_LEVELS` delete
outright rather than earning a compatibility branch — the constants become two shipped items.
Same writer-retires-the-field shape as everything else in this plan.

### Honest scope

Small in the sheet and the view; not sheet-only. It reaches the crafting engine, which reads
`processType`/`processLevel`, and the animation layer, which currently picks its effect from a
hardcoded boolean. Those are the two places to check before calling it done.

### Order within step 3

**3a. Nail down recipe and item creation.** Finish the authoring pass in flight. Everything
after this assumes a GM can build a recipe and the items it references without our help.

The window itself is sound — Family is scoped by Type, affinity appears only for Essence,
biomes and quirk only for Component, and traits already have a proper picker. What it needs:

| | |
|---|---|
| ~~Title said "Create Component"~~ | **DONE.** It interpolated the selected type while the Type dropdown sat below it, so it contradicted the form the moment you changed it. Worse with a fourth type coming. |
| ~~**Skill slider disagrees with itself**~~ **DONE.** | Markup is `min="0"` with a `0` label; the fill math is `((skillLevel - 1) / 19) * 100`, a 1-20 range; both read paths clamp with `Math.max(1, ...)`. So 0 is offered, silently becomes 1, and the fill is offset from the thumb throughout. Items cannot be level 0 — recipes can, which is where the 0 came from. |
| ~~**Stated rules are unenforced**~~ **DONE.** | A Component can be saved with no habitat and an Essence with no affinity. These are the two `requires` rules in the field group declaration; they are prose in the prompt and nothing checks them. |
| ~~**No image**~~ **DONE.** | Items are created with `img: ''`. Now that recipe slots, ingredient rows and the browser all render icons, every new component is a blank square. |
| ~~**No description**~~ **REVERTED.** | Tried, and wrong. The description is a ProseMirror block with embedded HTML on the real item sheet; a raw textarea here invites mangling it, and `buildItemSystem` prefers `payload.description` over the existing value, so saving would have flattened formatted prose. This window manages the **Artificer flags** — it is not a second copy of the item sheet, and we are not replicating Details, Activities or Effects either. The second trip is correct. |
| ~~**Not on the Blacksmith Window API**~~ | **DONE for this window.** Extends `BlacksmithWindowBaseV2` via the API bridge; fields carry `blacksmith-input` / `blacksmith-select` / `blacksmith-textarea`. The rest of Artificer's windows remain on the CRITICAL list in `TODO.md`. |
| ~~**Two trait controls**~~ **DONE.** | This window's picker (input, live suggestions, removable pills) is better than the `+ Existing trait...` select on the recipe sheet. Converged on `scripts/systems/trait-picker.js`, used by both. The port also fixed a real limitation: the item window only committed a trait on Enter when it **matched an existing candidate**, so inventing a new trait there was impossible. |

**3b. Create the animation choices.** ← IN PROGRESS. The seam is built:
[`scripts/systems/process-definitions.js`](../../scripts/systems/process-definitions.js) holds
`heat` and `grind` as data (label, levels with colours, animation id, sound,
`unstableAtMax`), and the crafting bench now reads definitions instead of branching on
the id. CSS hooks are `artificer-anim-<id>` driven by `--process-level` and
`--process-color`. Authoring further effects is next, then 3c swaps `getProcess()`
from constants to items.

Original note: *Before* the item system, because a Process item has to
NAME an animation — the vocabulary is a dependency of the schema, not a follow-up to it.

The current effects already take exactly the two inputs the level model provides, which is the
good news: `styles/window-crafting.css` drives the heat effect from a `--heat` variable in the
0-1 range, and colours it with a hardcoded `rgba(255, 180, 90, ...)`; the grind effect is a
sibling class with hardcoded `rgba(235, 225, 205, ...)` dust. So the work is:

- Rename `--heat` to a process-agnostic level variable, still 0-1.
- Replace both hardcoded colours with the level's colour, passed in as a variable.
- Turn `crafting-bench-apparatus-grinding` from a boolean class into a named-animation class,
  applied from data rather than from `isGrinding: this.processType === 'grind'`
  (`window-crafting.js:1435`).
- Then author additional named effects. That part is design, not engineering.

Note `data-unstable` at high heat (`window-crafting.js:1415`) is a *heat* concept, not a
universal one. Either it becomes a per-animation option or it stays with the effects that want
it; it should not silently apply to fermenting.

**3b-note. The animation vocabulary becomes a JSON manifest — in 3c, not before.**

`PROCESS_ANIMATIONS` is a constant today. It should become
`resources/process-animations.json`, alongside the skills and gathering mappings and
selectable the same way, because it is the list a GM picks from and an art pack should
be able to extend.

**What the manifest can hold:** id, display label, description, preview hint.
**What it cannot:** the animation. `pulse` is keyframes plus a transform; `shake` is a
rotate, a press, a four-gradient particle field and a conic sweep. A parameterised
generator (`{motion, from, to, duration}`) covers pulse and comes nowhere near shake.
So the manifest is an INDEX OF THE CSS, not a replacement for it — an entry means "CSS
somewhere provides `.artificer-anim-<id>`".

**Failure mode to design against:** a manifest entry with no CSS behind it. The picker
offers "Bubble", a GM selects it, nothing happens, no error. Make each animation's CSS
block set a marker custom property (`--artificer-anim-registered: 1`) and probe a hidden
element at load, so an unbacked entry reports itself.

**Why it waits for 3c:** its only consumer is the Process item's animation picker, which
does not exist yet. Writing a loader with nothing reading it is the speculative-consumer
mistake — the same one that got a compatibility layer deleted in the importer work.

**3c. Extend the item system and migrate the two hardcoded processes.** Add the Process flag
block, ship **Heat** and **Grind** as items carrying today's level names and colours, map
legacy `processType` to them, and delete `HEAT_LEVELS` / `GRIND_LEVELS`.

This is also the natural moment for the item-data audit noted above: adding a fourth
`artificerType` is the first time a drop slot legitimately needs something reliable to check
against.

**3d. Then AI authoring, through Blacksmith's importer.** This is what the sequence is for, and
it is strictly downstream.

**Import mirrors the native path; it cannot lead it.** An import produces the same documents
the UI produces. If a GM cannot create a Process item and craft with it by hand, a JSON payload
describing one fails for the identical reason — the failure is in the item system, and import
is just a second way to reach it. So no import work starts until the system is functional
without import. **That makes step 3c the last body of work before the system stands on its
own.**

**No coordination is needed for the vocabulary change.** Under `registerFieldGroup` the group
is ours: we declare the values, the per-field guidance, the JSON shape and the preamble, and
Blacksmith derives the template, validation, prompt and export from that declaration. Adding
Process to `artificerType` and giving it its Process-only fields is an edit to
[`declaration-artificer-field-group.md`](declaration-artificer-field-group.md), not a message
to anyone. That is precisely the boundary the field group exists to draw — Blacksmith hosts
none of our vocabulary, so changing it is not an event on their side.

The one thing genuinely worth watching is that Process-only fields are the conditional-*fields*
case, a step past the conditional-*vocabulary* case Blacksmith is already designing for
`artificerFamily` and `skill`. If `requiresOption` and the rules vocabulary cannot express
"these fields exist only when artificerType is Process", that is a real gap — but it is one we
will discover by declaring it, not by predicting it.

## Sequencing against Blacksmith

Steps 1-5 are ours alone and block nothing of theirs. Step 6 needs their step 8. The
dynamic-vocabulary mechanism for `skill` needs designing before step 6 but not before,
and they have it recorded.

Nothing here needs to wait for the item field group — different kind, different registry.
