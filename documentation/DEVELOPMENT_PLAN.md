# Coffee Pub Artificer - Development Plan

## Overview
This plan breaks down the crafting system into manageable phases, building from core data structures to advanced features. Each phase delivers a working increment that can be tested and refined before moving forward.

---

## Phase 0: Foundation & Architecture Setup
**Goal:** Establish core infrastructure, data storage, and basic module structure.

### Tasks:
1. **Data Storage System**
   - Decide on storage approach (Compendium Packs vs. World Storage vs. Hybrid)
   - Create data manager class for CRUD operations
   - Define data migration strategy for future schema changes
   - Consider using FoundryVTT's built-in storage (flags, world settings, compendiums)

2. **JSON Schema Definitions**
   - Create TypeScript-style JSDoc definitions for all data types
   - Define validation functions for each data type
   - Create example/default data structures:
     - `Ingredient` (Raw Materials)
     - `Component` (Refined Materials)
     - `Essence` (Magical Affinities)
     - `Recipe` (Structured Crafting)
     - `Blueprint` (Multi-stage Crafting)
     - `Workstation` (Crafting Locations)
     - `Skill` (Player Progression)

3. **Module Structure**
   - Set up flat file structure following Codex/Quest patterns:
     - `schema-*.js` - JSDoc type definitions
     - `manager-*.js` - Data managers
     - `api-artificer.js` - Module API
     - `resources/` - JSON data files (when needed)
     - `templates/` - Handlebars templates (when needed)
   - Create core manager classes (placeholder structure)
   - Set up module API for external access

4. **Settings Framework**
   - Define module settings in `settings.js`
   - Add localization keys for settings
   - Settings to consider:
     - Enable/disable features (gathering, salvage, etc.)
     - Tag discovery thresholds (uses required)
     - Skill progression rates
     - Workstation availability

**Deliverable:** Module loads successfully, data structures defined, basic settings registered.

---

## Phase 1: Core Data System
**Goal:** Implement data models and storage for all crafting entities.

### Tasks:
1. **Data Models**
   - Create class-based models for:
     - `ArtificerIngredient` - Raw materials with tags, family, tier, rarity
     - `ArtificerComponent` - Refined materials
     - `ArtificerEssence` - Magical affinities
     - `ArtificerRecipe` - Recipe definitions
     - `ArtificerBlueprint` - Multi-stage blueprint definitions
     - `ArtificerWorkstation` - Workstation definitions
   - Implement validation methods
   - Add serialization/deserialization

2. **Tag System Foundation**
   - Create `TagManager` class
   - Implement tag validation (2-5 tags per ingredient)
   - Tag categories (primary, secondary, quirk)
   - Tag family definitions (Herb, Metal, Crystal, etc.)
   - Tag combination rules (base structure, will be refined in Phase 2)

3. **Item Creation & Import System**
   - Create `utility-artificer-item.js` with core item creation functions
     - `createArtificerItem()` - Creates items with D&D 5e structure + artificer flags
     - `updateArtificerItem()` - Updates existing items
     - `validateArtificerData()` - Validates artificer data structure
   - Create `window-artificer-item.js` unified form for manual creation
     - Switches between ingredient/component/essence types
     - Collects D&D 5e item fields + artificer-specific fields
     - Creates items in world (GM drags to compendium)
   - Create `utility-artificer-import.js` for JSON import
     - Supports single items and bulk imports (arrays)
     - Validates JSON structure
     - Uses core creation utilities for consistency
   - Define JSON structure (D&D 5e fields + flags.artificer section)
   - Add menubar buttons for Create Item and Import Items

4. **Data Storage Implementation**
   - Implement storage manager for Items (ingredients, components, essences in compendium packs)
   - Implement storage manager for Journal Entries (recipes, blueprints in world journals)
   - Artificer data stored in `flags.artificer.*` (tags only visible in crafting UI)
   - Migration system for future updates

