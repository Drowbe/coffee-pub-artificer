# TODO - Active Backlog

**Progress overview:** Current release **v13.0.12**. Completed work should live in **CHANGELOG.md**; this file is only for unfinished or newly discovered work.

## Current Focus

### CRITICAL — Migrate Windows to the Blacksmith Window API
- [ ] Replace Artificer's direct `HandlebarsApplicationMixin(ApplicationV2)` window implementations with the appropriate Blacksmith public base: `api.BlacksmithWindowBaseV2` for full editors/forms and `api.BlacksmithToolWindowBaseV2` only for lightweight persistent canvas tools. Do not deep-link Blacksmith implementation files; resolve the bases through `game.modules.get('coffee-pub-blacksmith').api`. Reference: [Blacksmith Window API](https://github.com/Drowbe/coffee-pub-blacksmith/wiki/api-window).
- [ ] Audit and migrate every current window: Crafting, Recipe Browser, Skills, Gather, Artificer Item, Recipe Import, and the experimental Crafting panel; document which base and zone layout each one uses.
- [ ] Register stable window IDs through `api.registerWindow()` for windows opened by Blacksmith bars, macros, or other modules, and route those callers through `api.openWindow()`; retain direct construction only where the Window API explicitly recommends it for ephemeral/multi-instance tools.
- [ ] Refactor window templates onto Blacksmith's zone contract (option bar, header, tools, body, action bar) while preserving existing actions, forms, scrolling, sizing, remembered positions, and singleton/multi-instance behavior.
- [ ] Replace Artificer's hardcoded dark window surfaces and field colors with the applicable Blacksmith window variables. For Tool windows, use the `--blacksmith-tool-*` field/content-surface family and verify fields, placeholders, focus rings, open dropdown options, sticky content, hover/selection states, and muted text under Light, Dark, and Glass themes.
- [ ] Add migration verification for opening every window from each supported entry point, closing/reopening, minimizing, resizing, position persistence, form submission, keyboard/focus behavior, and theme switching.

### CRITICAL — Migrate item grants to the Blacksmith Inventory API
Blacksmith is shipping `api.inventory` with four primitives: `grantItem`, `grantCurrency`, `transferItem`, `transferCurrency`. Only **`grantItem`** applies to us — `addCraftedItemToActor` has no source actor, it creates an item on an actor from item data, which `transferItem` cannot express. Expected to land soon; do not start until it ships.

- [ ] **Blocked on Blacksmith:** get a decision on the **mixed `compendiumSource` case** before migrating. Their merge rule is "compare `compendiumSource` when both items have one, never require it," and an item with a source and one without deliberately do **not** merge. That case is not an edge case for us — it is the default state of a configured world (see *Content / Pack Data Integrity* below). We asked for: merge when flags match and **at most one** side has a source; treat a missing source as *unknown*, not as *different*. Without that, gathering the same component twice can randomly produce two non-merging rows.
- [ ] Rewrite `addCraftedItemToActor` ([scripts/utility-artificer-item.js](../scripts/utility-artificer-item.js) L169-186) as a thin wrapper: resolve the actor UUID, call `blacksmith.inventory.grantItem({ targetActorUuid, itemData, quantity, stack: 'merge' })`, and **keep the existing return contract** (`Item|null`) so no caller changes.
- [ ] Pass `ignoreFlags: []` (or omit it). All seven Artificer flags ([scripts/schema-artificer-item.js](../scripts/schema-artificer-item.js) L171-179) are identity-bearing crafting data and must be compared. That option exists for modules writing transient UI state to item flags; we have none.
- [ ] Verify all five call sites still behave after the swap: gathering ([scripts/manager-gather.js](../scripts/manager-gather.js) L293), crafting ([scripts/window-crafting.js](../scripts/window-crafting.js) L237), experimentation ([scripts/systems/experimentation-engine.js](../scripts/systems/experimentation-engine.js) L104), and the two sludge grants ([scripts/window-crafting.js](../scripts/window-crafting.js) L2519, L2652). Note the crafting critical-success path calls the helper in a loop for `outputMultiplier` — confirm that still yields the right quantity.
- [ ] Tell Blacksmith if we ever start importing through `fromCompendium` in code, so they can confirm the mixed case still behaves.
- [ ] Adopt `grantCurrency` if Artificer ever pays out coin. It takes deltas, never absolute totals, and locks the actor — avoids the read-modify-write race.

**Two live bugs this migration fixes as a side effect** (measured 2026-08-07; both currently latent, do not patch locally unless they start losing data in play):
- [ ] **Flag-blind stacking.** `addCraftedItemToActor` matches on `name` + `type` only, so an item whose Artificer flags differ from one the actor holds is merged into it and the incoming variant's flags are discarded silently. Verified latent: quirk is set on 1 of 95 shipped components, affinity is empty everywhere, base and `-enhanced` packs are flag-identical, and no runtime path generates quirk or affinity — every grant copies a source item verbatim. Safe to let the migration fix this.
- [ ] **`uses.spent` loss.** The merge ignores `system.uses.spent`, so a partially-consumed item stacks into a full one and the spent charges vanish. **This is the one most likely to produce a real report** — 42 of 178 shipped creations have `uses.max > 1`. Currently latent only because no actor holds a partially-consumed Artificer item yet.

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
- [ ] Report to Blacksmith: the `rows` uuid path still interpolates the label into `@UUID[...]{...}` before enriching, and `escapeHtml` does not escape `}`. An item name containing `}` closes the link early and the remainder reaches the enricher — the same class of hole `{ literal }` just closed, on the one text path that bypasses `processText`.

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
