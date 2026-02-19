# Coffee Pub Artificer  
### Crafting & Gathering System Design Document

---

## 0. System at a Glance

**What it is:** A tag-based crafting system that encourages experimentation and discovery. Players gather raw materials, salvage items for components, and craft through experimentation, recipes, or multi-stage blueprints.

**The core loop:** Gather → Salvage → Experiment → (Recipes & Blueprints) → Crafted Items. Experimentation combines up to 3 ingredients; tag matching determines the result. Recipes give predictable outcomes; blueprints are multi-stage narrative projects.

**Item data hierarchy (organizing principle):**
- **TYPE** → **FAMILY** → **TRAITS**
- **TYPE:** Component | Creation | Tool (the top-level bucket)
- **FAMILY:** Identity within the type (e.g. Plant, Mineral, Potion, Apparatus); depends on TYPE
- **TRAITS:** Modifiers that refine behavior/variant/quality (e.g. Floral, Medicinal, Arcane); do not repeat type or family

**Example:** `[COMPONENT] > [PLANT] > [FLORAL, MEDICINAL, ARCANE]`

**Traits** determine crafting outcome (item category, elemental effects, behavior, variant). Traits may be revealed progressively (e.g. after N uses) for discovery.

**Three crafting methods:**
1. **Experimentation** — Free-form; tag combination rules; may produce sludge if no match
2. **Recipes** — Structured journal entries; predictable outcomes; reduced cost, quality bonus
3. **Blueprints** — Multi-stage journal entries; narrative-driven; staged assembly

*For detailed user-facing explanation, see `documentation/overview.md`.*

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

## 3. Item Data Hierarchy: TYPE > FAMILY > TRAITS

All Artificer items are organized by a single, non-redundant hierarchy. **Family** is the identity; **traits** are modifiers. There is no separate "primary tag"—family fills that role.

### 3.1 TYPE (Top-Level)

| TYPE       | Description |
|-----------|-------------|
| **Component** | Gathered, harvested, or refined inputs used in crafting |
| **Creation**  | Results of recipes/blueprints (crafted items) |
| **Tool**      | Used for crafting (apparatus, containers) |

### 3.2 FAMILY (Depends on TYPE)

**Components:**
- Creature Part, Environmental, Essence, Gem, Mineral, Plant

**Creations:**
- Food, Material, Poison, Potion

**Tools:**
- Apparatus, Container

*Terminology:* Use **Creature Part** (singular) or **Creature Parts** for components harvested from creatures.

### 3.3 TRAITS

Traits are modifiers that describe behavior, variant, or quality. They **must not repeat** the type or family name.

**Examples (by context):**
- Plant components: Floral, Medicinal, Toxic, Aromatic, Arcane
- Mineral components: Ore, Alloy-Friendly, Dense, Malleable
- Essence components: Heat, Cold, Electric, Light, Shadow, Life, Death
- Creations: modifiers from combined component traits

**Rules:**
- Zero or more traits per item
- Traits are nouns/adjectives; they determine crafting outcome (category, behavior, variant)
- Traits never determine power level (that comes from skillLevel, rarity, workstation)
- Optional: some traits may be "discovery" traits (revealed after N uses)

*Note:* The old "quirk" concept is folded into traits; a quirk is simply a trait that can be revealed later for discovery gameplay.

### 3.4 Example

`[COMPONENT] > [PLANT] > [FLORAL, MEDICINAL, ARCANE]` — A plant component with three traits.

### 3.5 Finished Items (Creations)

Crafted from components, essences, optional catalysts, player skill, and workstation modifiers. Categories include weapons, armor, consumables, tools, and arcane devices.

---

## 4. Family & Trait Logic (Crafting)

### 4.1 Organizing Principles
- **Family** (per TYPE) identifies the item; it drives broad crafting category.
- **Traits** are modifiers; they determine behavior, variant, and quality.
- Traits are nouns/adjectives, not verbs.
- Traits never determine power level (that comes from skillLevel, rarity, workstation).
- Optionally, some traits may be revealed gradually (e.g. after 1 / 3 / 5 uses) for discovery gameplay.

