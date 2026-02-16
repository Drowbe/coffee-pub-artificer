# Coffee Pub Artificer  
### Crafting & Gathering System Design Document

---

## 1. Design Goals
- Create a fun, tactile, exploration-driven crafting loop.  
- Support gathering, salvaging, refining, experimenting, recipe-based crafting, and blueprint-driven aspirational items.  
- Keep the system simple enough to learn, but expandable enough to grow with the world.  
- Use tags to make combinations intuitive without requiring external tables or spreadsheets.  
- Make gathering feel playful, not like rolling dice.  
- Enable community contribution by establishing clear rules and conventions.

---

## 2. Core System Loop

### 2.1 Gathering
Players collect Raw Materials from:
- map interactables  
- gathering mini-games  
- biome or seasonal events  
- creature drops  
- environmental effects  

### 2.2 Refining & Salvage
Players break down:
- weapons  
- armor  
- junk  
- monster parts  

This produces Components used in advanced crafting.

### 2.3 Experimentation
Players combine ingredients with the right amounts, a solvent (water, oil, etc.), and a process (heating with temperature and time) to trigger crafting.  
See **§7.0 Experimentation Model** for the four required components.  
Experimentation:
- always creates something (when requirements are met)  
- encourages discovery  
- reveals tags gradually  

### 2.4 Crafting (Recipes & Blueprints)
Recipes ensure predictable crafting.  
Blueprints represent multi-stage, aspirational crafting tied to narrative arcs.

---

## 3. Ingredient Taxonomy

### 3.1 Raw Materials  
Gathered directly from the world. They support exploration, ecology, and travel.

**Families**
- Herbs & Plants  
- Minerals & Ores  
- Gems & Crystals  
- Creature Parts  
- Environmental Materials  

**Tag Examples**
- Herb, Floral, Medicinal, Toxic  
- Metal, Ore, Alloy-Friendly  
- Crystal, Resonant, Arcane  
- MonsterBits, Bone, Venom  
- Water, Fire, Earth, Air, Corrupted  
- Biome: Alpine, Swamp, Cavern, Desert  

**Rules**
- 1 primary tag  
- 1–2 secondary tags  
- Optional quirk (rare, volatile, soothing)

---

### 3.2 Components (Refined Materials)  
Predictable intermediate items used for structured crafting.

**Types**
- Metals: Ingots, Plates, Wires  
- Alchemical Components: Extracts, Oils, Powders  
- Monster Components: Hardened Bone Shard, Spirit Ash  
- Arcane Components: Mana Thread, Runic Ink  
- Structural Components: Haft Cores, Leather Straps  

**Tags**
Refined, Alloy, Stabilized, Binding, Reactive, Haft, Plate

---

### 3.3 Essences & Affinities  
Magical or conceptual energies that determine item behavior.

**Examples**
- Essence of Heat  
- Essence of Frost  
- Storm Affinity  
- Shadow Affinity  
- Life Essence  
- Decay Essence  

**Tags**
Heat, Cold, Electric, Light, Shadow, Time, Mind, Life, Death

---

### 3.4 Finished Items
Crafted from:
- Components  
- Essences  
- Optional catalysts  
- Player skill  
- Workstation modifiers  

Categories include weapons, armor, consumables, tools, gadgets, trinkets, and arcane devices.

---

## 4. Tags & Tag Logic

### 4.1 Tag Rules
- Every ingredient has 2–5 tags.  
- Tags define category, effect, or behavior.  
- Tags are nouns/adjectives, not verbs.  
- Tags create predictable item families.  
- Tags never determine power level (that comes from tier, skill, station, etc.).  
- Tags reveal gradually:
  - first use: primary tag  
  - 3 uses: secondary tag  
  - 5 uses: quirk

### 4.2 Combination Rules
Experimentation (see **§7.0**) requires: ingredients, quantities, solvent, and process (temp + time).  
Within that framework, crafts use:
- Base Material (raw or component)  
- Essence/Affinity (optional but influential)  
- Structural component (optional but enhances quality)  
- Solvent (water, oil, etc.) — distinct from ingredients  

