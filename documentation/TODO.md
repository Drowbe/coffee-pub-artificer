# TODO - Active Backlog

**Progress overview:** Current release **13.3.0**; **14.0.0** in progress (Foundry v14 migration). Completed work should live in **CHANGELOG.md**; this file is only for unfinished or newly discovered work.

## Current Focus

### CRITICAL — Migrate Windows to the Blacksmith Window API
- [ ] Replace Artificer's direct `HandlebarsApplicationMixin(ApplicationV2)` window implementations with the appropriate Blacksmith public base: `BlacksmithWindowBaseV2` for full editors/forms and `BlacksmithToolWindowBaseV2` only for lightweight persistent canvas tools. Reference: [Blacksmith Window API](https://github.com/Drowbe/coffee-pub-blacksmith/wiki/api-window).
  - **Import the bases from the bridge, NOT from `module.api`** (corrected 2026-08-22; the previous instruction here said the opposite and would have broken a live world):
    ```js
    import { BlacksmithWindowBaseV2, BlacksmithToolWindowBaseV2 } from '/modules/coffee-pub-blacksmith/api/blacksmith-api.js';
    ```
    `extends` is evaluated when our module script is evaluated, and `game` does not exist yet — a top-level `game.modules.get('coffee-pub-blacksmith')` throws `Cannot read properties of undefined (reading 'get')`, and ES modules cache a failed evaluation, so the throw disables Artificer for the entire session instead of being retried. Merchant hit this on 2026-08-19. `BLACKSMITH_WINDOW_STYLES`, `BLACKSMITH_TOOL_TITLEBARS` and `BLACKSMITH_TOOL_THEMES` come from the same path and are the same objects as `api.windowStyles` / `api.toolTitlebars` / `api.toolThemes`. `scripts/` paths are still not the contract; the bridge is. `module.api` stays correct for anything resolved after `init`.