### 4.2 Combination Rules
Experimentation (see **§7.0**) requires: ingredients, quantities, solvent, and process (temp + time).  
Within that framework, crafts use:
- Base material (component by family + traits)  
- Essence/Affinity (optional but influential)  
- Structural component (optional but enhances quality)  
- Solvent (water, oil, etc.) — distinct from ingredients  

**Family + traits** determine:
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
- one TYPE and one FAMILY per item (family defines identity)  
- traits that do not repeat type or family  
- consistent naming conventions  
- refined components must remain standardized  
- blueprints must contain a narrative hook  

This preserves system stability.

---

## 11. Architecture & Technical Decisions

### 11.1 Module Structure

Following Codex/Quest naming patterns:

```
scripts/
  ├── artificer.js                    (main entry point)
  ├── const.js                        (module constants)
  ├── settings.js                     (settings registration)
  ├── api-artificer.js                (module API exports)
  │
  ├── schema-*.js                     (JSDoc type definitions)
  ├── utility-artificer-item.js       (item creation, resolveItemByName)
  ├── utility-artificer-import.js     (JSON import)
  ├── utility-artificer-recipe-import.js
  │
  ├── cache/cache-items.js            (item cache: build, lookup, status)
  ├── data/models/                    (ArtificerIngredient, Component, Essence, Recipe, Blueprint)
  ├── data/storage/                   (IngredientStorage, RecipeStorage, BlueprintStorage)
  ├── parsers/                        (parser-recipe.js, parser-blueprint.js)
  ├── systems/                        (experimentation-engine.js, tag-manager.js)
  │
  ├── manager-*.js                    (facades over storage; refresh, getters)
  ├── panel-*.js                      (UI panels - ApplicationV2)
  ├── window-*.js                     (UI windows/forms - ApplicationV2)
  └── utils/helpers.js

resources/                             (JSON: translation-item.json, etc.)
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

### 11.7 Item Cache Strategy

The item cache provides fast name-based lookup for ingredients, recipe results, and containers. GM must click "Refresh Cache" to build it; this avoids implicit compendium scans on world load.

#### Current Behavior (In-Memory)
- Cache built on Refresh from configured compendia + world items
- Keyed by normalized name; alias mapping from `resources/translation-item.json` (alias → canonical)
- `getFromCache(name)` returns full Item; `getAllItemsFromCache()` returns Item[]
- IngredientStorage uses cache when available; otherwise notifies GM to build it

#### Target: Persisted Lightweight Cache

**Top-level document (persisted):**

| Field | Type | Description |
|-------|------|-------------|
| `schemaVersion` | `number` | Schema version for migrations (start at 1) |
| `lastBuilt` | `string` | ISO 8601 timestamp when cache was built |
| `compendiumIds` | `string[]` | Compendium IDs scanned (for cache validation) |
| `records` | `Object<string, CacheRecord>` | Map of `uuid` → lightweight record |

**Per-item record (`CacheRecord`):**

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Display name (canonical from source) |
| `uuid` | `string` | Item UUID for `fromUuid()` lookups |
| `img` | `string` | Image path |
| `type` | `string` | Foundry item type (e.g. `consumable`, `equipment`) |
| `dndType` | `string` | D&D consumable type (`potion`, `poison`, `scroll`, `oil`) from `system.type.subtype` |
| `family` | `string` | From `flags.artificer.family` or derived from `dndType` for consumables |
| `tags` | `string[]` | `[primaryTag, ...secondaryTags]` from flags |
| `tier` | `number` | From flags, default 1 |
| `rarity` | `string` | From flags (`Common`, `Very Rare`, etc.) |
| `source` | `string` | Compendium pack ID or `"world"` |
| `artificerType` | `string \| null` | `ingredient`, `component`, `essence`, `container`, or `null` |

**Index (in-memory only):** Built at load from `records` + `resources/translation-item.json`. Normalized name and all aliases → `uuid`. Translation format: `{ "alias (normalized)": "Canonical Name", ... }` (flat alias→canonical).

**Flow:** Refresh Cache → scan compendia + world → build records → persist. World load → read persisted records → build name index → optionally pre-fetch Items to warm in-memory cache. Lookup: index → uuid → `fromUuid(uuid)` for full Item.

**Storage:** World setting `game.settings.get(MODULE.ID, 'itemCache')` (scope: world, config: false). Same pattern as Bibliosoph Quick Encounter cache.

**Related:** `scripts/cache/cache-items.js`, `resources/translation-item.json`, `ingredientStorageSource`, `itemLookupOrder`.

---

### 11.8 UI Components

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
- **Decision:** D&D 5e (version 5.5+)
- **Rationale:** Primary target system for item structure and stats; 5.5+ for schema compatibility
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
- Resolve critical and important questions (Q1–Q11) ✅
- Phase 0: Foundation & Architecture Setup ✅
  - Folder structure (resources/, templates/)
  - Schema files, manager placeholders, module API
- Phase 1: Core Data System (major pieces) ✅
  - Core item creation utilities (`utility-artificer-item.js`)
  - Unified form (`window-artificer-item.js`), JSON import (`utility-artificer-import.js`)
  - Data models (Ingredient, Component, Essence, Recipe, Blueprint)
  - Storage managers (ingredients, recipes, blueprints) with configurable compendium mapping
  - TagManager
- Crafting Window ✅
  - Three-zone layout (ingredient list | bench | feedback)
  - Crafter portrait/name in header; "Results" → "Details"
  - Experimentation engine (tag-based rules)
  - Ingredient filtering (Artificer ingredients only), known combinations
  - Refresh Cache button
- Item cache (in-memory) ✅
  - GM-initiated refresh from compendia + world
  - Name-based lookup, alias support from `resources/translation-item.json`
  - IngredientStorage uses cache when available; otherwise notifies GM
- Settings: `itemLookupOrder`, `ingredientStorageSource`
- Rarity: Very Rare (D&D 5e standard; no "Epic")

### 🔄 In Progress
- **Persisted Item Cache:** Replace in-memory with persisted lightweight cache; integrate `translation-item.json`; D&D consumable → family mapping
- Recipe/Blueprint journal parser and browser (parsers exist; UI integration ongoing)
- Skill system, workstation system

### 📋 Next Steps
1. Persisted item cache (schema §11.7)
2. Implement §7.0 Experimentation Model: solvent selection, quantity inputs, temperature + time
3. Recipe/Blueprint browser UI
4. Skill levels, workstation modifiers

---

## 14. JSON Structures

### 14.1 Item JSON Structure

Items (Ingredients, Components, Essences) use a hybrid JSON structure:

**D&D 5e Item Fields:**
- Standard D&D 5e item structure (name, type, description, weight, price, rarity, etc.)
- Matches Blacksmith/FoundryVTT format for compatibility
- Item type depends on material (most ingredients = consumable, results match crafted type)

**Artificer Flags Section (target model after migration):**
```json
{
  "flags": {
    "artificer": {
      "type": "Component|Creation|Tool",
      "family": "string (depends on type: Plant|Mineral|CreaturePart|...|Potion|Apparatus|Container)",
      "traits": ["string"],
      "skillLevel": 1,
      "rarity": "Common|Uncommon|Rare|Very Rare|Legendary",
      "biomes": ["string"],
      "affinity": "Heat|Cold|Electric|..."
    }
  }
}
```

*Legacy (pre-migration):* Items may still use `primaryTag`, `secondaryTags`, `quirk`, and old `type` values (ingredient/component/essence/apparatus/container). The migration macro converts these to `type` + `family` + `traits`.

**Full JSON Template:**
- Combines D&D 5e item structure with `flags.artificer` section
- Supports both single items and arrays (for bulk import)
- Used by import utilities and can be generated by forms

### 14.2 Migration: Legacy → TYPE > FAMILY > TRAITS

Existing items (hundreds) use the old model: `type` (ingredient/component/essence/apparatus/container/tool), `family`, `primaryTag`, `secondaryTags`, `quirk`. A **one-time migration macro** is required.

**Mapping (macro logic):**
- Old `type` → new **TYPE**: ingredient/component/essence → Component; apparatus/container/tool → Tool; creations (if any) → Creation.
- **FAMILY**: Keep existing `family` where it fits the new family list; map legacy family names to new (e.g. Herbs → Plant, CreatureParts → Creature Part). For components without family, infer from `primaryTag` or `affinity`.
- **TRAITS**: Merge `primaryTag` (if not redundant with family), `secondaryTags`, and `quirk` (if present) into a single `traits` array. Dedupe and drop any value that equals the chosen family name.
- **Remove:** `primaryTag`, `secondaryTags`, `quirk` from flags after migration.
- **Idempotency:** Macro should only migrate items that still have legacy fields (e.g. `primaryTag` or `secondaryTags` present).
- **Backup:** Export or snapshot world items before running; recommend running on a copy first.

See **plan-artificer.md** for the migration macro task breakdown.

### 14.3 Future Schemas

(Previously 14.2.) Additional schemas to define:
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

## 16. Gaps, Open Items & Document Reconciliation

**This document is the canonical source** for architecture, decisions, and implementation status. Other docs (plan-artificer, overview, TODO) should align with it.

### 16.1 Gaps & Issues to Address

| Item | Description | Action |
|------|-------------|--------|
| **Custom ingredients in journals** | overview.md and storage-ingredients `_loadFromJournals` imply journal-based custom ingredients. Not implemented (TODO stub). | Decide: implement journal ingredient parsing, or remove from docs. |
| **D&D version** | Architecture says D&D 5e; user rules say 5.5+. | Explicitly target D&D 5e 5.5+ in §11 and schema docs. |
| **Persisted cache storage** | ✅ World setting `game.settings.get(MODULE.ID, 'itemCache')` (Bibliosoph/Blacksmith pattern). |
| **Experimentation §7.0** | Quantities, solvent, process (temp/time) are designed but not implemented. | Phase 2; tag-based matching works, full model is enhancement. |
| **Data model migration** | New hierarchy TYPE > FAMILY > TRAITS; primary/secondary/quirk removed. | One-time migration macro; see §14.2 and plan-artificer.md. |

### 16.2 Old/Outdated Decisions

- **Rarity "Epic"** — Replaced with "Very Rare" per D&D 5e; schema and docs updated.
- **Phase 1 "~60% complete"** — Many Phase 1 items are done (models, storage, TagManager, crafting window, cache); Item Creation UI and initial data set remain.

### 16.3 Related Documents

| Document | Purpose | Relationship |
|----------|---------|--------------|
| **architecture-artificer.md** | Canonical architecture, decisions, schema | **Source of truth** |
| **TODO.md** | Active task list, next steps | Tracks current focus; references architecture |
| **plan-artificer.md** | Phased breakdown (Phase 0–14), MVP path, technical notes | Merged from DEVELOPMENT_PLAN + IMPLEMENTATION_ROADMAP |
| **overview.md** | User-facing system explanation | Product/design; correct any storage/tier mismatches per §11.2 |
| **recipie-migration.md** | Recipe import schema | Reference for recipe structure |

### 16.4 Document Alignment Checklist

- [ ] overview.md Tier 2: Remove or clarify "Custom Ingredients (Journal Pages)" — journals are recipes/blueprints; ingredients are Items (compendium/world).
- [x] Consolidated DEVELOPMENT_PLAN and IMPLEMENTATION_ROADMAP into plan-artificer.md.
- [ ] Add `scripts/cache/` and `scripts/data/` to any doc that lists module structure.

---

## 17. Architecture Review (Alignment Check)

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

---

## Notes

- **architecture-artificer.md** is the canonical source for architecture and decisions.
- See `documentation/TODO.md` for current task focus.
- See `documentation/plan-artificer.md` for phased implementation detail.
- Architecture decisions based on Coffee Pub Codex and Quest systems.
- All patterns use FoundryVTT v13+ and ApplicationV2.
