# TODO - Active Backlog

**Progress overview:** Current release **v13.0.12**. Completed work should live in **CHANGELOG.md**; this file is only for unfinished or newly discovered work.

## Current Focus

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