- [x] ~~Artificer Item window~~ — **DONE 13.2.0.** Extends `BlacksmithWindowBaseV2` via the bridge, uses the zone contract, and its fields carry `blacksmith-input` / `blacksmith-select` / `blacksmith-textarea`. It is the reference for the rest.
- [ ] Audit and migrate the remaining windows: Crafting, Recipe Browser, Skills, Gather, and the experimental Crafting panel; document which base and zone layout each one uses. (Recipe Import is gone -- recipes import through Blacksmith's own Unified Import window now, no Artificer-owned window to migrate.)
- [ ] Register stable window IDs through `api.registerWindow()` for windows opened by Blacksmith bars, macros, or other modules, and route those callers through `api.openWindow()`; retain direct construction only where the Window API explicitly recommends it for ephemeral/multi-instance tools.
- [ ] Refactor window templates onto Blacksmith's zone contract (option bar, header, tools, body, action bar) while preserving existing actions, forms, scrolling, sizing, remembered positions, and singleton/multi-instance behavior.
- [ ] Replace Artificer's hardcoded dark window surfaces and field colors with the applicable Blacksmith window variables. **Note from the Artificer Item migration:** the blockers are `!important` rules and a fixed `height: 22px` in `shared.css` plus per-window overrides, which beat the shared classes at any specificity. Stand them down with `:not(.blacksmith-…)` rather than deleting — unmigrated windows still depend on them. For Tool windows, use the `--blacksmith-tool-*` field/content-surface family and verify fields, placeholders, focus rings, open dropdown options, sticky content, hover/selection states, and muted text under Light, Dark, and Glass themes.
- [ ] Add migration verification for opening every window from each supported entry point, closing/reopening, minimizing, resizing, position persistence, form submission, keyboard/focus behavior, and theme switching.

### CRITICAL — Migrate item grants to the Blacksmith Inventory API
Blacksmith is shipping `api.inventory` with four primitives: `grantItem`, `grantCurrency`, `transferItem`, `transferCurrency`. Only **`grantItem`** applies to us — `addCraftedItemToActor` has no source actor, it creates an item on an actor from item data, which `transferItem` cannot express.

**Shipped as of 2026-08-22**, along with a merge-predicate fix: it was comparing the submitted payload against the created row, but creation fills schema defaults, writes `system.identifier` from the name, and normalises `properties` — so constructed `itemData` could never merge into a row built from that same data. That unblocks the "do not start until it ships" gate. It does **not** answer our mixed-`compendiumSource` question below, which is still the thing to settle first.

- [ ] **Blocked on Blacksmith:** get a decision on the **mixed `compendiumSource` case** before migrating. Their merge rule is "compare `compendiumSource` when both items have one, never require it," and an item with a source and one without deliberately do **not** merge. That case is not an edge case for us — it is the default state of a configured world (see *Content / Pack Data Integrity* below). We asked for: merge when flags match and **at most one** side has a source; treat a missing source as *unknown*, not as *different*. Without that, gathering the same component twice can randomly produce two non-merging rows.
- [ ] Rewrite `addCraftedItemToActor` ([scripts/utility-artificer-item.js](../scripts/utility-artificer-item.js) L169-186) as a thin wrapper: resolve the actor UUID, call `blacksmith.inventory.grantItem({ targetActorUuid, itemData, quantity, stack: 'merge' })`, and **keep the existing return contract** (`Item|null`) so no caller changes.
- [ ] Pass `ignoreFlags: []` (or omit it). All seven Artificer flags ([scripts/schema-artificer-item.js](../scripts/schema-artificer-item.js) L171-179) are identity-bearing crafting data and must be compared. That option exists for modules writing transient UI state to item flags; we have none.
- [ ] Verify all five call sites still behave after the swap: gathering ([scripts/manager-gather.js](../scripts/manager-gather.js) L293), crafting ([scripts/window-crafting.js](../scripts/window-crafting.js) L237), experimentation ([scripts/systems/experimentation-engine.js](../scripts/systems/experimentation-engine.js) L104), and the two sludge grants ([scripts/window-crafting.js](../scripts/window-crafting.js) L2519, L2652). Note the crafting critical-success path calls the helper in a loop for `outputMultiplier` — confirm that still yields the right quantity.
- [ ] Tell Blacksmith if we ever start importing through `fromCompendium` in code, so they can confirm the mixed case still behaves.
- [ ] Adopt `grantCurrency` if Artificer ever pays out coin. It takes deltas, never absolute totals, and locks the actor — avoids the read-modify-write race.

**Two live bugs this migration fixes as a side effect** (measured 2026-08-07; both currently latent, do not patch locally unless they start losing data in play):
- [ ] **Flag-blind stacking.** `addCraftedItemToActor` matches on `name` + `type` only, so an item whose Artificer flags differ from one the actor holds is merged into it and the incoming variant's flags are discarded silently. Verified latent: quirk is set on 1 of 95 shipped components, affinity is empty everywhere, base and `-enhanced` packs are flag-identical, and no runtime path generates quirk or affinity — every grant copies a source item verbatim. Safe to let the migration fix this.
- [ ] **`uses.spent` loss.** The merge ignores `system.uses.spent`, so a partially-consumed item stacks into a full one and the spent charges vanish. **This is the one most likely to produce a real report** — 42 of 178 shipped creations have `uses.max > 1`. Currently latent only because no actor holds a partially-consumed Artificer item yet.

### Migrate recipe import to the Blacksmith Importer API
**Superseded note from 2026-08-25 was itself stale by 2026-10-07** — Blacksmith's Journal kind landed
2026-09-02, over a month before this was next touched. Do not trust a "blocked on" note's age; re-check the
dependency before believing it. See [plans/plan-recipe-field-mappings.md](plans/plan-recipe-field-mappings.md)
for the full history (Track A, then widened to Track B) and everything verified against Blacksmith's actual
source.

**Track B, done 2026-10-08: recipes import exclusively through Blacksmith's Unified Import window.** Items
never had a separate Artificer import window either (only a field group attached to Blacksmith's own item
profiles) — recipes now match that shape. No code on our side builds a document or calls
`createEmbeddedDocuments` for a recipe any more; Blacksmith's importer does both construction and
placement, driven entirely by the declaration.

- [x] ~~Recipe declaration covers construction AND destination.~~ **DONE 2026-10-08** —
      `scripts/declarations/declaration-artificer-recipe.js`: `journaltype` selector (`extraFields`),
      `title` → `path: 'name'`, `description` → `path: 'text.content'`,
      `containerNameFrom: 'book'` / `folderNameFrom: 'skill'`. No image field — confirmed recipes have none;
      every icon on a recipe page is resolved at render time from the item cache by name
      (`sheet-recipe-page.js`), not stored on the recipe. No folder-casing transform needed — Blacksmith's
      `ensureJournalFolder` matches an existing folder case-insensitively and creates a new one verbatim
      (confirmed with Blacksmith directly; a transform was tried before and mangled proper nouns).
- [x] ~~Retire the Artificer-owned import window.~~ **DONE 2026-10-08** — deleted
      `window-artificer-recipe-import.js` and its template and stylesheet, the "Import Recipes"
      secondary-bar button, and the module.json/`default.css` entries pointing at them.
      `utility-artificer-recipe-import.js` trimmed to just `buildRecipePageHtml`/`escapeHtml` (still used by
      the legacy-page maintenance macros below) and renamed to
      `utility-artificer-recipe-legacy-html.js` to match what it actually does now.
- [x] ~~`storage-recipes.js` finds recipes by page type, not a configured journal.~~ **DONE 2026-10-08** —
      world journals are scanned for pages of type `coffee-pub-artificer.recipe` directly; several "book"
      journals per skill folder is the normal case (confirmed against the live world), and the old loader
      could only ever see one. `recipeJournalName`/`recipeJournalFolder` settings deleted outright (module
      unreleased, single world, confirmed zero legacy-format pages exist — no backward compatibility to
      preserve). `window-crafting.js`'s `getRecipeSourceJournals()` deleted too — turned out to be dead
      code, never called; `getRecipeJournalOptionsByFolder()` (the function that IS live) already handled
      multiple journals/folders correctly, it just never had more than one to show before.
- [x] ~~Legacy-page scanning decision.~~ **DONE 2026-10-08** — moot. Verified live (console query, zero
      matches) that no `type: 'text'` recipe pages exist anywhere in the world. `cleanAndRewriteRecipePages`/
      `applyPotionBrewingData` (storage-recipes.js) still exist for a world that does have some, now scanning
      every world journal rather than a configured one — safe there specifically because both are
      deliberate, GM-invoked, dry-run-capable macros the GM reviews before committing, not a background scan.
- [x] ~~Test in a live world, through the Unified Import window.~~ **DONE 2026-10-08** — all four cases
      passed: new book created in an existing skill folder (Alchemy), a second page added into an existing
      book, a second skill folder, and a re-import by matching title updated the existing page in place
      rather than duplicating it. Page type, field round-trip, title/body placement, and `RecipePageSheet`
      rendering all confirmed correct, including the optional fields (DC/Work/Cost) a second payload
      exercised that the first test payload had deliberately left out.
- [ ] Still open with Blacksmith: a profile-level `preamble` (for the DM-persona/process framing
      `prompts/artificer-recipe.txt` carries) and whether their Prompt Template tab has any slot for a
      separate image-generation prompt. Neither blocks the above.
- [ ] **Housekeeping:** `plans/plan-recipe-field-mappings.md` should be deleted per the standard plan
      workflow (its narrative is distributed above and into architecture 11.5 already), but its field
      table + notes 1-4 (vocabularies, the container/apparatus alias bug, punctuation normalisation) are
      still genuinely useful as a reference for the LEGACY HTML format `RecipeParser`/
      `utility-artificer-recipe-legacy-html.js` read/write — not yet folded into architecture. Fold that
      table in, then delete the plan doc. Notes 5 (duplicate policy) and 6 (our own button) are already
      resolved/obsolete and do not need carrying forward.

### CRITICAL — Evolve the recipe Prompt Template, raised 2026-10-08
Author's ask, from comparing our Prompt Template tab against the Area Narrative one in Blacksmith's own
Unified Import window: Area's tab offers Location Path fields, Generation Direction dropdowns, and —
the part that matters most — **Compendium Actors / Compendium Items checklists** that inject a real,
world-accurate catalog of names into the generated prompt, so the LLM references actual items instead of
inventing them. Ours offers only "Select Prompt Template" + a single "Additional Guidance" textarea.

**Confirmed by reading the code, not assumed: this is not reachable today, for any declared satellite
profile, recipe or otherwise.** `buildJournalPrompt` (`registry-json-import-journals.js:1226`) special-cases
exactly four literal keys — `area`, `illustration`, `location`, `encounter` — each wired to its own
hand-authored prompt file and kind-level UI getter (`journalAreaUi`, `getJournalAreaImportUi()`,
`AREA_GENERATION_OPTIONS`, `applyAreaCatalogSections` with its `[ADD-COMPENDIUM-ITEMS-HERE]` placeholder
substitution). Every other profile key — including `recipe` — falls through to `buildPromptSchemaText`,
the generic declaration-derived prompt (fields, `guidance`, `examples`, `rules` only; confirmed no catalog
mechanism exists there). `promptFields` (the one authoring-time extension point a declared profile does
have) only renders `text`/`select`/`textarea` controls with static, registration-time options — no
compendium picker, no dynamically-fetched catalog, and unsuited to a world-configurable list like our
enabled skills (already noted when this was first raised with Blacksmith).

So this is a genuine capability gap, in the same family as the profile-`preamble` request below — not
something fixable by editing our own declaration alone.

- [x] ~~Review Bibliosoph's injury profile for prior art.~~ **DONE 2026-10-08** — it uses `promptFields`
      for exactly one select ("damage type"), a genuinely fixed vocabulary. Confirms `promptFields` is
      real but narrow: static `text`/`select`/`textarea` only, registered once, no catalog mechanism, no
      cross-field dependency (one field's options cannot depend on another field's chosen value). Nobody
      has asked Blacksmith for catalog injection on a declared profile before.
- [x] ~~Profile-level `preamble`.~~ **SHIPPED by Blacksmith 2026-10-08** (their side staged, not yet
      committed/released — author reloads and commits there too) **and wired in on ours**:
      `declaration-artificer-recipe.js`'s `RECIPE_PREAMBLE` covers the generator role, the two-step
      "JSON first, then ask about the image" instruction, and cross-field relationships a single field's
      `guidance` can't carry (rarity/skillLevel/DC bands, type-before-category, ingredient family being a
      subtype of the ingredient's own type, not the recipe's). Added to `suite-recipe-declaration.js` too
      (asserts `preamble` is a non-empty string). **Not yet verified live** — added after the author went
      to bed; needs a reload + harness run (or a real generation) to confirm Blacksmith's build actually
      renders it before the FIELDS list as documented, and that `declarationFromModel` forwards it
      correctly (code-read confirms it should: `preamble` isn't a named destructured key in
      `declarationFromModel`, so it passes through the `...declaration` spread untouched).