5. **Initial Data Set**
   - Create starter set of ingredient Items (5-10 examples per family) using creation utilities
   - Create starter set of component Items (2-3 per type)
   - Create starter set of essence Items (5-7 examples)
   - Create 2-3 example recipe Journal entries
   - Create 1 example blueprint Journal entry

**Deliverable:** Item creation system working, can create items manually and via JSON import, data models working, initial data set available.

---

## Phase 2: Tag Logic & Experimentation Engine
**Goal:** Implement the core tag-based crafting logic that makes experimentation work.

### Tasks:
1. **Tag Combination Rules**
   - Implement tag matching algorithm
   - Define item category determination from tags
   - Implement essence/element derivation
   - Behavior pattern matching
   - Variant pattern generation
   - Fallback to "sludge" for invalid combinations (never fail completely)

2. **Tag Discovery System**
   - Track ingredient usage per actor
   - Store discovered tags in actor flags
   - Implement progressive reveal:
     - 1st use: reveal primary tag
     - 3 uses: reveal secondary tag
     - 5 uses: reveal quirk
   - UI indicator for undiscovered tags (??? or hidden)
   - Discovery notification system

3. **Experimentation Engine**
   - Create `ExperimentationEngine` class
   - Validate input (1-3 ingredients)
   - Apply tag combination rules
   - Generate crafted item based on tags
   - Calculate quality/stability based on:
     - Skill levels
     - Workstation quality
     - Ingredient tier/rarity
   - Return result (item, variant, or sludge)

4. **Item Generation**
   - Create FoundryVTT Item from tag combination
   - Determine item type (weapon, armor, consumable, etc.)
   - Generate appropriate stats based on tags
   - Apply tier/rarity modifiers
   - Name generation based on tags

**Deliverable:** Players can combine ingredients, tag logic determines outcomes, tag discovery works, items are created.

---

## Phase 3: Basic UI - Crafting Interface
**Goal:** Build the core crafting UI that players use to experiment and craft.

### Tasks:
1. **Crafting Window (ApplicationV2)**
   - Main crafting interface
   - Ingredient selection (1-3 slots)
   - Ingredient browser/search/filter
   - Tag display (with discovery states)
   - Craft button
   - Result preview/display area
   - Integration with actor inventory

2. **Ingredient Browser**
   - List available ingredients
   - Filter by family, tags, tier, rarity
   - Show discovered/undiscovered tags
   - Quantity display (from actor inventory)
   - Drag-and-drop to crafting slots

3. **Recipe Browser**
   - List known recipes
   - Filter by skill requirement, workstation, category
   - Recipe details view
   - "Craft from Recipe" functionality
   - Recipe unlock status

4. **Result Display**
   - Show crafted item preview
   - Display generated stats
   - Show tag contributions
   - Quality/stability indicators
   - "Add to Inventory" button

**Deliverable:** Players can open crafting window, select ingredients, craft items, see results.

---

## Phase 4: Skill System & Progression
**Goal:** Implement player skill tracking and progression gates.

### Tasks:
1. **Skill Data Model**
   - Define skill categories:
     - Herbalism
     - Metallurgy
     - Artifice
     - Alchemy
     - Monster Handling
   - Store skills in actor flags
   - Skill levels (0-100 or similar)

2. **Skill Progression Logic**
   - XP gain from:
     - Successful crafting
     - Quality results (higher quality = more XP)
     - Tag discoveries
     - Gathering mini-game success
     - Salvaging rare items
   - Calculate XP requirements per level
   - Level-up notifications

3. **Skill Gating**
   - Recipe skill requirements
   - Blueprint skill requirements
   - Workstation skill requirements
   - Tag discovery bonuses at higher skills

4. **Skill UI**
   - Skill display in actor sheet (hook into sheet)
   - Skill display in crafting window
   - Progress bars
   - Skill tooltips with descriptions

**Deliverable:** Skills tracked per actor, progression works, skills gate advanced content.

---

## Phase 5: Recipe System
**Goal:** Implement recipe-based crafting with predictable outcomes.

