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

- [ ] Declare `coffee-pub-artificer.recipe` as a mapped profile once Blacksmith's Journal kind lands. Field mappings are already written: [plans/declaration-recipe-field-mappings.md](plans/declaration-recipe-field-mappings.md).
- [ ] Retire [scripts/window-artificer-recipe-import.js](../scripts/window-artificer-recipe-import.js) and its menubar wiring in favour of `openWindow` / `attachButton`. Sequence this **after** the window migration above so we are not porting a window we are about to delete.

### Recipes and Processes
Recipes are a real data model and processes are items as of 13.2.0 — see
[plans/plan-recipe-data-model.md](plans/plan-recipe-data-model.md) for what shipped and what is left.

- [ ] Add the Process family to the Artificer item field-group declaration
      ([plans/declaration-artificer-field-group.md](plans/declaration-artificer-field-group.md)): the Tool
      family vocabulary grows to three, and the Process-only fields are the conditional-*fields* case
      Blacksmith has not designed for yet. Needed before AI authoring works for processes.
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

- Questions marked with **Q##** in older docs were already resolved; keep decisions in `documentation/architecture-artificer.md` and shipped history in `CHANGELOG.md`.
- Discovery-based gather spots and canvas gather pins are already implemented; remaining work is reliability and lifecycle cleanup, not initial pin support.
- Skill perk persistence to actor flags is already implemented; the remaining skill work is progression, gating, and notifications.