- [x] ~~Scope the catalog request instead of asking Blacksmith to design blind.~~ **DONE 2026-10-08**,
      grounded by reading `scripts/cache/cache-items.js` (the item cache `buildDocumentData` and every
      runtime name-resolution already draws from):
      - **Source:** the exact same set already used for ingredient/result name resolution — GM-configured
        Item compendiums (`ingredientCompendium1..N` settings, via `getConfiguredCompendiumIds()`) plus
        all world items. No new picker UI needed; Artificer already has the GM-facing settings that pick
        this, unlike Area which has none of its own and needs the checkbox UI for that reason.
      - **Contents:** NOT Artificer-flagged items only — mundane D&D items (Flask of Oil, Charcoal) are
        legitimate ingredients too, matched by name alone. Include everything the cache already indexes.
      - **Grouping:** by `artificerType` (Component / Creation / Tool / none) then by `family` within
        each — the exact two dimensions `ingredients[].type`/`.family` match against, confirmed from
        `itemToRecord()`'s record shape. Not by rarity (Area's axis); rarity isn't how a recipe looks up
        an ingredient.
      - **"Kinds of recipes"** is likely two different things under one label, not one: (1) `type`/
        `category` classification of the crafted RESULT — `type` is already a fixed enum
        (`ITEM_TYPES`), `category` has a known closed-ish vocabulary per type (see the Fields table
        above) — achievable via `promptFields` TODAY, no new mechanism needed, not blocked on this
        request. (2) `skill` — genuinely world-configurable, cannot be a static `promptFields` select,
        the actual reason a declarative catalog/vocabulary mechanism matters here. Flagged to Blacksmith
        as our best reading, not confirmed by the author (asleep) — may need correcting.
      - Sent to Blacksmith 2026-10-08 with these answers plus their proposed `promptCatalogs` design
        (a declarative source/filter/grouping descriptor Blacksmith fetches and renders, we only
        describe intent) endorsed as the right shape.
      - **Blacksmith wrote a real plan** (their own `plan-prompt-catalogs.md`, in their
        `documentation/plans/` directory — private to them, not in this repo, summarized here): both
        findings above confirmed and changed their design — grouping settles on names + D&D item
        type only (our `family` derivation has a real, demonstrated mislabeling case: a plain SRD
        "Longsword" would catalog as family "Environmental", since `itemToRecord()` only derives a
        real family for Artificer-flagged items or consumables; everything else falls to that blanket
        default). Source had two options (D: our shipped packs + Blacksmith's mapping; E: D plus
        Blacksmith also reading our `ingredientCompendium1..N` settings directly) — **decided by the
        author 2026-10-09: Option A, neither D nor E.** The catalog sources from Blacksmith's
        Compendium Mapping only, plus optionally world items. Explicit reasoning from the author:
        `ingredientCompendium1..N` exists for what Artificer uses to PROCESS things at craft time
        (resolve ingredient/result names), not for authoring or import — the two are different
        purposes and the settings should not be repurposed for the second one. If a GM wants our
        bundled packs (components/creations/tools) in the catalog, they map them in Blacksmith's own
        Compendium Mapping, same as any other module's content. **Do not change
        `ingredientCompendium1..N` or its defaults over this.**
      - **DONE, nothing further to decide.** Blacksmith is building `promptCatalogs` now — a declared
        catalog scoped to a profile, rendered as a checkbox in the Unified Import prompt window,
        fetched with `query()` against the GM's mapping, injected into the derived prompt. Names only,
        grouped by D&D item type, first version. They will send the exact declaration key once built;
        add it to `declaration-artificer-recipe.js` then. Nothing to build on our side until that key
        arrives.
      - [x] ~~Add `promptCatalogs` to the declaration.~~ **DONE 2026-10-09, corrected same day.**
        First draft used an object form (`{ id: 'items', label: 'Available items', type: 'Item',
        includeWorld: true }`) that Blacksmith's own first spec had invented rather than reusing
        Area Narrative's existing catalog UI. **The author caught this** before it shipped and had
        Blacksmith correct course. Fixed value: `promptCatalogs: ['items']` — a named reference to
        Blacksmith's EXISTING per-compendium checkbox UI (Select All/None, remembered selection, a
        World section), the same one Area's prompt already uses, not a second shape of our own. The
        object form is REJECTED at registration now; leaving it would have failed the profile
        entirely. Preamble still references the catalog conditionally. Suite updated to assert
        `promptCatalogs` equals `['items']` exactly. Syntax-checked, import/doc-link checks pass.
        **Not run live** — unstaged/uncommitted on Blacksmith's side too, never exercised in a real
        Foundry session by either side; needs the author to reload with both modules before this can
        be called verified.