### Tasks:
1. **Recipe Management**
   - Recipe storage and retrieval
   - Recipe unlock system (from books, NPCs, discoveries)
   - Recipe sharing (world-wide or per-actor)
   - Recipe validation

2. **Recipe Crafting**
   - Craft from recipe (override tag logic)
   - Apply recipe benefits:
     - Reduced material cost
     - Quality improvements
     - Guaranteed variant unlocks
   - Recipe requirement validation (materials, skill, workstation)

3. **Recipe Discovery**
   - Unlock recipes from:
     - Journal entries (books)
     - Actor items (scrolls)
     - Loot drops
     - Experimentation discovery (rare chance)
   - Recipe notification system

4. **Recipe UI Integration**
   - Recipe browser (from Phase 3, now functional)
   - Recipe unlock indicators
   - Recipe requirements display
   - "Unlock Recipe" flow

**Deliverable:** Recipes work, can unlock and craft from recipes, recipe benefits apply.

---

## Phase 6: Workstation System
**Goal:** Implement workstations that influence crafting quality and unlock options.

### Tasks:
1. **Workstation Data**
   - Workstation definitions (Smithy, Alchemist Table, etc.)
   - Workstation properties:
     - Quality modifiers
     - Stability bonuses
     - Recipe unlock chance
     - Essence synergy bonuses
   - Workstation requirements (skill, location, availability)

2. **Workstation Placement**
   - Place workstations on scenes (Tile or Token-based)
   - Define workstation types in scene flags
   - Workstation availability per scene/world

3. **Workstation Integration**
   - Detect active workstation when crafting
   - Apply workstation modifiers to crafting
   - Validate workstation requirements for recipes/blueprints
   - Workstation-specific crafting bonuses

4. **Workstation UI**
   - Workstation indicator in crafting window
   - Workstation browser/manager
   - Workstation placement tool (GM only)

**Deliverable:** Workstations influence crafting, required for some recipes/blueprints, can place on scenes.

---

## Phase 7: Salvage & Breakdown System
**Goal:** Allow players to break down items into components.

### Tasks:
1. **Salvage Rules Engine**
   - Define salvage yields per item type
   - Salvage tables (weapons → metal scraps, bindings)
   - Rarity-based salvage bonuses
   - Skill-based salvage improvements
   - Essence extraction (rare)

2. **Salvage UI**
   - Salvage button on item context menu
   - Salvage confirmation dialog
   - Preview salvage yields
   - Salvage result display

3. **Integration with Foundry Items**
   - Hook into item sheets
   - Context menu integration
   - Support for system-agnostic item breakdown
   - Preserve original item (optionally) or consume it

4. **Salvage Data**
   - Define salvage tables for common item types
   - Allow GMs to customize salvage yields
   - Salvage rules configuration

**Deliverable:** Players can salvage items, receive predictable components, salvage UI integrated.

---

## Phase 8: Gathering System (Basic)
**Goal:** Implement interactive gathering for raw materials.

### Tasks:
1. **Gathering Nodes**
   - Place gathering nodes on scenes (Tile-based or Token-based)
   - Node definitions (material type, biome, rarity)
   - Node respawn logic
   - Node visibility (based on skill/exploration)

2. **Basic Gathering Interaction**
   - Click/interact with gathering node
   - Simple success/failure check (based on skill)
   - Material yield calculation
   - Animation/feedback

3. **Biome & Seasonal Logic (Basic)**
   - Store biome data on scenes
   - Filter materials by biome
   - Basic seasonal/time-of-day checks
   - Material availability based on conditions

4. **Gathering UI**
   - Gathering node indicators
   - Gathering interaction prompt
   - Material yield display
   - Gathering log/history

**Deliverable:** Players can find and gather materials from scene nodes, biome logic works.

---

## Phase 9: Blueprint System
**Goal:** Implement multi-stage, narrative-driven blueprints.

### Tasks:
1. **Blueprint Data Model**
   - Multi-stage blueprint structure
   - Stage dependencies
   - Narrative hooks/story elements
   - Blueprint completion tracking

