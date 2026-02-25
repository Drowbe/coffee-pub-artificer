# Coffee Pub Artificer - Implementation Plan

> **Canonical source:** `documentation/architecture-artificer.md` is the source of truth for architecture and decisions. For current task focus, see `documentation/TODO.md`.

This document merges phased task breakdown, current status, MVP path, and technical notes into a single implementation plan.

> **⚠️ Top priority:** Section 2.5 (Organizing Principles & Item Form) must be completed before any other implementation work. It unblocks item editing, recipe crafting, and data consistency.

---

## 1. Decisions (All Resolved)

### Critical
| Q | Decision |
|---|----------|
| Q1: Ingredient Storage | Compendium Packs (Items) |
| Q2: Blueprint Storage | Separate journal ("Artificer Blueprints") |
| Q3: Canvas/Pin Approach | Abstract menu-based for MVP |
| Q4: Blueprint State | HTML markup (`<s>`, `<code>`, `<em>`) |
| Q5: Workstation Storage | Hybrid (compendium + scene flags) |
| Q6: Gathering Node Storage | Compendium + scene flags |
| Q11: Item System | D&D 5e (5.5+) |

### Important
| Q | Decision |
|---|----------|
| Q7: Recipe Numbering | Hash-based (R1, R2, etc.) |
| Q8: Recipe Result Items | Link to existing items in compendium |
| Q9: Blueprint Progression | Player manually initiates each stage |
| Q10: Panel Organization | Both (default status, category filter) |

### Deferred (Decide During Implementation)
- **Q12:** Pin interactions → Phase 8
- **Q13:** Export/import format → Phase 13
- **Q14:** Notification events → Phase 3 (configurable)
- **Q15:** Progress display location → Phase 3

---

## 2. Current Status

**Phase 0:** ✅ Complete (module structure, schemas, API, settings)

**Phase 1:** Largely complete (see CHANGELOG.md through 13.0.6)
- ✅ Data models (Ingredient, Component, Essence, Recipe, Blueprint)
- ✅ Storage managers (ingredients, recipes, blueprints)
- ✅ TagManager
- ✅ Item creation utilities, unified form, recipe import
- ✅ Crafting window (ApplicationV2), experimentation engine, Refresh Cache
- ✅ Item cache (persisted; world setting `itemCache`); IngredientStorage uses cache
- ✅ TYPE → FAMILY → TRAITS migration + macro (`macros/migration-macro-example.js`)
- ✅ GM-only menubar (Create Item, Import Recipes, Roll for Components); crafting/timer sounds
- ⏳ Initial data set (starter content)
- ⏳ ArtificerWorkstation model

**Phase 2:** Blocked on Phase 1 (tag logic, ExperimentationEngine)

**Phase 3:** ✅ Crafting window, recipe/ingredient browser, result display, actor integration

**Phase 4 (Skills):** Skills Window UI in place
- ✅ Skills Window (ApplicationV2) from Artificer bar; data from `resources/skills-details.json`
- ✅ Panels: label (left) + total-cost dots (right), badge + slots; click badge → skill details, slot → slot details
- ✅ Slots show cost; applied state (value > 0) styled; panels scroll; 700px panels column, details flex
- ⏳ Persist to actor flags (Apply), skill progression logic (next)

**Phase 8 (Gathering):** ✅ Roll for Components (Gather)
- ✅ Gather window: GM selects habitats (biomes), component types, DC; request roll for selected tokens
- ✅ Habitat multi-select, eligibility by biome; chat cards (success/failure/no pool); remember settings
- ✅ Blacksmith Request a Roll integration (Wisdom, silent mode, onRollComplete)

---

## 2.5 Top Priority: Organizing Principles & Item Form

**Blocking:** This work must be completed before any other implementation. It defines how items are classified, edited, and used across the module.

### 2.5.1 Data Hierarchy: TYPE > FAMILY > TRAITS

Single, non-redundant hierarchy. **Family** is the identity; **traits** are modifiers. There is no separate "primary tag"—family fills that role.