- [ ] Separately, not blocked on Blacksmith: add `type` (and possibly a per-type `category` hint via
      `guidance` prose, since `promptFields` options can't depend on another field's answer) as a
      `promptFields` entry now that `promptFields` itself is understood — achievable today, just not
      done yet.
- [ ] **Found while writing the new preamble, pre-existing and unrelated to this session's changes:**
      `prompts/artificer-recipe.txt`'s TYPE list (`Consumable`/`Container`/`Equipment`/`Loot`/`Tool`/
      `Weapon` — the real dnd5e document-type enum) does not match `schema-recipes.js`'s actual
      `ITEM_TYPES` (`Weapon`/`Armor`/`Consumable`/`Tool`/`Gadget`/`Trinket`/`ArcaneDevice` —
      `RecipePageModel`'s real `choices`, confirmed by reading the schema directly). Following the
      prompt file's own TYPE guidance today generates JSON the model rejects (e.g. `"Container"`,
      `"Equipment"` are not in `choices`). Caught by catching myself about to repeat the same wrong
      values in the new `preamble` (fixed there — no type→category example invented without
      verification). Decide which vocabulary is actually correct and fix whichever side is wrong; did
      not guess here, since neither file states which one the author intends.

### Retire buildItemSystem for Blacksmith's declaration assembler
Blacksmith put construction on the public API (2026-08-31): `validateEntry`, `validateEntryDeep`,
`buildDocumentData`, `buildDocumentUpdate`, `getAuthoringGuide` on `api.importer`. Until now we could
declare a shape and have it validated but could not ask them to build the document.

