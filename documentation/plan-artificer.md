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

**Phase 1:** In progress (major pieces done)
- ✅ Data models (Ingredient, Component, Essence, Recipe, Blueprint)
- ✅ Storage managers (ingredients, recipes, blueprints)
- ✅ TagManager
- ✅ Item creation utilities, unified form, JSON import
- ✅ Crafting window (ApplicationV2), experimentation engine, Refresh Cache
- ✅ Item cache (in-memory); IngredientStorage uses cache
- ⏳ Persisted item cache (next step per TODO.md)
- ⏳ Initial data set
- ⏳ ArtificerWorkstation model

**Phase 2:** Blocked on Phase 1 (tag logic, ExperimentationEngine)

**Phase 3:** Crafting window exists; recipe/blueprint browser integration ongoing

---

## 2.5 Top Priority: Organizing Principles & Item Form

**Blocking:** This work must be completed before any other implementation. It defines how items are classified, edited, and used across the module.

### 2.5.1 Three-Category System

Items are organized into three main categories:

| Category   | Description                               | Sub-types                                                                 |
|-----------|-------------------------------------------|----------------------------------------------------------------------------|
| Components | Gathered, harvested, or created inputs    | Creature Parts, Environmental, Essences, Gems, Minerals, Plants            |
| Creations  | Results of recipes/blueprints             | Food, Materials, Poisons, Potions                                          |
| Tools      | Used for crafting                         | Apparatus (beaker, mortar), Containers (vial, herb bag)                    |

**Terminology:** Use **Creature Parts** (not "Creatures") for components harvested from creatures.

### 2.5.2 Skill Level (Required) vs Tier (Redundant)

- **skillLevel (required):** Minimum crafting skill level required to create, use, or work with the item. This is a functional requirement, not quality.
- **Tier:** If tier represents only rarity/difficulty, it is redundant—we already have rarity. We may not need tier; we **100% need skillLevel**. Tier can be dropped or repurposed in favor of skillLevel.

### 2.5.3 Hierarchy: Category → Type → Family

- **Category:** Components | Creations | Tools
- **Type:** Sub-type within the category (e.g., Creature Parts, Potions, Apparatus)
- **Family:** Tag-family grouping (e.g., INGREDIENT_FAMILIES: Herbs, Minerals, Gems, CreatureParts, Environmental)

### 2.5.4 Item Editing Strategy: Artificer Bar + Partial Editor

**Goal:** Add Artificer data and tags to items without reinventing the full item editor.

- **Artificer bar on all items:** Every item sheet can show an "Artificer" section (tab, bar, or block). If the item is not yet an Artificer item, the section offers a **Convert to Artificer item** action.
- **Convert to Artificer item:** Designating an item as an Artificer item attaches our flags and exposes the Artificer properties UI. The core item (name, description, weight, cost, rarity, etc.) remains edited via the standard D&D 5e item sheet.
- **We only edit our stuff:** The module provides editors only for Artificer-specific fields (tags, family, skillLevel, type/category, biomes, etc.). We do not duplicate or replace support for every item field—the item sheet does the heavy lifting.
- **Benefits:** Single source of truth for item basics, no incomplete or inconsistent support for system fields, simpler maintenance, and a clear "ARTIFICER PROPERTIES" block (as in the current Bloodroot-style sheet) so users know where our data lives.

### 2.5.5 Item Form Updates (Artificer-Only Fields)

1. **Artificer type options:** Add Apparatus, Container, Tool (alongside Ingredient, Component, Essence).
2. **Consumable subtype:** Expose D&D 5e Consumable subtype when the item type is Consumable (read-only or link to system field).
3. **Tags:** Replace free-text tag input with TagManager-driven dropdowns.
4. **Family:** Use "Creature Parts" in schema and UI; align family values with the three-category system.

### 2.5.6 Implementation Checklist

- [ ] **Item editing strategy:** Artificer bar/section on all item sheets; "Convert to Artificer item" for non-Artificer items; edit only Artificer-specific fields (see §2.5.4).
- [ ] Add `skillLevel` to item flags/schema (crafting requirement).
- [ ] Decide fate of tier: drop or repurpose; do not conflate with rarity.
- [ ] Rename "Creatures" → "Creature Parts" in schema (e.g. `schema-ingredients.js` INGREDIENT_FAMILIES).
- [ ] Item form: add Apparatus, Container, Tool type options.
- [ ] Item form: expose Consumable subtype when applicable.
- [x] Item form: tag dropdowns via TagManager.
- [ ] Align category → type → family hierarchy across schemas and UI.
- [ ] Update documentation (architecture, schemas) to reflect the three-category system.

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

### Phase 1: Core Data System (In Progress)
- Data models: ArtificerIngredient, ArtificerComponent, ArtificerEssence, ArtificerRecipe, ArtificerBlueprint, ArtificerWorkstation
- TagManager (validation, families, combination rules)
- Item creation & import (utility-artificer-item.js, window-artificer-item.js, utility-artificer-import.js)
- Storage: IngredientStorage, RecipeStorage, BlueprintStorage
- Parsers: RecipeParser, BlueprintParser
- Item cache (in-memory; persisted cache in progress)
- Initial data set (starter ingredients, components, essences, example recipes/blueprint)

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
- Crafting window (✅ exists; recipe/blueprint browser integration)
- Ingredient browser (filter, search, tag display)
- Recipe browser (filter by skill, workstation, category)
- Result display
- Integration with actor inventory

**Deliverable:** Full crafting UI with experimentation and recipe crafting.

---

### Phase 4: Skill System & Progression
- Skill data model (actor flags)
- Skill categories: Herbalism, Metallurgy, Artifice, Alchemy, Monster Handling
- XP gain, level-up, skill gating
- Skill UI in crafting window / actor sheet

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
- Gathering node definitions
- Basic gathering interaction (click, success check)
- Biome/seasonal logic
- Gathering UI

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

**First:** Complete **§2.5 Organizing Principles & Item Form** (blocking). See the checklist in §2.5.6.

**Then** (see `documentation/TODO.md`):

1. **Persisted Item Cache** — Replace in-memory with persisted lightweight cache; integrate `translation-item.json`; D&D consumable → family mapping.
2. **Initial Data Set** — Starter ingredients, components, essences, example recipes/blueprint.
3. **Recipe/Blueprint Browser** — Integrate parsers with crafting window.
4. **§7.0 Experimentation Model** — Quantities, solvent, process (temp/time) — enhancement to tag-based matching.

---

## 6. Technical Considerations

### Data Storage (per architecture §11.2)
- **Compendium Packs:** Ingredients, components, essences
- **Journals:** Recipes, blueprints (HTML, parser-based)
- **Actor flags:** Skills, tag discoveries, blueprint progress, unlocked recipes
- **Scene/World flags:** Workstations, gathering nodes, biome data

### Tag Combination Algorithm
1. Collect tags from input ingredients
2. Categorize (primary, secondary, element, structural)
3. Apply priority-based matching rules
4. Generate item type from dominant tags
5. Apply modifiers from secondary tags
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