| TYPE       | Description | FAMILIES (examples) |
|-----------|-------------|----------------------|
| **Component** | Gathered, harvested, or refined inputs | Creature Part, Environmental, Essence, Gem, Mineral, Plant |
| **Creation**  | Results of recipes/blueprints | Food, Material, Poison, Potion |
| **Tool**      | Used for crafting | Apparatus, Container |

**TRAITS:** Modifiers (e.g. Floral, Medicinal, Arcane) that do not repeat type or family. Stored as a single array; old "quirk" is folded into traits.

**Example:** `[COMPONENT] > [PLANT] > [FLORAL, MEDICINAL, ARCANE]`

**Terminology:** Use **Creature Part** / **Creature Parts** for components harvested from creatures.

### 2.5.2 Skill Level (Required) vs Tier (Redundant)

- **skillLevel (required):** Minimum crafting skill level required to create, use, or work with the item.
- **Tier:** Redundant with rarity; can be dropped or repurposed.

### 2.5.3 Item Editing Strategy: Artificer Bar + Partial Editor

- **Artificer bar on all items:** Every item sheet shows an "Artificer" section; non-Artificer items offer **Convert to Artificer item**.
- **We only edit our stuff:** Edit only Artificer fields (type, family, traits, skillLevel, biomes, etc.); D&D 5e item sheet handles the rest.

### 2.5.4 Item Form Updates (Artificer-Only Fields)

1. **TYPE:** Component | Creation | Tool (replaces old ingredient/component/essence/apparatus/container/tool).
2. **FAMILY:** Single select; options depend on TYPE (see §2.5.1).
3. **TRAITS:** Tagging UI (input + pills); options from trait lists; no primary/secondary/quirk—just traits.
4. **Consumable subtype:** Expose D&D 5e Consumable subtype when item type is Consumable.

### 2.5.5 Implementation Checklist

- [ ] **Item editing strategy:** Artificer bar/section; Convert to Artificer; edit only Artificer fields (see §2.5.3).
- [ ] Add `skillLevel` to item flags/schema.
- [ ] Decide fate of tier.
- [ ] Implement TYPE > FAMILY > TRAITS in schemas and UI (type, family, traits; remove primaryTag, secondaryTags, quirk).
- [ ] Item form: TYPE (Component/Creation/Tool), FAMILY (by type), TRAITS (tagging UI).
- [ ] Item form: expose Consumable subtype when applicable.
- [x] Item form: tagging UI for traits (replaces primary/secondary dropdowns).
- [ ] **Migration macro:** One-time migration of existing items (see §2.6).
- [ ] Update documentation to reflect TYPE > FAMILY > TRAITS.

---

## 2.6 Migration: Legacy Data → TYPE > FAMILY > TRAITS

**Purpose:** Convert hundreds of existing items from the old flag shape to the new hierarchy without data loss.

### 2.6.1 What the Macro Does

1. **Scope:** All Items in the world and/or in configured Artificer compendia that have `flags[MODULE.ID]` (or `flags.artificer`) with legacy fields.
2. **Detect legacy:** Presence of `primaryTag` or `secondaryTags` or `quirk` (or old `type` values: ingredient, component, essence, apparatus, container, tool).
3. **Compute new values:**
   - **TYPE:** ingredient | component | essence → Component; apparatus | container | tool → Tool; (Creation if we have a creation type).
   - **FAMILY:** Map existing `family` to new family list (e.g. Herbs → Plant, Minerals → Mineral, CreatureParts → Creature Part, Environmental → Environmental, Gems → Gem). For components with affinity, map to Essence. Default if missing.
   - **TRAITS:** Merge into one array: [primaryTag (if not same as family), ...secondaryTags, quirk]. Dedupe; remove any entry that equals the chosen family name; trim.
4. **Write:** Set `type`, `family`, `traits`; remove `primaryTag`, `secondaryTags`, `quirk`.
5. **Idempotency:** Skip items that already have `traits` and no `primaryTag`/`secondaryTags` (already migrated).
6. **Reporting:** Log or return count of migrated items and any errors/skips.