`buildItemSystem` ([utility-artificer-item.js:216](../scripts/utility-artificer-item.js#L216)) is a second
implementation of what their Item declarations derive: price parsing, rarity normalising, source shaping,
consumable type/uses/activities/properties mapping. Only the authoring window reaches it, through two
callers -- `createArtificerItem:133` and `updateArtificerItem:202`. There is exactly one
`Item.createDocuments` in the module (`:143`), so destination, permissions and rollback are already ours
and nothing about them changes.

**Both paths move; `buildItemSystem` goes entirely.** Blacksmith shipped
`buildDocumentUpdate(kindId, profileId, entry)` (2026-08-31) as a second mode of the same assembler, not a
parallel builder. It never writes document `type` or any const -- so the retype fix at
[window-artificer-item.js:648-663](../scripts/window-artificer-item.js#L648-L663) stays load-bearing and is
not fought -- applies no creation defaults, and skips derivations. Transforms still run.

**Its contract is blank-versus-absent, and our form does not currently honour that.** Absent preserves;
present-but-empty clears. Our submit path decides inclusion by truthiness -- `if (quirkVal)
artificerData.quirk = ...` ([window-artificer-item.js:624](../scripts/window-artificer-item.js#L624)), and
`buildArtificerFlags` repeats it at `utility-artificer-item.js:348` -- so a blank field is *omitted*, not
sent as empty.

- [ ] **A quirk cannot be cleared today.** Blank omits the key, `Document#update` merges, and the old
      value survives. Pre-existing and independent of this port; the new contract just makes it legible.
      Same shape for `processSound`. Decide per field which blanks mean "clear" and send those as empty
      rather than dropping them. Verified by: clear a quirk on an existing component, save, reopen, and
      confirm it is gone.
- [ ] Keep the deliberate source stamp when porting the edit path. `window-artificer-item.js:649-651`
      force-writes `SOURCE_LABEL` on every update. That is the authoring window stating a fact about its
      own provenance, not an invented default, and it must stay an explicitly supplied field.
- [ ] Move the update path onto `buildDocumentUpdate('item', profile, entry)`. Verified by: edit one item
      of each family, save, and confirm quantity, uses and identified are untouched.
- [ ] Move the create path onto `buildDocumentData('item', profile, entry)`, mapping form fields to the
      friendly names the Item profiles declare. Verified by: author one item of each family in a live
      world and diff the resulting `system` against an item created by the current path.
- [ ] Call `validateEntryDeep` before create so the form rejects bad input the way the importer does.
      Errors carry a code and a dotted path; surface the path, since the form has a field to point at.
- [ ] Delete `buildItemSystem` and its consumable/price/rarity/source branches once both paths are moved.
      Note what is lost: `:244` reads `system.type.value` first and falls back to `system.consumableType`.
      That fallback is our documented reader behaviour, not drift -- confirm nothing still authors the
      legacy shape before dropping it.

### Every scene gathers; retire the per-scene enable
Built 2026-08-31. Plan [plans/plan-scene-opt-in.md](plans/plan-scene-opt-in.md) is absorbed and can be
deleted once this is verified in a live world.

- [x] ~~One resolver owns the effective gather settings.~~ `systems/scene-gather-profile.js`, synchronous
      and pure so the Scene Config render hook can call it without awaiting. Both the tab and
      `_getSceneGatherSettings` read it.
- [x] ~~Close the componentTypes gap.~~ An unconfigured scene now resolves to every component family in
      both places instead of all-in-the-form and none-in-the-engine.
- [x] ~~Delete `enabled`.~~ Checkbox and all three reads gone. Discovery pins no longer gated on it.
- [x] ~~Decide `profile`.~~ Deleted. Nothing read it; a control implying a feature was the one dishonest
      option.
- [x] ~~Repoint the scene-directory badge.~~ `isTuned`, not `isConfigurable`.
- [x] ~~Resolve `flags.defaultDC`.~~ Kept as a read-only fallback with the reason in the resolver: no form
      writes it, but worlds predating the DC split may carry it. Writer retired it; reader keeps it.
- [ ] **Verify in a live world.** The harness covers the resolver; these two need a person:
      (a) a scene with a habitat and nothing else configured yields components of every family;
      (b) a scene that previously had Artificer switched off shows its existing discovery pins again.
- [ ] Delete `plans/plan-scene-opt-in.md` once (a) and (b) pass. Absorbed is the trigger, not implemented.

### Hand scene habitats to Blacksmith's Scene Config
Blacksmith is pulling scene-level geography into Scene Config (their `TODO.md`, opened 2026-08-27, and
`plans/plan-scene-geography.md`). Habitat currently lives on our flag at
`flags.coffee-pub-artificer.scene.habitats`, and Minstrel reads that flag raw. Suite coordination is in
Blacksmith's `TODO-GLOBAL.md`.

**Blocked on Blacksmith shipping the injector and the API.** Do not add a second `renderSceneConfig`
handler — the last one lost its tab between reloads to a render race against Foundry's `_replaceHTML`.
There will be one injector; we register a harvest tab through it.

**Settled 2026-08-31.** The environment vocabulary stays a closed twelve-value enum, moved to Blacksmith
and exposed as a constant rather than a registry, so the "what does an unknown environment do to harvest
tables" question is retired. Canonical case is **lowercase**. The migration is a **hard cut at `ready`** --
no read-through fallback to our own flag, because two sources with two cases feeding one case-sensitive
join is how a half-migrated scene hides itself. `_hasGatheringConfigured` requires `habitats.length > 0`,
so a hard cut makes a failed migration loud (badge off, no gather) instead of silently gathering against
stale data.

**Do not build the hard cut on `BlacksmithAPI.waitForReady()`.** That promise only ever resolves, never
rejects, and `bailOutOfReady` deliberately calls `markReadyForConsumers()` after a failure so consumers get
a degraded API rather than hanging (`coffee-pub-blacksmith/scripts/blacksmith.js:470-493`). If their `ready`
bails before the geography migration runs, our await resolves, we read a migrated-looking API with no
habitats, and the hard cut converts that into silent data loss -- the exact failure the hard cut was chosen
to make loud. Blacksmith is adding a migration-complete signal that separates "migration ran" from "marked
ready degraded"; wait for it.

**Habitat is a join key, not just a display value, and that is the whole risk here.**
`getEligibleGatherRecords` ([manager-gather.js:223-236](../scripts/manager-gather.js#L223-L236)) intersects
scene habitats against *item* biomes with a case-sensitive `Set.has`. Item biomes stay on our items. If the
two sides disagree about case, gather does not break -- line 234 makes an item with no biomes eligible
everywhere, so it keeps working and returns a narrower, plausible pool of only the untagged components.

- [x] ~~Normalize case at every biome read; delete `getBiomeOptions`.~~ **DONE 2026-08-31** --
      `normalizeBiome` / `normalizeBiomeList` in `schema-ingredients.js` are now the only place that
      decides case, so the switch to Blacksmith's lowercase constant is a one-line change. No raw
      comparison against a stored biome remains anywhere.
- [x] ~~Establish what the scene-config checkbox group actually wrote.~~ **ANSWERED 2026-08-31** -- neither
      an empty array nor an omitted key: one null per unticked box, which our normalizer stringified into
      literal `"null"` entries. Fixed at the root in `normalizeCheckboxList`. See the CHANGELOG.
- [ ] **Check production worlds for junk habitat/componentType/harvestingSkills flags.** The null bug did
      NOT require the lowercase vocabulary -- it fired whenever a group was fully unticked and Scene Config
      was saved, which is the normal state of a scene nobody configured. So unlike the case hazard, its
      window has been open all along. The fix stops new junk and makes existing junk read as empty rather
      than as configuration, so nothing is broken by leaving it; this is a cleanup question, not a
      correctness one. Verified by: scan scenes for a `habitats` entry that `normalizeBiome` rejects.

- [ ] Keep the twelve harvest-specific keys (`componentTypes`, `harvestingSkills`, `enabled`, `profile`,
      DCs, gather spots, discovery) on our own flag. Those encode what this module is for.
- [x] ~~Hand `habitats` to Blacksmith's scene geography; hard cut at `ready`.~~ **DONE 2026-08-31** --
      all five sites moved to `getSceneHabitats()` (`utils/helpers.js`, a zero-import leaf), the Habitats
      fieldset is now a read-only summary pointing at the Geography tab, and `artificer.js` refuses to
      initialise when `waitForReadyStatus()` reports `degraded`. Two harness checks enforce it.
      **NOT YET VERIFIED IN A LIVE WORLD** -- see below; that is the only check that counts.
- [ ] **Verify the cut in a live world.** Two things, and non-emptiness proves neither:
      (a) habitats come back LOWERCASE and in VOCABULARY order -- uppercase or alphabetical means our own
      flag answered and we are on a stale path;
      (b) gather on a previously-configured scene yields the SAME component families it did before. That
      is the one that catches a migration which ran and transformed wrongly, and no static check or
      harness assertion can reach it.
- [ ] **Sweep whatever renders the refuse-to-start state, by word and across file types.** It is a
      console error and a notification today, so there is no markup surface -- but the hard cut has given
      us the cross-module availability gate that Minstrel's disabled-`<select>` bug lived in, and that
      class is invisible to any `.js` sweep.
- [ ] Declare the Blacksmith version floor in `module.json` -- the dependency carries an empty
      `compatibility` block today, so a new Artificer against an old Blacksmith finds neither the API nor
      the flag and habitats are simply gone. See the two floor items above: 13.22.0 for the vocabulary,
      the migration release for the cut.
- [x] ~~Drop `OFFICIAL_BIOMES` and read the vocabulary from the API.~~ **DONE 2026-08-31** --
      `getBiomeVocabulary()` / `getBiomeKeys()` / `getBiomeLabel()` resolve from
      `api.geography.HABITATS` with a fallback. Templates now round-trip `key` and display `label`.
      The field-group declaration became `buildArtificerItemFieldGroup()`, called at `ready`, because a
      module-scope literal captured the fallback.
- [x] ~~Pin Blacksmith minimum 13.22.0 and delete the local habitat vocabulary.~~ **DONE 13.3.0** --
      `module.json` declares `compatibility.minimum` on the Blacksmith dependency and
      `schema-ingredients.js` no longer carries a fallback array, so there is one vocabulary and one
      canonical case.
- [ ] **DO NOT TAG 13.3.0 UNTIL BLACKSMITH 13.22.0 IS RELEASED.** Their `module.json` still reads
      13.21.1 and no 13.22 tag exists. A module whose declared dependency minimum does not exist will
      not activate, so tagging first ships a release that cannot run. Verify with
      `git -C ../coffee-pub-blacksmith tag --list "*13.22*"` before the BUILD commit.
- [ ] Register the harvest tab through their Scene Config injector and delete `_injectArtificerTab`,
      `_injectArtificerTabV2` and both guard collections (`manager-scene.js:119`, `:137`, registered at
      `:35-49`).
- [ ] **Replace the injected tab with a button that opens our own window.** Sequence AFTER the habitat
      migration: habitats are what is leaving, and what remains is the twelve harvest-specific keys, which
      are Artificer configuration rather than scene geography. Building the window around habitats first
      means gutting it.
      The argument is the scene-config bug above. Those checkboxes are plain inputs on Foundry's form, so
      we do not own the submit and cannot put a guard behind them -- which is exactly why the item sheet
      survived the same case defect and the scene tab did not. Owning the window lets the habitat rule
      apply in both places, lets the harness drive the surface, makes it reachable from the scene directory
      and a macro rather than only from Scene Config, and shrinks what we ask Blacksmith's injector to
      place from a tab to a button.
      When this lands it deletes `_injectArtificerTab`, `_injectArtificerTabV2` and the active-tab
      reconstruction at `manager-scene.js:414-432`. **Do not refactor that reconstruction in the
      meantime** -- it works, and it is scheduled for deletion. If it ever is rewritten, the shorter path
      is `app.tabGroups[group]` rather than capturing intent before the re-bind: `_prepareTabs`
      (Foundry `client/applications/api/application.mjs:598`) assigns with `??=`, so an id Foundry does
      not recognise is PRESERVED in `tabGroups` while no core tab matches it and none of core's panels
      get `.active`. After a render the markup and `tabGroups` disagree, and `tabGroups` is the one
      telling the truth. Verified in the Foundry source, from Blacksmith's diagnosis of the same trap.
      **Decide save semantics first.** Scene Config has its own Save/Cancel; a window that writes flags
      immediately lets a GM cancel Scene Config and still have our changes persisted. Preference is an
      explicit Save of our own that plainly owns its data, rather than staging into the parent form --
      staging re-couples us to the submit we are trying to stop depending on, which is the whole point.

- [ ] Re-export the compendium packs to lowercase biomes. **Cosmetic once the join is normalized** --
      deliberately NOT in Blacksmith's release window, and not a blocker. Close the world before
      committing the packs.
- [ ] Verify gather on a migrated scene still yields the same component families, and that a scene
      exported to a compendium and re-imported still carries environment. First post-migration test, not
      an afterthought.

### Recipes and Processes
Recipes are a real data model and processes are items as of 13.2.0 — see
[plans/plan-recipe-data-model.md](plans/plan-recipe-data-model.md) for what shipped and what is left.

- [ ] Send Blacksmith what `onReplace: { preserve: [...] }` actually needed to hold. Answered from the
      recipe conversion rather than predicted: `_id`, `sort`, `ownership`, `title`.
- [ ] Decide whether the `settle` motion is distinguishable from `none` in play. Only Dry uses it; the CSS
      says to drop it if not.
- [ ] Delete the world copies of the Process items now that they ship in the Tools compendium. The
      `itemLookupOrder` de-dupe handles them, but two copies can silently diverge.

### Gather / Pins Reliability
- [ ] Eliminate the player-driven gather/discovery completion race around request-roll message context and GM-side resolution.
- [ ] Verify gather-node consume/delete behavior across GM and player clients after harvest success and failure.
- [ ] Build a tiny Artificer + Blacksmith repro harness for gather/discovery pin lifecycle issues and share it with the Blacksmith API dev.

### Skills System
- [ ] Implement actual skill progression and XP gain.
- [ ] Implement skill-level gating for recipes, blueprints, and other downstream systems.
- [ ] Add level-up / progression notifications.

### Re-verify the copied hub tooling
- [ ] **`tools/check-docs-structure.mjs` was copied from Blacksmith's WORKING TREE, not their HEAD**
      (2026-09-01, hub HEAD `64a48d6a`). It carried an uncommitted fix we needed -- the per-group sidebar
      dedupe and the heading check no longer firing on the verb "Open". Their author had not committed it
      yet. Re-copy and re-verify once they have, because a copy taken from a dirty tree can diverge from
      what eventually lands without either side noticing. The other four files came from committed state.
      Verify by: `sha256sum tools/check-docs-structure.mjs` against
      `git -C ../coffee-pub-blacksmith show HEAD:tools/check-docs-structure.mjs | sha256sum`.

## High Priority

### Blacksmith Pins API Collaboration
- [ ] Propose `pins.consume(pinId, options)` for atomic cue + delete + client-safe cleanup.
- [ ] Propose `pins.setState(pinId, stateId, options)` for declarative transient pin states managed by the renderer.
- [ ] Propose a per-pin mutation lock / queue helper (`pins.withLock(pinId, fn)`) to prevent update/delete/animation interleaving.
- [ ] Request a renderer lifecycle guarantee that deleting a pin removes all render artifacts on every client.
- [ ] Request a render-finalized delete hook (for example `blacksmith.pins.deletedRendered`) for deterministic follow-up work.

### Blacksmith Chat Cards API Collaboration
- [x] Migrated every Artificer chat card to `chatCards.post` parts (gather success/consolation/failure/empty, explore/populate, craft result, GM "not configured" whisper). No card HTML, theme class, or local card CSS remains in this module.
- [x] Asked Blacksmith for literal text; they shipped `{ literal }` plus array segments (2026-08-15). Artificer now passes every item, actor, scene and perk name as a literal segment and `plainText()` is deleted.
- [x] Reported the `rows` uuid injection to Blacksmith; they shipped `documentLinkOrText` + `escapeEnricherLabel`.
- [x] Follow-up accepted: the brace encoding could not work, because `enrichHTML` decodes entities at `innerHTML` (foundry.mjs:31520) before the content-link regex runs over text nodes (foundry.mjs:31592). Blacksmith now builds the anchor with `doc.toAnchor({ name })`, so no enricher syntax is written at all, and our hostile-name fixture is a permanent regression case in their repo.
- [x] Audited Artificer for the same construction: we build no `@UUID[...]` anywhere (the migration removed the last of it), and the recipe parser strips link syntax on import via `extractNameFromUuidLink`, so no card receives enricher syntax from recipe data. Nothing to change.

### Content / Pack Data Integrity
Measured 2026-08-07 against the `burden-of-knowledge` world and the shipped packs.

- [ ] **Decide which copy of the creations is authoritative.** 102 of 178 creation names have a different `artificerSkillLevel` in the world than in the shipped `creations` pack, and the world copies are consistently lower (Acid Tablets 6→2, Angel's Powder 6→3, Assassin's Blood 6→3). Nothing else differs. The world copy silently wins whenever the item cache is built, so play currently runs on the lower numbers. Confirm that is intentional tuning and not a stale import, then reconcile one direction.
- [ ] **Resolve the world/pack duplication.** Shipped packs carry no `_stats.compendiumSource` (0 of 564 items); 278 of 281 Artificer-flagged world items do, because the GM imported them by drag-drop. The item cache indexes compendia *and* world ([scripts/cache/cache-items.js](../scripts/cache/cache-items.js) L365-368), so both copies land in the same pool: all 96 gatherable component names appear **exactly twice**, and `pickOneGatherRecord` chooses between them at random. Flags are identical so it is harmless today, but it is the direct cause of the `grantItem` mixed-case problem above.
- [ ] Note that `_cache` is keyed by normalized **name only**, not name + type ([scripts/cache/cache-items.js](../scripts/cache/cache-items.js) L290-297), so the five components that ship as both `base` and `consumable` (Golden Lotus Petal, Wyvern Stinger, Ankheg Ichor, Spider Venom, Bloodroot) collapse to a single cache entry. Confirm that is intended.

### Experimentation model (architecture section 7.0)
Rescued from a status board deleted out of `architecture-artificer.md` on 2026-09-01; the design is still
in that document, this is the outstanding work.

- [ ] Implement the full experimentation model: solvent selection, quantity inputs, temperature and time.
      Tag-based matching works today; this is the enhancement on top of it.

### Workstations
- [ ] Create an `ArtificerWorkstation` data model implementation.
- [ ] Create workstation data definitions.
- [ ] Implement workstation placement.
- [ ] **Sequential placement:** When multiple components must be placed on the scene (e.g. 7 of 7 parts), run a guided GM flow: show **“Place 1 of N”** (then 2 of N, …), require **one canvas click per placement**, and advance/cancel cleanly. Generalize beyond workstations if the same pattern applies to gather pins or other multi-drop flows.
- [ ] Integrate workstation modifiers with crafting.
- [ ] Create workstation browsing / management UI.

### Recipes / Blueprints
- [ ] Create `RecipeForm` for editing.
- [ ] Implement recipe unlock / discovery systems.
- [ ] Create `BlueprintForm` for editing.
- [ ] Create `BlueprintPanel` for browsing.
- [ ] Implement multi-stage blueprint crafting flow.
- [ ] Implement blueprint progress tracking UI / flow.

### Salvage
- [ ] Implement salvage rules engine.
- [ ] Create salvage UI.
- [ ] Implement salvage yield calculation.
- [ ] Integrate salvage with Foundry item sheets / item actions.

## Medium Priority

### Theme support
- [ ] Let users map **core interface images** (window chrome, panel backgrounds, key icons, empty states, etc.) to their preferred assets—via module settings, a small theme manifest, or both—so the UI can match a campaign or module art pack without forking CSS.

### Item packs
- [ ] Define a **generic/base catalog** of Artificer items (logical ids, rules, tags) and treat **visual/name flavor** as swappable **packs** (e.g. “vanilla fantasy”, “grimdark”, community pack).
- [ ] Pack selection + validation: resolve items through the active pack, fall back safely, and document how authors ship alternate packs.

### Initial Content
- [ ] Add starter ingredient examples.
- [ ] Add starter component examples.
- [ ] Add starter essence examples.
- [ ] Add example recipes.
- [ ] Add an example blueprint.

### Experimentation
- [ ] Finish the family + trait combination algorithm.
- [ ] Implement trait discovery / progressive reveal.
- [ ] Implement item generation from family + trait combinations.
- [ ] Add quality / stability calculation based on skill, workstation, and rarity.
- [ ] `CraftingExperimentPanel` (`scripts/panel-crafting-experiment.js`) is not instantiated from any
      menubar entry or hook -- confirmed by grep, nothing outside the file itself references the class.
      Before wiring it up: its actor-selector dropdown's `change` handler is defined only inside the dead
      `activateListeners(html)` method (see CHANGELOG `[Unreleased]`, same bug class as the recipe-import
      window fix), with no `data-action`/`actions:` equivalent -- `ApplicationV2`'s action dispatch only
      handles clicks. Move it to `_onRender` the same way, before anyone can reach this panel and find the
      crafter picker silently does nothing. Verify by: open the panel, change the actor dropdown, confirm
      the ingredient list repopulates for the new actor.
- [ ] Delete the four now-confirmed-inert `activateListeners(html)` methods that redundantly re-call an
      already-correctly-wired setup function: `window-artificer-item.js`, `window-crafting.js`,
      `window-gather.js`, `window-skills.js`. Harmless today, but a future edit to one of them is exactly
      how a second real instance of this bug gets written -- someone adds a new listener to the "wrong"
      copy because both exist and look equally live. Low priority. Verify by: each window still opens and
      every control still responds after the dead method is removed.

### Recipe / Blueprint Portability
- [ ] Add recipe / blueprint export and import support.
- [ ] Define a community content format.

### Notifications / Validation
- [ ] Add broader notification integration for discoveries, crafting events, and progression.
- [ ] Add dedicated content validation tooling for packs / imported content.

## Deferred

### Gathering Expansion
- [ ] Create mini-game framework.
- [ ] Implement timing bar mini-game.
- [ ] Implement radial spinner mini-game.
- [ ] Implement quick-match mini-game.
- [ ] Integrate mini-games with gathering.
- [ ] Add advanced biome logic (weather, time-of-day).
- [ ] Add proximity / visual indicators for gathering.

### UI / Polish
- [ ] Add drag-and-drop ingredient slots.
- [ ] Add advanced crafting UI features.
- [ ] Performance optimization.
- [ ] UX polish (tooltips, shortcuts, bulk operations).
- [ ] Complete localization support.
- [ ] Harden remaining error handling paths.

## Notes

- Questions marked with **Q##** in older docs were already resolved; keep decisions in `documentation/architecture/architecture-artificer.md` and shipped history in `CHANGELOG.md`.
- Discovery-based gather spots and canvas gather pins are already implemented; remaining work is reliability and lifecycle cleanup, not initial pin support.
- Skill perk persistence to actor flags is already implemented; the remaining skill work is progression, gating, and notifications.
