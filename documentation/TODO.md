# TODO - Active Backlog

**Progress overview:** Current release **v13.1.1**; **13.2.0** in progress. Completed work should live in **CHANGELOG.md**; this file is only for unfinished or newly discovered work.

## Current Focus

### CRITICAL — Migrate Windows to the Blacksmith Window API
- [ ] Replace Artificer's direct `HandlebarsApplicationMixin(ApplicationV2)` window implementations with the appropriate Blacksmith public base: `BlacksmithWindowBaseV2` for full editors/forms and `BlacksmithToolWindowBaseV2` only for lightweight persistent canvas tools. Reference: [Blacksmith Window API](https://github.com/Drowbe/coffee-pub-blacksmith/wiki/api-window).
  - **Import the bases from the bridge, NOT from `module.api`** (corrected 2026-08-22; the previous instruction here said the opposite and would have broken a live world):
    ```js
    import { BlacksmithWindowBaseV2, BlacksmithToolWindowBaseV2 } from '/modules/coffee-pub-blacksmith/api/blacksmith-api.js';
    ```
    `extends` is evaluated when our module script is evaluated, and `game` does not exist yet — a top-level `game.modules.get('coffee-pub-blacksmith')` throws `Cannot read properties of undefined (reading 'get')`, and ES modules cache a failed evaluation, so the throw disables Artificer for the entire session instead of being retried. Merchant hit this on 2026-08-19. `BLACKSMITH_WINDOW_STYLES`, `BLACKSMITH_TOOL_TITLEBARS` and `BLACKSMITH_TOOL_THEMES` come from the same path and are the same objects as `api.windowStyles` / `api.toolTitlebars` / `api.toolThemes`. `scripts/` paths are still not the contract; the bridge is. `module.api` stays correct for anything resolved after `init`.
- [x] ~~Artificer Item window~~ — **DONE 13.2.0.** Extends `BlacksmithWindowBaseV2` via the bridge, uses the zone contract, and its fields carry `blacksmith-input` / `blacksmith-select` / `blacksmith-textarea`. It is the reference for the rest.
- [ ] Audit and migrate the remaining windows: Crafting, Recipe Browser, Skills, Gather, Recipe Import, and the experimental Crafting panel; document which base and zone layout each one uses.
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
`api.importer` went public on 2026-08-22: `registerKind`, `getKind`, `openWindow`, `parsePayload`, `attachButton`. We supply `onValidateEntry` and `onImportEntry`, so we keep document construction and Blacksmith never learns our data model. See [API: Importer](https://github.com/Drowbe/coffee-pub-blacksmith/wiki) on the wiki.

**Superseded in part by the declaration model.** Blacksmith replaced the `onValidateEntry` / `onImportEntry`
callback contract with declared profiles (2026-08-25). Recipes are now a mapped foreign subtype rather than a
callback consumer — see [plans/plan-recipe-data-model.md](plans/plan-recipe-data-model.md) step 6, which is
blocked on their step 8 (Journal). Do not build against the callback contract.

- [ ] Declare `coffee-pub-artificer.recipe` as a mapped profile once Blacksmith's Journal kind lands. Field mappings are already written: [plans/plan-recipe-field-mappings.md](plans/plan-recipe-field-mappings.md).
- [ ] Retire [scripts/window-artificer-recipe-import.js](../scripts/window-artificer-recipe-import.js) and its menubar wiring in favour of `openWindow` / `attachButton`. Sequence this **after** the window migration above so we are not porting a window we are about to delete.

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
Plan: [plans/plan-scene-opt-in.md](plans/plan-scene-opt-in.md). Installing the module is the opt-in; a
per-scene `enabled` flag asks the same question again. `enabled` gates a directory badge and pin
rendering, never an action -- nothing in Artificer fires unprompted. Can proceed while Blacksmith builds
scene geography.

- [ ] One resolver owns the effective gather settings for a scene, read by both the form and the gather
      path. Move the existing fallbacks in `_getSceneGatherSettings` (`manager-gather.js:603-631`) and
      `resolveGatherDefaults` into it rather than rewriting them -- they are correct, just scattered.
      **Not blocked on Blacksmith; none of these fields are moving.** Verified by: a scene with an
      environment and nothing else configured yields components of every family.
- [ ] Close the componentTypes gap. The form shows all families when the flag is empty
      (`manager-scene.js:193-195`); the gather path reads the same flag with no fallback
      (`manager-gather.js:611`) and yields nothing. The form says all, the engine says none, and nothing
      reports the disagreement. Verified by: the families a scene yields match what its form shows selected.
- [ ] Decide whether `profile` becomes a real named-preset system or is deleted. It is written by a
      free-text box at `manager-scene.js:277` and read by nothing. Leaving a control that implies a feature
      is the one option that is not honest.
- [ ] Confirm whether `flags.defaultDC` (read at `manager-gather.js:622`, written by no form field) has
      live data behind it before the resolver decides whether to keep accepting it.
- [ ] Delete `enabled` -- the checkbox and the reads at `manager-scene.js:188`, `:482`,
      `manager-pins.js:158`. **Sequence AFTER the habitat migration**, so a post-migration gather failure
      has one cause rather than two. Verified by: a scene that previously had `enabled: false` shows its
      existing discovery pins, and the CHANGELOG says so as a change rather than letting it arrive silently.
- [ ] Repoint the scene-directory badge from "may this scene gather" to "has a GM tuned this scene".

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
- [ ] **Pin Blacksmith minimum 13.22.0 and delete the `FALLBACK_HABITATS` copy in
      `schema-ingredients.js`.** That release carries the geography API, the vocabulary and the Scene
      Config injector. **13.22.0 is an intent, not a tag** -- their `module.json` still reads 13.21.1 and
      the bump happens at their BUILD. A module pinning a minimum that does not exist will not activate,
      so make the change on a branch and release only after they tag.
- [ ] **Raise the floor again for the hard cut, to whichever release ships the habitat migration.** The
      floor protects two different things and 13.22.0 only covers one: the vocabulary. Workstream 3 --
      habitats leaving our flag -- is not in it. A floor can be raised, so there is nothing to choose
      between: adopt the vocabulary at 13.22.0, raise it when we cut.
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
