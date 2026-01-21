# Coffee Pub Artificer - Implementation Roadmap

## 🎯 How to Make It Happen

This document outlines the implementation path, remaining decisions, and prioritized next steps.

---

## ✅ Decisions Already Made

### Critical Decisions (All Resolved)
- ✅ **Q1: Ingredient Storage** → Compendium Packs (Items)
- ✅ **Q2: Blueprint Storage** → Separate journal ("Artificer Blueprints")
- ✅ **Q3: Canvas/Pin Approach** → Abstract menu-based for MVP
- ✅ **Q4: Blueprint State** → HTML markup (`<s>`, `<code>`, `<em>`)
- ✅ **Q5: Workstation Storage** → Hybrid (compendium + scene flags)
- ✅ **Q6: Gathering Node Storage** → Compendium + scene flags
- ✅ **Q11: Item System** → D&D 5e (v5.4+)

**Status:** All critical blockers resolved! ✅

### Important Decisions (All Resolved)
- ✅ **Q7: Recipe Numbering** → Hash-based numbers (R1, R2, etc.)
- ✅ **Q8: Recipe Result Items** → Link to existing items in compendium
- ✅ **Q9: Blueprint Progression** → Player manually initiates each stage
- ✅ **Q10: Panel Organization** → Both (default to status, with category filter)

**Status:** All important decisions resolved! ✅ Ready for Phase 2-3 implementation.

---

## ⏳ Decisions Still Needed

### Medium Priority (Can Decide During Implementation)

### Medium Priority (Can Decide During Implementation)

#### **Q12: Pin Interactions** (Phase 8+)
- Click behaviors, drag, right-click menus, tooltips
- **Decision:** Defer until Phase 8 (Canvas Integration)

#### **Q13: Export/Import Format** (Phase 13+)
- JSON export/import, journal compendiums, or both?
- **Decision:** Defer until Phase 13 (Community Features)

#### **Q14: Notification Events** (Phase 3+)
- Which crafting events trigger notifications?
- **Decision:** Can be configurable in settings, decide during Phase 3

#### **Q15: Progress Display** (Phase 3+)
- Where to show progress bars?
- **Decision:** Decide during Phase 3 UI implementation

---

## 🛣️ Implementation Path

### Current Status: Phase 0 Complete, Phase 1 In Progress

```
┌─────────────────────────────────────────────────────────────┐
│              IMPLEMENTATION ROADMAP                          │
└─────────────────────────────────────────────────────────────┘

✅ PHASE 0: Foundation (COMPLETE)
    ├── Module structure
    ├── Schema definitions
    ├── Manager placeholders
    ├── API structure
    └── Settings framework

🔄 PHASE 1: Core Data System (IN PROGRESS - ~30% complete)
    ├── ✅ Item creation utilities
    ├── ⏳ Item creation form (window-artificer-item.js)
    ├── ⏳ JSON import utilities
    ├── ⏳ Data models (classes)
    ├── ⏳ Storage managers (loading/parsing)
    ├── ⏳ TagManager
    └── ⏳ Initial data set

⏳ PHASE 2: Tag Logic & Experimentation (BLOCKED on Phase 1)
    ├── Tag combination algorithm
    ├── ExperimentationEngine
    ├── Tag discovery system
    └── Item generation

⏳ PHASE 3: Basic UI (BLOCKED on Phase 2)
    ├── Crafting window
    ├── Ingredient browser
    ├── Recipe browser
    └── Result display

⏳ PHASE 4-14: Advanced Features (BLOCKED on Phase 3)
```

---

## 📋 Immediate Next Steps (Priority Order)

### Step 1: Resolve Remaining Decisions (30 minutes)
**Action:** Make decisions on Q7-Q10

**Questions to Answer:**
1. **Q7:** Recipe numbering - Yes (hash-based) or No?
2. **Q8:** Recipe result items - Link (A), Auto-create (B), or Hybrid (C)?
3. **Q9:** Blueprint progression - Manual (A), Auto (B), or Hybrid (C)?
4. **Q10:** Panel organization - Status (A), Category (B), or Both (C)?

**Output:** Update `overview-artificer.md` with decisions

---

### Step 2: Complete Phase 1 - Data Models (4-6 hours)
**Action:** Implement class-based data models

**Tasks:**
1. Create `ArtificerIngredient` class
   - Properties: id, name, tags, family, tier, rarity, biomes, quirk
   - Methods: `validate()`, `serialize()`, `fromItem()`
   
2. Create `ArtificerComponent` class
   - Properties: id, name, tags, componentType, tier, rarity
   - Methods: `validate()`, `serialize()`, `fromItem()`
   
3. Create `ArtificerEssence` class
   - Properties: id, name, tags, affinity, tier, rarity
   - Methods: `validate()`, `serialize()`, `fromItem()`
   