Tags determine:
- item category  
- essence/element  
- behavior  
- variant patterns  

Recipes and blueprints override or refine these outcomes.

---

## 5. Gathering System

### 5.1 Interactive Gathering
Gathering is interactive and playful.

Possible interactions:
- Sparkle/Wiggle nodes to click  
- Hot/Cold proximity indicators  
- Mini-games:
  - timing bar  
  - radial spinner  
  - quick-match icons  

These scale with biome, rarity, player skill, weather, and time of day.

### 5.2 Seasonal & Regional Logic
Materials may only appear:
- in specific biomes  
- during certain seasons  
- under special weather  
- at particular times of day  
- in clusters or zones  

Example: Frostcap Bloom grows only in alpine regions during early morning.

---

## 6. Salvage & Breakdown System

### 6.1 Salvage Rules
Salvaging yields predictable quantities of:
- structural components  
- metal or wood equivalents  
- monster components  
- essences (rare)  

### 6.2 Example: Goblin Spear
Salvage yields:
- Common Metal Scraps (Metal, Refined)  
- Crude Binding (Binding)  
- Grease Residue (MonsterBits)

---

## 7. Crafting System

### 7.0 Experimentation Model (Four Required Components)

For a valid craft, experimentation requires **all four** of the following:

| Component | Role | Examples |
|-----------|------|----------|
| **Ingredients** | Herbs, minerals, essences, etc. — what you are crafting with | Lavender, Iron Ore, Life Essence |
| **Quantities** | Right amounts and proportions; not just "1 of each" | 2 parts herb : 1 part essence |
| **Solvent** | Water, oil, or other medium — required for the reaction | Spring Water, Cooking Oil, Alchemical Base |
| **Process** | Heating (or similar) — triggers the chemical change | Temperature (low/medium/high) + Duration (minutes/hours) |

**Result:** Ingredients + Quantities + Solvent + (Temperature × Time) → valid craft.

- **Solvents** are a distinct input category (water/oil/base), not just another ingredient contributing tags.  
- **Quantities** matter: ratios affect outcome and quality.  
- **Process** (heating) requires both temperature and time; wrong settings may produce sludge or failure.

*Note: Current implementation uses tag-based matching only. Quantities, solvent, and process (temp/time) are planned additions.*

### 7.1 Experimentation Behavior
Players freely combine ingredients.  
The system always produces:
- a valid item (when the model is satisfied)  
- a variant  
- or low-value sludge (never nothing)

### 7.2 Recipes
Recipes provide:
- predictable outcomes  
- reduced material cost  
- quality improvements  
- guaranteed variant unlocks  

Sources include books, NPCs, scrolls, dungeons, and discoveries.

### 7.3 Blueprints
Blueprints are multi-step, narrative-driven crafting requirements.

Blueprints require:
- multiple components  
- rare essences  
- special workstations  
- sufficient skill  
- staged assembly  

Example: The Arcanic Wayfinder.

---

## 8. Skill System

Lightweight skill categories:
- Herbalism  
- Metallurgy  
- Artifice  
- Alchemy  
- Monster Handling  

Skills increase through:
- successful crafting  
- quality results  
- tag discoveries  
- gathering mini-game success  
- salvaging rare items  

Skill levels gate advanced recipes and blueprints.

---

## 9. Workstations

Workstations influence:
- crafting quality  
- stability  
- recipe unlock chance  
- essence synergy  

Examples:
- Smithy Forge  
- Alchemist Table  
- Arcane Workbench  
- Cookfire Kit  
- Monster Research Bench  

Blueprints may require specific workstations.

---

## 10. Expansion & Community Guidelines

Creators must follow:
- one primary tag per ingredient  
- consistent family placement  
- no complicated quirks  
- 2–5 tags per ingredient  
- consistent naming conventions  
- refined components must remain standardized  
- blueprints must contain a narrative hook  

This preserves system stability.

---

## 11. Architecture & Technical Decisions

### 11.1 Module Structure

Following Codex/Quest naming patterns, the module uses a flat file structure:

```
scripts/
  ├── artificer.js                    (main entry point)
  ├── const.js                        (module constants)
  ├── settings.js                     (settings registration)
  │
  ├── schema-*.js                     (JSDoc type definitions)
  ├── utility-*-parser.js             (HTML parsers for journal entries)
  ├── manager-*.js                    (data managers)
  ├── panel-*.js                      (UI panels - ApplicationV2)
  ├── window-*.js                     (UI windows/forms - ApplicationV2)
  ├── systems/experimentation-engine.js  (tag rules, crafting logic)
  ├── api-artificer.js                (module API exports)
  └── utils.js                        (utility functions)

resources/                             (JSON data files)
templates/                             (Handlebars templates)
styles/                                (CSS files)
```

**File Naming Conventions:**
- `schema-*` - JSDoc type definitions (documentation only, no data)
- `utility-*-parser` - Parsers following Codex/Quest patterns
- `utility-*-item` - Item creation utilities (reusable core functions)
- `utility-*-import` - JSON import utilities
- `manager-*` - Data managers (compendium/journal access)
- `panel-*` - UI panels (ApplicationV2)
- `window-*` - UI forms (ApplicationV2)
- `api-*` - Module API exports

### 11.2 Data Storage Strategy (Hybrid Approach)

Based on analysis of Codex and Quest system patterns, we'll use a hybrid storage approach:

#### Tier 1: Master Data (Compendium Packs - Items)
- **Ingredients** (Raw Materials) - Stored as FoundryVTT Items in compendium packs
- **Components** (Refined Materials) - Stored as FoundryVTT Items in compendium packs
- **Essences** (Magical Affinities) - Stored as FoundryVTT Items in compendium packs

**Rationale:** Items represent physical materials that can be held, used, and consumed during crafting. Compendium packs provide fast lookup for tag combination logic, better performance, and easy sharing/expansion. Items can be dragged into actor inventories and used directly in crafting operations.

**Artificer Data Storage:**
- Artificer-specific data (tags, family, tier, rarity, biomes, etc.) is stored in `flags.artificer.*`
- Tags are only visible in the crafting UI, not in the standard item sheet
- Items include both D&D 5e item structure (for normal use) and artificer flags (for crafting logic)
- Item type is determined by the material (most ingredients are consumables, but results match the crafted item type)

**Item Creation:**
- Items are created in the world using unified creation forms (accessed via Artificer menubar)
- GMs can manually drag created items into compendium packs
- JSON import utilities support both single items and bulk imports
- Creation utilities are reusable (shared between manual forms and JSON import)

#### Tier 2: World Content (Journal Entries)
- **Recipes** - Structured HTML journal pages (instructions for crafting)
- **Blueprints** - Multi-stage journal pages with state markup (instructions for multi-stage crafting)

**Note:** Recipe and Blueprint results (the crafted items) are FoundryVTT Items, not journals. Recipes/Blueprints reference these items via `resultItemUuid`.

**Rationale:** Recipes and Blueprints are knowledge/instructions that GMs can edit and share. Storing them as journal entries provides human-editable format, rich formatting, built-in permissions/ownership, and easy sharing via journal compendiums. Uses parser-based architecture (like Codex/Quest systems). The actual crafted results (swords, potions, etc.) are Items that can be held and used.

#### Tier 3: Player Data (Actor Flags)
- Skills (Herbalism, Metallurgy, etc.)
- Tag discoveries (per ingredient, per actor)
- Blueprint progress (per blueprint, per actor)
- Unlocked recipes

**Rationale:** Player-specific data that changes frequently, tied to actors.

#### Tier 4: World/Scene Data (Scene Flags / World Settings)
- Workstation locations and states (scene flags)
- Gathering nodes (positions, states, respawn timers) (scene flags)
- Biome data (scene flags)
- World-wide settings (world settings)

**Rationale:** Spatial and world-level configuration.

---

### 11.3 Parser-Based Architecture

Following Codex/Quest patterns:

**Recipes & Blueprints:**
- Stored as structured HTML in journal entries
- Parsed on-demand using DOMParser
- Extract structured data via semantic HTML (`<p><strong>Label:</strong> value</p>`)
- Flexible schema - can add fields without migration
- Version-tolerant parsing