2. **Blueprint Progression**
   - Track blueprint progress per actor
   - Stage completion validation
   - Unlock next stage on completion
   - Blueprint completion rewards

3. **Blueprint Crafting**
   - Multi-stage crafting flow
   - Stage requirement validation
   - Staged assembly process
   - Final item assembly

4. **Blueprint UI**
   - Blueprint browser
   - Blueprint progress tracker
   - Active blueprint display
   - Stage-by-stage crafting interface

**Deliverable:** Blueprints work, multi-stage crafting flows, progress tracked, narrative elements supported.

---

## Phase 10: Gathering Mini-Games (Advanced)
**Goal:** Add playful mini-games for gathering instead of simple dice rolls.

### Tasks:
1. **Mini-Game Framework**
   - Mini-game base class/interface
   - Mini-game types:
     - Timing bar
     - Radial spinner
     - Quick-match icons
   - Difficulty scaling (skill, rarity, biome)

2. **Timing Bar Mini-Game**
   - Moving bar indicator
   - Hit zone mechanics
   - Success/failure calculation
   - Visual feedback

3. **Radial Spinner Mini-Game**
   - Spinning wheel interaction
   - Target zone mechanics
   - Success calculation

4. **Quick-Match Mini-Game**
   - Pattern matching
   - Time pressure
   - Success calculation

5. **Mini-Game Integration**
   - Trigger mini-games on gathering interaction
   - Scale difficulty based on context
   - Reward calculation based on performance
   - Skip option for players who prefer simplicity

**Deliverable:** Gathering mini-games implemented, players can choose to use them, difficulty scales appropriately.

---

## Phase 11: Advanced Gathering Features
**Goal:** Add sparkle/wiggle nodes, proximity indicators, and advanced biome logic.

### Tasks:
1. **Visual Indicators**
   - Sparkle/wiggle animations for gathering nodes
   - Hot/cold proximity indicators
   - Rarity visual indicators
   - Biome-specific visuals

2. **Advanced Biome Logic**
   - Complex seasonal rules
   - Weather system integration
   - Time-of-day specific materials
   - Cluster/zone spawning

3. **Exploration Integration**
   - Materials tied to exploration progress
   - Hidden material discovery
   - Map interactables
   - Creature drop integration

**Deliverable:** Enhanced gathering experience with visual feedback, advanced biome rules work.

---

## Phase 12: Canvas Integration & Advanced UI
**Goal:** Integrate gathering and crafting with Foundry's canvas for immersive experience.

### Tasks:
1. **Canvas Interactions**
   - Click gathering nodes on canvas
   - Visual feedback on canvas
   - Workstation placement visualization
   - Material node rendering

2. **Advanced Crafting UI**
   - Drag-and-drop ingredient slots
   - Tag visualization (color-coded, icons)
   - Recipe comparison view
   - Crafting history log

3. **Integration Points**
   - Actor sheet integration (crafting button)
   - Item sheet integration (salvage button)
   - Token right-click menus
   - Scene control buttons

**Deliverable:** Canvas integration complete, advanced UI features working, seamless Foundry integration.

---

## Phase 13: Community Features & Expansion Support
**Goal:** Enable community contributions and expansion packs.

### Tasks:
1. **Import/Export System**
   - Export ingredient/recipe/blueprint packs
   - Import community content
   - Validation on import
   - Conflict resolution

2. **Expansion Guidelines**
   - Documentation for content creators
   - Tag naming conventions enforcement
   - Validation tools for community content
   - Example expansion pack

3. **Content Management UI**
   - GM tools for managing imported content
   - Enable/disable expansion packs
   - Content source attribution
   - Community content browser (if applicable)

**Deliverable:** Community can create and share content, import/export works, guidelines documented.

---

## Phase 14: Polish & Optimization
**Goal:** Refine UX, optimize performance, add quality-of-life features.

### Tasks:
1. **Performance Optimization**
   - Optimize tag combination algorithms
   - Cache frequently accessed data
   - Lazy-load UI components
   - Reduce database queries