4. Create `ArtificerRecipe` class
   - Properties: id, name, category, skill, skillLevel, workstation, ingredients, result, tags
   - Methods: `validate()`, `serialize()`, `canCraft(actor)`, `getMissingMaterials(actor)`
   
5. Create `ArtificerBlueprint` class
   - Properties: id, name, stages, requirements, result
   - Methods: `validate()`, `serialize()`, `getStageStatus(actor)`, `canStartStage(actor, stageIndex)`

**Files to Create:**
- `scripts/data/models/model-ingredient.js`
- `scripts/data/models/model-component.js`
- `scripts/data/models/model-essence.js`
- `scripts/data/models/model-recipe.js`
- `scripts/data/models/model-blueprint.js`

---

### Step 3: Complete Phase 1 - Storage Managers (4-6 hours)
**Action:** Implement storage loading and parsing

**Tasks:**
1. Implement `IngredientStorage` manager
   - Load from compendium packs (Items with `flags.artificer.type === "ingredient"`)
   - Load from journals (if custom ingredients stored there)
   - Aggregate and cache
   - Methods: `getAll()`, `getById(id)`, `getByTag(tag)`, `refresh()`
   
2. Implement `RecipeStorage` manager
   - Load from journal entries (parse HTML)
   - Cache parsed recipes
   - Methods: `getAll()`, `getById(id)`, `getByCategory(category)`, `refresh()`
   
3. Implement `BlueprintStorage` manager
   - Load from journal entries (parse HTML with stage markup)
   - Parse stage states (`<s>`, `<code>`, `<em>`)
   - Methods: `getAll()`, `getById(id)`, `getByStatus(actor, status)`, `refresh()`
   
4. Implement `RecipeParser` class
   - Parse HTML journal pages
   - Extract structured data from `<p><strong>Label</strong>: value</p>` format
   - Handle ingredient lists
   - Handle result item UUIDs
   
5. Implement `BlueprintParser` class
   - Parse HTML journal pages
   - Extract stages
   - Parse stage states from markup
   - Handle stage dependencies

**Files to Create/Update:**
- `scripts/data/storage/storage-ingredients.js`
- `scripts/data/storage/storage-recipes.js`
- `scripts/data/storage/storage-blueprints.js`
- `scripts/parsers/parser-recipe.js`
- `scripts/parsers/parser-blueprint.js`

---

### Step 4: Complete Phase 1 - Tag Manager (2-3 hours)
**Action:** Implement tag validation and management

**Tasks:**
1. Create `TagManager` class
   - Tag validation (2-5 tags per ingredient)
   - Tag categories (primary, secondary, quirk)
   - Tag family definitions
   - Tag combination rules (base structure)
   - Methods: `validateTags(tags)`, `getTagCategory(tag)`, `getTagFamily(tag)`

**Files to Create:**
- `scripts/systems/tag-manager.js`

---

### Step 5: Complete Phase 1 - Item Creation UI (4-6 hours)
**Action:** Build the item creation form and import system

**Tasks:**
1. Complete `window-artificer-item.js`
   - Unified form for ingredients/components/essences
   - D&D 5e item fields + artificer flags
   - Type switcher (ingredient/component/essence)
   - Validation
   - Create item in world
   
2. Create `utility-artificer-import.js`
   - JSON import (single + bulk)
   - Validate JSON structure
   - Use core creation utilities
   - Error handling
   
3. Add menubar buttons
   - "Create Item" button → Opens form
   - "Import Items" button → Opens file picker/paste dialog

**Files to Create/Update:**
- `scripts/window-artificer-item.js` (complete)
- `scripts/utility-artificer-import.js` (new)
- `scripts/artificer.js` (add menubar buttons)

---

### Step 6: Create Initial Data Set (3-4 hours)
**Action:** Create starter content using the creation utilities

**Tasks:**
1. Create starter ingredients (5-10 per family)
   - Herbs: Lavender, Sage, Nightshade, etc.
   - Minerals: Iron Ore, Copper Ore, etc.
   - Gems: Quartz, Ruby, etc.
   - Creature Parts: Bone, Venom Sac, etc.
   - Environmental: Spring Water, Volcanic Ash, etc.
   
2. Create starter components (2-3 per type)
   - Metals: Iron Ingot, Steel Plate, etc.
   - Alchemical: Herbal Extract, etc.
   - Structural: Leather Strap, etc.
   
3. Create starter essences (5-7 examples)
   - Life Essence, Fire Essence, Shadow Essence, etc.
   
4. Create example recipes (2-3)
   - Healing Potion
   - Basic Weapon
   - Simple Consumable
   
5. Create example blueprint (1)
   - Multi-stage example with narrative hook

**Files to Create:**
- `scripts/data/initial-data.js` (update with creation functions)
- Or create items directly in world/compendium