**Example Recipe Structure:**
```html
<p><strong>Recipe Name:</strong> Healing Potion</p>
<p><strong>Type:</strong> Consumable</p>
<p><strong>Category:</strong> Potion</p>
<p><strong>Skill:</strong> Alchemy</p>
<p><strong>Skill Level:</strong> 25</p>
<p><strong>Workstation:</strong> Alchemist Table</p>
<p><strong>Ingredients:</strong></p>
<ul>
    <li>Herb: Lavender (2)</li>
    <li>Essence: Life (1)</li>
</ul>
<p><strong>Result:</strong> @UUID[Item.abc123]{Healing Potion}</p>
<p><strong>Tags:</strong> healing, consumable, potion</p>
```

**Blueprint Stage State Markup:**
- `<s>`, `<del>`, or `<strike>`: Completed stages
- `<code>`: Failed stages
- `<em>` or `<i>`: Hidden stages (GM-only)
- Plain text: Active stages

---

### 11.4 Patterns Adopted from Codex/Quest Systems

#### ✅ Parser-Based Architecture
- HTML stored in journals, parsed on-demand
- Flexible, version-tolerant, human-editable

#### ✅ Form/Panel Pattern
- **ApplicationV2** for all UI (create/edit forms, panels, windows) — no legacy FormApplication
- ApplicationV2 for browsing (like CodexPanel/QuestPanel)
- Drag & drop auto-population

#### ✅ Status-Based Organization
- Recipes/Blueprints grouped by status (Available, Locked, Unlocked, In Progress, Complete)
- Dynamic status calculation from requirements/state

#### ✅ Client-Side Filtering
- DOM-based filtering for performance
- Tag-based filtering, search, category filters

#### ✅ Scene Pin Integration (Future)
- PIXI-based pins for workstations and gathering nodes
- Interactive canvas placement (like Quest pins)
- Position persistence in scene flags

#### ✅ Notification Integration
- Use Blacksmith API for crafting event notifications
- Tag discoveries, skill increases, crafting success/failure, etc.

#### ✅ Hash-Based Numbering (Optional)
- Recipe numbers (R1, R2, etc.) from UUID hash
- Blueprint numbers (B1, B2, etc.)
- Consistent reference system

---

### 11.5 Journal Organization

**Recipes:**
- Default journal: "Artificer Recipes" (auto-created if missing)
- User-configurable: Can select different journal via settings
- Single journal recommended (simpler management)

**Blueprints:**
- **DECISION:** Separate journal ("Artificer Blueprints") for clarity and different permissions
- Default journal: "Artificer Blueprints" (auto-created if missing)
- User-configurable: Can select different journal via settings

---

### 11.6 Item Creation & Import Architecture

**Core Utilities:**
- `utility-artificer-item.js` - Reusable item creation functions
  - `createArtificerItem()` - Creates items with D&D 5e structure + artificer flags
  - `updateArtificerItem()` - Updates existing items
  - `validateArtificerData()` - Validates artificer data structure
  - Used by both manual forms and JSON import

**Manual Creation:**
- Unified form (`window-artificer-item.js`) for creating ingredients/components/essences
- Form switches between types via UI (ingredient/component/essence)
- Accessed via Artificer menubar buttons
- Creates items in world (GM drags to compendium manually)

**JSON Import:**
- `utility-artificer-import.js` - JSON import utilities
  - Supports both single items and bulk imports (arrays)
  - Validates JSON structure
  - Uses core creation utilities for consistency
- JSON structure includes both D&D 5e fields and `flags.artificer` section
- Import accessed via Artificer menubar

**Menubar Integration:**
- Create Item button (opens unified form)
- Import Items button (opens file picker or JSON paste dialog)
- Integrated into existing Artificer menubar tool

### 11.7 UI Components

**Crafting Window:**
- Three-zone layout: ingredient list | crafting bench | feedback
- Opens via Artificer menubar tool (middle zone)
- Ingredient list shows only Artificer ingredients (flags + type ingredient/component/essence)
- Feedback zone shows tags in bench, craft result, known combinations

**Recipe/Blueprint Browser:**
- Status-based organization (like Quest system)
- Category filtering available
- Tag cloud filtering
- Search functionality