2. **UX Polish**
   - Tooltips and help text
   - Keyboard shortcuts
   - Bulk crafting operations
   - Quick-craft from history
   - Favorites/pinned recipes

3. **Error Handling**
   - Comprehensive error handling
   - User-friendly error messages
   - Recovery from invalid states
   - Data validation feedback

4. **Localization**
   - Complete localization coverage
   - Community translation support
   - Dynamic language switching

**Deliverable:** Module is polished, performant, user-friendly, ready for release.

---

## Technical Considerations

### Data Storage Strategy
**Recommendation:** Hybrid approach
- **Compendium Packs** for default/master content (ingredients, components, essences, recipes, blueprints, workstations)
- **World Storage** (flags/settings) for:
  - Player skill data (actor flags)
  - Tag discoveries (actor flags)
  - Unlocked recipes (actor flags or world flags)
  - Blueprint progress (actor flags)
  - Custom content (world settings)

**Benefits:**
- Easy to share/export default content
- Player data persists per-world
- Can create expansion compendiums
- GM can customize world-specific content

### Tag Combination Algorithm Approach
**Recommendation:** Rule-based matching system
1. Collect all tags from input ingredients
2. Categorize tags (primary, secondary, element, structural)
3. Apply matching rules (priority-based)
4. Generate item type from dominant tags
5. Apply modifiers from secondary tags
6. Fallback to generic item if no match
7. Never fail - always produce something (even if sludge)

### Integration Points with FoundryVTT
- **Actor Flags:** Skills, tag discoveries, blueprint progress
- **Item Flags:** Artificer data (tags, tier, source ingredients)
- **Scene Flags:** Workstations, gathering nodes, biome data
- **Hooks:** Item creation, actor sheet rendering, canvas interactions
- **ApplicationV2:** All major UI windows
- **Compendium Packs:** Default content storage

### Dependencies to Consider
- **Coffee Pub Blacksmith** (required) - Already integrated
- **SocketLib** (optional) - For cross-client sync of crafting actions
- **libWrapper** (optional) - For wrapping Foundry core functions if needed

---

## Development Priorities (MVP Path)

If you want to get to a working MVP faster, prioritize:

1. **Phase 0-1:** Foundation (essential)
2. **Phase 2:** Tag Logic (core mechanic)
3. **Phase 3:** Basic UI (must have)
4. **Phase 5:** Recipe System (important for structure)
5. **Phase 4:** Skill System (can be simplified initially)
6. **Phase 7:** Salvage (important for resource loop)

Then add:
- Phase 6: Workstations (enhancement)
- Phase 8: Gathering (enhancement)
- Phase 9: Blueprints (advanced feature)
- Phase 10-14: Polish and advanced features

---

## Questions to Resolve Before Starting

1. **Item System Integration:** Which Foundry game system are you targeting primarily? (D&D 5e, PF2e, custom?) This affects how crafted items are structured.

2. **Data Storage:** Confirm compendium pack approach vs. world storage preference.

3. **Tag Discovery:** Should tag discovery be per-actor or world-wide? (Document says per-actor via usage tracking)

4. **Workstation Requirements:** Do workstations need to be placed on scenes, or can they be abstract (menu selection)?

5. **Gathering Nodes:** Should gathering be scene-based (tiles/tokens) or abstract (menu-based)?

6. **Community Content:** How strict should validation be? Should there be a curated marketplace or open import?

---

## Estimated Timeline

This is a complex system. Realistic estimates:

- **Phase 0-2:** 20-30 hours (Foundation + Core Logic)
- **Phase 3-4:** 15-20 hours (Basic UI + Skills)
- **Phase 5-7:** 20-25 hours (Recipes + Workstations + Salvage)
- **Phase 8-9:** 15-20 hours (Gathering + Blueprints)
- **Phase 10-14:** 30-40 hours (Polish + Advanced Features)

**Total:** ~100-135 hours for complete implementation

**MVP Path:** ~50-70 hours for core functionality

---

This plan provides a clear roadmap from foundation to full feature set. Each phase builds on previous work and can be tested independently.