---

## 🎯 MVP Path (Fastest to Working System)

If you want to get to a working MVP faster, follow this prioritized path:

### MVP Phase 1: Foundation (Current)
1. ✅ Complete data models
2. ✅ Complete storage managers
3. ✅ Complete TagManager
4. ✅ Create initial data set

### MVP Phase 2: Core Logic (Next)
1. Implement tag combination algorithm
2. Create ExperimentationEngine
3. Implement tag discovery
4. Basic item generation

### MVP Phase 3: Basic UI (Then)
1. Crafting window (ApplicationV2)
2. Ingredient browser
3. Experimentation interface
4. Result display

### MVP Phase 4: Recipe System (Important)
1. Recipe parser
2. Recipe browser
3. Recipe crafting (override tag logic)
4. Recipe unlock system

### MVP Phase 5: Skills (Simplified)
1. Basic skill tracking
2. Skill gating
3. Skill display

### MVP Phase 6: Salvage (Resource Loop)
1. Salvage rules
2. Salvage UI
3. Component generation

**Then add:** Workstations, Gathering, Blueprints, Polish

---

## 📊 Decision Matrix

### All Critical & Important Decisions Resolved ✅

| Question | Decision | Status |
|----------|----------|--------|
| **Q7: Recipe Numbering** | Hash-based (R1, R2...) | ✅ Decided |
| **Q8: Recipe Results** | Link to existing items | ✅ Decided |
| **Q9: Blueprint Progression** | Manual initiation | ✅ Decided |
| **Q10: Panel Organization** | Both (status + category) | ✅ Decided |

### Decisions That Can Wait

- **Q12-Q15:** Can be decided during implementation of their respective phases
- **Tag Discovery:** Already decided (per-actor via usage tracking)
- **Workstation Placement:** Already decided (abstract for MVP, scene-based later)

---

## 🚀 Getting Started: Action Plan

### Today (2-3 hours)
1. **Resolve Q7-Q10** (30 min)
   - Review options
   - Make decisions
   - Update documentation
   
2. **Start Data Models** (2 hours)
   - Create `ArtificerIngredient` class
   - Create `ArtificerComponent` class
   - Create `ArtificerEssence` class
   - Test with example data

### This Week (10-15 hours)
1. **Complete Data Models** (4 hours)
   - `ArtificerRecipe` class
   - `ArtificerBlueprint` class
   
2. **Implement Storage Managers** (6 hours)
   - `IngredientStorage`
   - `RecipeStorage` with parser
   - `BlueprintStorage` with parser
   
3. **Implement TagManager** (2 hours)
   - Tag validation
   - Tag categories
   - Tag families

### Next Week (15-20 hours)
1. **Complete Item Creation UI** (6 hours)
   - Finish `window-artificer-item.js`
   - Create `utility-artificer-import.js`
   - Add menubar buttons
   
2. **Create Initial Data Set** (4 hours)
   - Starter ingredients
   - Starter components
   - Starter essences
   - Example recipes
   - Example blueprint
   
3. **Start Phase 2: Tag Logic** (10 hours)
   - Tag combination algorithm
   - ExperimentationEngine
   - Tag discovery system

---

## 🎯 Success Criteria

### Phase 1 Complete When:
- ✅ Can create ingredients/components/essences via form
- ✅ Can import items via JSON
- ✅ Can load ingredients from compendiums
- ✅ Can parse recipes from journals
- ✅ Can parse blueprints from journals
- ✅ TagManager validates tags
- ✅ Initial data set exists

### MVP Complete When:
- ✅ Players can experiment with ingredients
- ✅ Tag logic creates items
- ✅ Tag discovery works
- ✅ Recipes can be crafted
- ✅ Basic UI is functional
- ✅ Skills track progression

---

## 💡 Implementation Tips

### 1. Start Small
- Get one data model working end-to-end
- Test with one ingredient, one recipe
- Expand once core flow works

### 2. Test Frequently
- Test parsing with real journal entries
- Test item creation with real data
- Verify tag logic with known combinations

### 3. Follow Patterns
- Use Codex/Quest patterns for parsers
- Use FoundryVTT ApplicationV2 for UI
- Use flags for actor/world data

### 4. Document as You Go
- Update CHANGELOG.md with each feature
- Add JSDoc comments
- Keep examples updated

---

## ✅ All Decisions Made!

**All critical and important decisions have been resolved:**

1. ✅ **Q7:** Recipe numbering - Hash-based (R1, R2...)
2. ✅ **Q8:** Recipe result items - Link to existing items in compendium
3. ✅ **Q9:** Blueprint progression - Manual initiation
4. ✅ **Q10:** Panel organization - Both (status + category filter)

**Ready to proceed with full implementation! 🚀**