**Ingredient Browser:**
- Filter by family, tags, tier, rarity
- Show discovered/undiscovered tags (tags only visible in crafting UI, not item sheet)
- Quantity from actor inventory

---

## 12. Outstanding Questions to Resolve

### Critical (Must Decide Before Phase 1)

**Q1: Ingredient Storage**
- **Decision:** Compendium Packs (Items)
- **Rationale:** Ingredients are physical materials that need to be held and used in crafting. Storing them as FoundryVTT Items allows them to be dragged into actor inventories, used in crafting operations, and consumed. Compendiums provide performance benefits and easy sharing/expansion.
- **Status:** ✅ Decided

**Q2: Blueprint Storage**
- **Decision:** Separate journal from recipes ("Artificer Blueprints")
- **Rationale:** Clear separation, different permissions possible, cleaner organization
- **Status:** ✅ Decided

**Q3: Canvas/Pin Approach for MVP**
- **Decision:** Abstract menu-based for MVP
- **Rationale:** Faster to build, canvas pins can be added in Phase 8/12
- **Status:** ✅ Decided

**Q4: Blueprint State Representation**
- **Decision:** HTML markup (`<s>`, `<code>`, `<em>`) like Quest tasks
- **Rationale:** Consistent with Quest patterns, human-editable, version-tolerant
- **Status:** ✅ Decided

**Q5: Workstation Storage**
- **Decision:** Hybrid approach (Compendium for definitions + scene flags for instances)
- **Rationale:** Reusable definitions in compendium, scene-specific placement/state in flags
- **Status:** ✅ Decided

**Q6: Gathering Node Storage**
- **Decision:** Compendium for definitions + scene flags for instances
- **Rationale:** Consistent with workstation approach, reusable definitions, scene-specific data
- **Status:** ✅ Decided

### Important (Should Decide Before Phase 2-3)

**Q7: Recipe Numbering**
- **Decision:** Hash-based numbers (R1, R2, etc.)
- **Rationale:** Consistent with Quest system, easy reference system, stable IDs even if recipe name changes
- **Status:** ✅ Decided

**Q8: Recipe Result Item Creation**
- **Decision:** Link to existing item in compendium (Option A)
- **Rationale:** Recipe stores `resultItemUuid` pointing to existing item. Crafting creates a copy of that item. Provides consistent item definitions, easy to update all instances, requires pre-creating recipe result items.
- **Status:** ✅ Decided

**Q9: Blueprint Stage Progression**
- **Decision:** Player manually initiates each stage (Option A)
- **Rationale:** Player sees available stages and clicks "Start Stage 2" when ready. Provides player control, clear progression, requires extra clicks but better UX.
- **Status:** ✅ Decided

**Q10: Panel Organization**
- **Decision:** Both (default to status, with category filter) (Option C)
- **Rationale:** Default shows player state (Available, Locked, In Progress, Complete), with ability to filter by category (Potion, Weapon, Armor, etc.) when needed. Best of both worlds.
- **Status:** ✅ Decided

**Q11: Item System Integration**
- **Decision:** D&D 5e
- **Rationale:** Primary target system for item structure and stats
- **Status:** ✅ Decided

### Nice to Have (Can Decide During Implementation)

**Q12: Pin Interactions**
- Click behaviors, drag, right-click menus, tooltips

**Q13: Export/Import Format**
- JSON export/import, journal compendiums, or both?

**Q14: Notification Events**
- Which crafting events trigger notifications?
- Likely configurable in settings

**Q15: Progress Display**
- Where to show progress bars (crafting panel, recipe browser, actor sheet)?

---

## 13. Implementation Status

### ✅ Completed
- Module setup and GitHub repository
- Menubar integration (Artificer tool in middle zone)
- Secondary bar (100px height, ready for content)
- Blacksmith API integration
- Resolve critical questions (Q1-Q6, Q11) ✅
- Phase 0: Foundation & Architecture Setup ✅
  - Folder structure (resources/, templates/)
  - Schema files, manager placeholders, module API