### 2.6.2 Migration Macro Tasks (Implementation)

- [x] Migration logic: `scripts/migrations/migrate-artificer-flags.js`; API: `game.modules.get('coffee-pub-artificer').api.runMigration(options)`.
- [x] Iterate world items; optional `options.includeCompendia: ['packId', ...]` for compendium packs.
- [x] Mapping: `LEGACY_TYPE_TO_ARTIFICER_TYPE`, `LEGACY_FAMILY_TO_FAMILY`; traits from primaryTag + secondaryTags + quirk (merge + dedupe).
- [x] Idempotency: skip items that already have `traits` and no legacy tag fields.
- [x] **Macro for GMs:** Example script at `macros/migration-macro-example.js`. Create a Script macro in Foundry, paste the script, run as GM. Backup world or run on a copy first.
- [ ] Test on a copy of the world with a subset of items first (manual).
- [x] Document: macro header + plan §2.6 + TODO.md.

---

## 3. Phase Breakdown (0–14)

### Phase 0: Foundation & Architecture Setup ✅
- Data storage approach decided (hybrid)
- Schema definitions (JSDoc)
- Module structure (cache, data/, parsers/, managers)
- Settings framework
- API structure

**Deliverable:** Module loads, structures defined, settings registered.

---

### Phase 1: Core Data System (Largely Complete)
- Data models: ArtificerIngredient, ArtificerComponent, ArtificerEssence, ArtificerRecipe, ArtificerBlueprint, ArtificerWorkstation (placeholder)
- TagManager (validation, families, combination rules)
- Item creation & import (utility-artificer-item.js, window-artificer-item.js, window-artificer-recipe-import.js)
- Storage: IngredientStorage, RecipeStorage, BlueprintStorage
- Parsers: RecipeParser, BlueprintParser
- Item cache (persisted ✅; world setting `itemCache`, translation index, consumable→family)
- Initial data set (starter ingredients, components, essences, example recipes/blueprint) — in progress

**Deliverable:** Item creation working, data models working, ingredients load from cache/compendiums.

---

### Phase 2: Tag Logic & Experimentation Engine
- Tag combination algorithm
- Tag discovery (per-actor, progressive reveal: 1/3/5 uses)
- ExperimentationEngine class
- Item generation from tags
- Quality/stability calculation (skill, workstation, tier, rarity)
- Fallback to sludge (never fail completely)

**Deliverable:** Players can combine ingredients, tag logic determines outcomes, tag discovery works.

---

### Phase 3: Basic UI - Crafting Interface
- Crafting window (✅ exists; recipe/ingredient browser, result display, actor integration)
- Ingredient browser (filter, search, tag display)
- Recipe browser (filter by skill, workstation, category)
- Result display
- Integration with actor inventory
- Sounds (component panel, timer heat/grind); GM-only menubar (13.0.5)

**Deliverable:** Full crafting UI with experimentation and recipe crafting.

---

### Phase 4: Skill System & Progression
- Skill data model (actor flags)
- Skill categories: Herbalism, Metallurgy, Artifice, Alchemy, Monster Handling
- XP gain, level-up, skill gating
- **Skill UI:** ✅ Skills Window (ApplicationV2) — JSON-driven panels, badge + slots, details pane; ⏳ actor persistence, progression

---

### Phase 5: Recipe System
- Recipe crafting (override tag logic)
- Recipe benefits (reduced cost, quality bonus)
- Recipe unlock system (books, scrolls, discoveries)
- Recipe browser integration

---

### Phase 6: Workstation System
- Workstation definitions (compendium)
- Workstation placement (scene flags for MVP)
- Workstation modifiers (quality, stability, essence synergy)
- Workstation UI

---

### Phase 7: Salvage & Breakdown System
- Salvage rules engine
- Salvage yields per item type
- Salvage UI (context menu, confirmation)
- Integration with Foundry item sheets

---

