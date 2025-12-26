# TODO - Active Issues and Future Tasks

## ACTIVE ISSUES

### CRITICAL PRIORITY

**Decision Blockers - Must Resolve Before Phase 1:**
- [x] **Q1: Ingredient Storage** - ✅ DECIDED: Compendium Packs (journal type entries)
- [x] **Q2: Blueprint Storage** - ✅ DECIDED: Separate journal ("Artificer Blueprints")
- [x] **Q3: Canvas/Pin Approach for MVP** - ✅ DECIDED: Abstract menu-based for MVP
- [x] **Q4: Blueprint State Representation** - ✅ DECIDED: HTML markup (`<s>`, `<code>`, `<em>`)
- [x] **Q5: Workstation Storage** - ✅ DECIDED: Hybrid (compendium + scene flags)
- [x] **Q6: Gathering Node Storage** - ✅ DECIDED: Compendium definitions + scene flags
- [x] **Q11: Item System Integration** - ✅ DECIDED: D&D 5e

### HIGH PRIORITY

**Phase 0: Foundation & Architecture Setup**
- [ ] Set up folder structure (`scripts/data/`, `scripts/systems/`, `scripts/ui/`, `scripts/utils/`)
- [ ] Define JSON schema definitions with JSDoc for all data types
- [ ] Create validation functions for each data type
- [ ] Set up module API for external access
- [ ] Define module settings in `settings.js` (feature toggles, discovery thresholds, skill rates)
- [ ] Add localization keys for settings in `lang/en.json`

**Phase 1: Core Data System**
- [ ] Create class-based data models:
  - [ ] `ArtificerIngredient` (Raw materials with tags, family, tier, rarity)
  - [ ] `ArtificerComponent` (Refined materials)
  - [ ] `ArtificerEssence` (Magical affinities)
  - [ ] `ArtificerRecipe` (Recipe definitions)
  - [ ] `ArtificerBlueprint` (Multi-stage blueprint definitions)
  - [ ] `ArtificerWorkstation` (Workstation definitions)
- [ ] Implement `TagManager` class (validation, categories, families)
- [ ] Implement data storage manager (based on decisions from critical questions)
- [ ] Create initial data set:
  - [ ] Starter ingredients (5-10 examples per family)
  - [ ] Starter components (2-3 per type)
  - [ ] Starter essences (5-7 examples)
  - [ ] Example recipes (2-3)
  - [ ] Example blueprint (1)

**Phase 2: Tag Logic & Experimentation Engine**
- [ ] Implement tag combination algorithm
- [ ] Create `ExperimentationEngine` class
- [ ] Implement tag discovery system (track usage per actor, progressive reveal)
- [ ] Implement item generation from tag combinations
- [ ] Add quality/stability calculation (based on skill, workstation, tier, rarity)

**Phase 3: Basic Crafting UI**
- [ ] Create crafting window (ApplicationV2)
- [ ] Implement ingredient browser (filter, search, tag display)
- [ ] Implement recipe browser (filter by skill, workstation, category, tags)
- [ ] Create result display area
- [ ] Integrate with actor inventory

### MEDIUM PRIORITY

**Important Decisions - Should Resolve Before Phase 2-3:**
- [ ] **Q7: Recipe Numbering** - Decide: Hash-based numbers (R1, R2, etc.)?
- [ ] **Q8: Recipe Result Linking** - Decide: Link to existing items or auto-create?
- [ ] **Q9: Blueprint Stage Progression** - Decide: Player initiates each stage or auto-unlock?
- [ ] **Q10: Panel Organization** - Decide: Status-based, category-based, or both?

**Phase 4: Skill System**
- [ ] Create skill data model (store in actor flags)
- [ ] Implement skill progression logic (XP gain from crafting, quality, discoveries)
- [ ] Implement skill gating (recipe/blueprint requirements)
- [ ] Create skill UI (display in actor sheet, crafting window)
- [ ] Add level-up notifications

**Phase 5: Recipe System**
- [ ] Create `RecipeParser` class (parse HTML journal entries)
- [ ] Create `RecipeForm` (FormApplication for editing)
- [ ] Create `RecipePanel` (ApplicationV2 for browsing)
- [ ] Implement recipe unlock system
- [ ] Implement recipe crafting (override tag logic, apply benefits)
- [ ] Create recipe discovery system (from books, NPCs, scrolls, etc.)

**Phase 7: Salvage & Breakdown System**
- [ ] Implement salvage rules engine
- [ ] Create salvage UI (button on item context menu)
- [ ] Implement salvage yield calculation
- [ ] Add integration with Foundry items (hook into item sheets)

### LOW PRIORITY

**Phase 6: Workstation System**
- [ ] Create workstation data definitions
- [ ] Implement workstation placement (scene-based or abstract)
- [ ] Integrate workstation modifiers with crafting
- [ ] Create workstation UI (browser, manager, placement tool)

**Phase 8: Gathering System (Basic)**
- [ ] Create gathering node definitions
- [ ] Implement basic gathering interaction
- [ ] Implement biome/seasonal logic
- [ ] Create gathering UI (node indicators, interaction prompt)

**Phase 9: Blueprint System**
- [ ] Create `BlueprintParser` class (parse multi-stage blueprints)
- [ ] Create `BlueprintForm` (FormApplication for editing)
- [ ] Create `BlueprintPanel` (ApplicationV2 for browsing)
- [ ] Implement multi-stage crafting flow
- [ ] Implement blueprint progress tracking

**Integration Features:**
- [ ] Recipe/Blueprint export/import system
- [ ] Community content format and sharing
- [ ] Notification integration (tag discoveries, skill increases, crafting events)

## DEFERRED

**Phase 10: Gathering Mini-Games**
- [ ] Create mini-game framework
- [ ] Implement timing bar mini-game
- [ ] Implement radial spinner mini-game
- [ ] Implement quick-match mini-game
- [ ] Integrate mini-games with gathering

**Phase 11: Advanced Gathering Features**
- [ ] Visual indicators (sparkle/wiggle animations)
- [ ] Hot/cold proximity indicators
- [ ] Advanced biome logic (weather, time-of-day)

**Phase 12: Canvas Integration & Advanced UI**
- [ ] Canvas workstation pins (PIXI-based)
- [ ] Canvas gathering node pins
- [ ] Drag-and-drop ingredient slots
- [ ] Advanced crafting UI features

**Phase 13: Community Features & Expansion Support**
- [ ] Import/export system for expansion packs
- [ ] Content validation tools
- [ ] Community content browser/manager

**Phase 14: Polish & Optimization**
- [ ] Performance optimization
- [ ] UX polish (tooltips, shortcuts, bulk operations)
- [ ] Complete error handling
- [ ] Full localization support

## FUTURE PHASES

**Nice-to-Have Features:**
- Blueprint canvas pins (stage-level pins like Quest objectives)
- Recipe/Blueprint numbering system (R1, B1, etc.)
- Advanced progress display locations
- Pin interaction refinements
- Advanced filtering options
- Recipe mastery tracking
- Crafting history log

---

## Notes

- Questions marked with **Q##** reference questions in `documentation/overview-artificer.md` section 12
- Phases reference `documentation/DEVELOPMENT_PLAN.md` for detailed task breakdowns
- Critical priority items are blockers - cannot proceed without decisions
- High priority items form the MVP (core crafting functionality)
- Medium priority items enhance the core system
- Low priority items are enhancements that can be added incrementally