- Phase 1: Item Creation & Import System ✅
  - Core item creation utilities (`utility-artificer-item.js`)
  - Unified form (`window-artificer-item.js`), JSON import (`utility-artificer-import.js`)
  - Menubar buttons for Create Item and Import Items
- Crafting Window ✅
  - Three-zone layout (ingredient list | bench | feedback)
  - Experimentation engine (tag-based rules, `systems/experimentation-engine.js`)
  - Ingredient filtering (Artificer ingredients only), known combinations in feedback
  - Seed Test Ingredients for GMs

### 🔄 In Progress
- Recipe/Blueprint journal parser and browser
- Skill system, workstation system
- **Experimentation Model (§7.0):** Quantities, solvent, process (temp/time) — planned, not yet implemented

### 📋 Next Steps
1. Implement §7.0 Experimentation Model: solvent selection, quantity inputs, temperature + time
2. Recipe parser and browser
3. Skill levels, workstation modifiers
4. Blueprint multi-stage flow

---

## 14. JSON Structures

### 14.1 Item JSON Structure

Items (Ingredients, Components, Essences) use a hybrid JSON structure:

**D&D 5e Item Fields:**
- Standard D&D 5e item structure (name, type, description, weight, price, rarity, etc.)
- Matches Blacksmith/FoundryVTT format for compatibility
- Item type depends on material (most ingredients = consumable, results match crafted type)

**Artificer Flags Section:**
```json
{
  "flags": {
    "artificer": {
      "type": "ingredient|component|essence",
      "primaryTag": "string",
      "secondaryTags": ["string"],
      "tier": 1,
      "rarity": "Common|Uncommon|Rare|Epic|Legendary",
      // Ingredient-specific:
      "family": "Herbs|Minerals|Gems|CreatureParts|Environmental",
      "quirk": "string|null",
      "biomes": ["string"],
      // Component-specific:
      "componentType": "Metal|Alchemical|Monster|Arcane|Structural",
      // Essence-specific:
      "affinity": "Heat|Cold|Electric|Light|Shadow|Time|Mind|Life|Death"
    }
  }
}
```

**Full JSON Template:**
- Combines D&D 5e item structure with `flags.artificer` section
- Supports both single items and arrays (for bulk import)
- Used by import utilities and can be generated by forms

### 14.2 Future Schemas

Additional schemas to define:
- Recipes (Journal entries)  
- Blueprints (Journal entries)  
- Skills (Actor flags)  
- Workstations (Compendium + scene flags)

---

## 15. System Capabilities

This crafting system supports:
- intuitive experimentation  
- narrative-driven rare-item creation  
- biome-based gathering  
- seasonal events  
- meaningful recipes  
- adaptive expansion  
- community-driven contributions  
- salvage loops that make every drop useful  
- exploration that rewards curiosity  

---

## Notes

- See `documentation/DEVELOPMENT_PLAN.md` for detailed phased implementation plan
- Architecture decisions based on analysis of Coffee Pub Codex and Quest systems
- All patterns leverage FoundryVTT native systems (journals, flags, compendiums) for maximum compatibility

---

## 16. Architecture Review (Alignment Check)

**Purpose:** Ensure the architecture document stays aligned with the implementation and the intended design.

### Current Alignment
- **§7.0 Experimentation Model** — Added. Defines four required components: Ingredients, Quantities, Solvent, Process (temp + time). *Implementation: tag-based only; quantities, solvent, and process planned.*
- **§2.3, §4.2, §7.1** — Updated to reference §7.0 and solvent/process.
- **§11.1 Module Structure** — Updated: window-* uses ApplicationV2; added `systems/experimentation-engine.js`.
- **§11.4 Form/Panel** — Updated: ApplicationV2 only (no legacy FormApplication).
- **§11.7 UI Components** — Updated: Crafting Window (three-zone layout) instead of "secondary bar will contain".
- **§13 Implementation Status** — Updated to reflect completed Crafting Window, experimentation engine, and in-progress §7.0 model.

### Data Conventions
- **Flags:** Architecture refers to `flags.artificer.*`; implementation uses `flags[MODULE.ID]` (e.g. `flags["coffee-pub-artificer"]`). Same data, different key.