### Phase 8: Gathering System (Basic)
- Gathering node definitions (biomes, component types; compendium eligibility)
- Basic gathering interaction (✅ Roll for Components — GM selects biomes/types/DC, request roll for tokens)
- Biome/seasonal logic (habitat multi-select)
- Gathering UI (✅ Roll for Components window, chat cards, remember settings)

---

### Phase 9: Blueprint System
- Blueprint progression (multi-stage)
- Blueprint crafting flow
- Blueprint browser
- Stage-by-stage interface

---

### Phase 10: Gathering Mini-Games
- Timing bar, radial spinner, quick-match
- Difficulty scaling
- Skip option

---

### Phase 11: Advanced Gathering Features
- Visual indicators (sparkle, proximity)
- Advanced biome logic

---

### Phase 12: Canvas Integration & Advanced UI
- Canvas pins for workstations/gathering nodes
- Drag-and-drop ingredient slots
- Actor sheet / item sheet integration

---

### Phase 13: Community Features & Expansion Support
- Import/export system
- Expansion guidelines
- Content validation

---

### Phase 14: Polish & Optimization
- Performance optimization
- UX polish (tooltips, bulk operations)
- Error handling
- Localization

---

## 4. MVP Path (Prioritized)

1. **Phase 0–1:** Foundation (essential)
2. **Phase 2:** Tag Logic (core mechanic)
3. **Phase 3:** Basic UI (must have)
4. **Phase 5:** Recipe System (structure)
5. **Phase 4:** Skill System (simplified)
6. **Phase 7:** Salvage (resource loop)

**Then:** Phase 6 Workstations, Phase 8 Gathering, Phase 9 Blueprints, Phase 10–14 polish.

---

## 5. Immediate Next Steps

**First:** Complete **§2.5 Organizing Principles & Item Form** (blocking). See the checklist in §2.5.5.

**Then:**

1. **§2.6 Migration Macro** — Implement and run one-time migration of existing items from legacy flags (primaryTag, secondaryTags, quirk) to TYPE > FAMILY > TRAITS. Run on a backup/copy first.
2. **Persisted Item Cache** — Replace in-memory with persisted lightweight cache; integrate `translation-item.json`; align cache schema with type/family/traits.
3. **Initial Data Set** — Starter components, creations, tools using new hierarchy.
4. **Recipe/Blueprint Browser** — Integrate parsers with crafting window.
5. **§7.0 Experimentation Model** — Quantities, solvent, process (temp/time) — enhancement to family+trait matching.

---

## 6. Technical Considerations

### Data Storage (per architecture §11.2)
- **Compendium Packs:** Ingredients, components, essences
- **Journals:** Recipes, blueprints (HTML, parser-based)
- **Actor flags:** Skills, tag discoveries, blueprint progress, unlocked recipes
- **Scene/World flags:** Workstations, gathering nodes, biome data

### Trait Combination Algorithm (crafting)
1. Collect family + traits from input components
2. Categorize (family drives broad category; traits drive element, behavior, structural)
3. Apply priority-based matching rules
4. Generate result type from family + dominant traits
5. Apply modifiers from remaining traits
6. Fallback to sludge if no match

### Integration Points
- Actor flags, Item flags (artificer), Scene flags
- ApplicationV2 for all UI
- Blacksmith API for notifications
- Dependencies: Coffee Pub Blacksmith (required)

---

## 7. Estimated Timeline

- **Phase 0–2:** 20–30 hours (Foundation + Core Logic)
- **Phase 3–4:** 15–20 hours (Basic UI + Skills)
- **Phase 5–7:** 20–25 hours (Recipes + Workstations + Salvage)
- **Phase 8–9:** 15–20 hours (Gathering + Blueprints)
- **Phase 10–14:** 30–40 hours (Polish + Advanced)

**Total:** ~100–135 hours | **MVP:** ~50–70 hours

---

## 8. Implementation Tips

- **Start small:** One data model end-to-end; expand once core flow works.
- **Test frequently:** Parsing, item creation, tag logic.
- **Follow patterns:** Codex/Quest parsers; ApplicationV2; flags.
- **Document as you go:** CHANGELOG, JSDoc, keep architecture §13 updated.
