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
Players combine up to three ingredients (raw, refined, essence) to create new items.  
Outcomes are based on tags rather than explicit recipes.  
Experimentation:
- always creates something  
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
Crafts use up to three ingredients:
- Base Material (raw or component)  
- Essence/Affinity (optional but influential)  
- Structural component (optional but enhances quality)  

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

### 7.1 Experimentation
Players freely combine ingredients.  
The system always produces:
- a valid item  
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
  ├── window-*.js                     (UI forms - FormApplication)
  ├── api-artificer.js                (module API exports)
  └── utils.js                        (utility functions)

resources/                             (JSON data files)
templates/                             (Handlebars templates)
styles/                                (CSS files)
```

**File Naming Conventions:**
- `schema-*` - JSDoc type definitions (documentation only, no data)
- `utility-*-parser` - Parsers following Codex/Quest patterns
- `manager-*` - Data managers (compendium/journal access)
- `panel-*` - UI panels (ApplicationV2)
- `window-*` - UI forms (FormApplication)
- `api-*` - Module API exports

### 11.2 Data Storage Strategy (Hybrid Approach)

Based on analysis of Codex and Quest system patterns, we'll use a hybrid storage approach:

#### Tier 1: Master Data (Compendium Packs - Journal Type)
- **Ingredients** (Raw Materials) - Stored as journal entries in compendium packs
- **Components** (Refined Materials) - Stored as journal entries in compendium packs
- **Essences** (Magical Affinities) - Stored as journal entries in compendium packs

**Rationale:** Frequently accessed during crafting operations. Fast lookup for tag combination logic. Better performance, easy to share/expand via compendiums. Using journal-type entries provides human-readable format while maintaining compendium performance benefits.

#### Tier 2: World Content (Journal Entries)
- **Recipes** - Structured HTML journal pages
- **Blueprints** - Multi-stage journal pages with state markup

**Rationale:** Human-editable by GMs, supports rich formatting, built-in permissions/ownership, easy to share as journal compendiums. Uses parser-based architecture (like Codex/Quest systems).

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
- **FormApplication** for creating/editing recipes/blueprints
- **ApplicationV2 Panel** for browsing (like CodexPanel/QuestPanel)
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

### 11.6 UI Components

**Crafting Interface (Secondary Bar):**
- 100px height secondary bar (already implemented)
- Opens via menubar tool (middle zone)
- Will contain main crafting UI

**Recipe/Blueprint Browser:**
- Status-based organization (like Quest system)
- Category filtering available
- Tag cloud filtering
- Search functionality

**Ingredient Browser:**
- Filter by family, tags, tier, rarity
- Show discovered/undiscovered tags
- Quantity from actor inventory

---

## 12. Outstanding Questions to Resolve

### Critical (Must Decide Before Phase 1)

**Q1: Ingredient Storage**
- **Decision:** Compendium Packs (journal type entries)
- **Rationale:** Performance benefits of compendiums with human-readable journal format
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
- Hash-based numbers (R1, R2, etc.)?
- **Status:** ⏳ Pending Decision
- **Recommendation:** Yes - consistent with Quest system

**Q8: Recipe Result Linking**
- Link to existing items or auto-create on craft?
- **Status:** ⏳ Pending Decision

**Q9: Blueprint Stage Progression**
- Player initiates each stage separately?
- Or stages auto-unlock when materials available?
- **Status:** ⏳ Pending Decision

**Q10: Panel Organization**
- Status-based, category-based, or both?
- **Status:** ⏳ Pending Decision
- **Recommendation:** Both (default to status, with category filter)

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
- ~~Resolve critical questions (Q1-Q6, Q11)~~ ✅ **COMPLETED**
- Phase 0: Foundation & Architecture Setup ✅ **COMPLETED**
  - Folder structure (resources/, templates/)
  - Schema files with JSDoc type definitions
  - Manager placeholder classes
  - Module API structure

### 🔄 In Progress
- Phase 1: Core Data System

### 📋 Next Steps
1. Phase 1: Implement data models and storage systems
2. Create parser classes for journal entries
3. Implement manager functionality
4. Create initial data set

---

## 14. JSON Structures (High-Level)

Future schemas will define:
- Ingredients  
- Components  
- Essences  
- Recipes  
- Blueprints  
- Items  
- Skills  
- Stations  

Expected fields include:
`name`, `type`, `tags`, `tier`, `rarity`, `source`, `effects`, `yield`, `quirk`.

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
