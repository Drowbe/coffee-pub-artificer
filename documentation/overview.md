# Coffee Pub Artificer - System Explanation

> **For implementation:** Architecture, data storage, and technical decisions are in `documentation/architecture-artificer.md`. This document explains the system for users and designers.
>
> **Gathering design:** Discovery + Harvest flow and item-level difficulty are defined in `documentation/gathering-flow-design.md`.

## Overview: How the Crafting System Works

The Coffee Pub Artificer system is a **tag-based crafting system** that encourages experimentation and discovery. Players gather materials, combine them based on their tags, and create items through experimentation, recipes, or multi-stage blueprints.

---

## 🎯 The Core Loop

```
┌─────────────────────────────────────────────────────────────┐
│                    THE CRAFTING LOOP                         │
└─────────────────────────────────────────────────────────────┘

    [GATHERING]          [SALVAGE]          [EXPERIMENTATION]
         │                   │                      │
         ▼                   ▼                      ▼
    Raw Materials    →   Components    →    Crafted Items
         │                   │                      │
         └───────────────────┴──────────────────────┘
                            │
                            ▼
                    [RECIPES & BLUEPRINTS]
                            │
                            ▼
                    Advanced Crafting
```

**The Flow:**
1. **Gather** raw materials from the world
2. **Salvage** items to get components
3. **Experiment** by combining materials (tag-based)
4. **Use Recipes** for predictable crafting
5. **Follow Blueprints** for multi-stage, narrative items

---

## 📦 Item Data Hierarchy: TYPE > FAMILY > TRAITS

Every Artificer item is organized by a single hierarchy. **Family** is the identity; **traits** are modifiers (no separate "primary tag").

```
┌─────────────────────────────────────────────────────────────┐
│                    TYPE > FAMILY > TRAITS                   │
└─────────────────────────────────────────────────────────────┘

TYPE: Component | Creation | Tool

COMPONENTS (gathered, harvested, or refined inputs)
├── Family: Plant      → Traits: Floral, Medicinal, Toxic, Arcane, ...
├── Family: Mineral    → Traits: Ore, Alloy-Friendly, Dense, ...
├── Family: Gem        → Traits: Resonant, Arcane, Brilliant, ...
├── Family: Creature Part → Traits: Bone, Venom, Scale, ...
├── Family: Environmental → Traits: Water, Fire, Earth, Air, ...
└── Family: Essence    → Traits: Heat, Cold, Electric, Life, Shadow, ...

CREATIONS (results of recipes/blueprints)
├── Family: Food, Material, Poison, Potion
└── Traits from combined components

TOOLS (used for crafting)
├── Family: Apparatus (beaker, mortar)
└── Family: Container (vial, herb bag)

        │
        ▼ (Craft)

FINISHED ITEMS (Creations)
├── Weapons, Armor
├── Consumables (Potions, Food, etc.)
├── Tools, Arcane Devices
└── ...
```

---

## 🏷️ Family & Traits: The Heart of Crafting

### How It Works

Each item has a **TYPE**, a **FAMILY** (identity), and **TRAITS** (modifiers). Traits don’t repeat the family name.

```
┌─────────────────────────────────────────────────────────────┐
│                    FAMILY + TRAITS                           │
└─────────────────────────────────────────────────────────────┘

COMPONENT: Lavender
├── Type: Component
├── Family: Plant
└── Traits: Floral, Medicinal, Soothing

COMPONENT: Iron Ore
├── Type: Component
├── Family: Mineral
└── Traits: Ore, Alloy-Friendly

COMPONENT: Life Essence
├── Type: Component
├── Family: Essence
└── Traits: Life, Light, Healing
```

### Trait Discovery (Optional)

Traits can be revealed gradually (e.g. after 1, 3, or 5 uses) so players discover what an ingredient does over time. That’s configured per trait or globally; the data model is just “traits” (no separate quirk field).

---

## 🔬 Experimentation: Family + Trait Crafting

### How Experimentation Works

Players combine **up to 3 components** and the system uses **family + traits** to determine the result:

```
┌─────────────────────────────────────────────────────────────┐
│              EXPERIMENTATION FLOW                            │
└─────────────────────────────────────────────────────────────┘

Step 1: Player Selects Ingredients
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │  Lavender   │  │ Life Essence│  │  (empty)    │
    │ [Herb]      │  │ [Life]      │  │             │
    │ [Floral]    │  │ [Light]     │  │             │
    │ [Medicinal] │  │ [Healing]   │  │             │
    └─────────────┘  └─────────────┘  └─────────────┘

Step 2: System Analyzes Family + Traits
    Collect family and traits: Plant + Floral, Medicinal; Essence + Life, Light, Healing
    └─ Match against combination rules

Step 3: Determine Result
    Family + traits suggest: Consumable + Healing + Life
    └─ Result: Healing Potion (or variant)

Step 4: Calculate Quality
    Based on:
    - Player skill level
    - Workstation quality
    - Ingredient tier/rarity
    └─ Quality: Good/Excellent/Masterwork

Step 5: Create Item
    └─ Add to player inventory
```

### Family + Trait Combination Logic

```
┌─────────────────────────────────────────────────────────────┐
│              COMBINATION RULES                               │
└─────────────────────────────────────────────────────────────┘

FAMILY (identity)
    Determines: Broad item category
    Examples:
    - Mineral + Ore trait → Weapon
    - Plant + Medicinal trait → Consumable
    - Gem + Arcane trait → Arcane Device

ESSENCE/AFFINITY (Optional)
    Determines: Elemental properties, magical effects
    Examples:
    - Life Essence → Healing properties
    - Fire Essence → Fire damage
    - Shadow Essence → Stealth properties

STRUCTURAL COMPONENT (Optional)
    Enhances: Quality, stability, durability
    Examples:
    - Haft Core → Better weapon grip
    - Binding → More stable crafting
    - Plate → Armor reinforcement

RESULT DETERMINATION:
    ┌─────────────────────────────────────┐
    │ 1. Match family + traits to patterns  │
    │ 2. Determine item type                │
    │ 3. Apply essence effects              │
    │ 4. Calculate quality                  │
    │ 5. Generate item stats                │
    │ 6. If no match → Create "Sludge"      │
    │    (never fails completely)           │
    └─────────────────────────────────────┘
```

### Example: Experimentation in Action

```
┌─────────────────────────────────────────────────────────────┐
│              EXAMPLE: CREATING A HEALING POTION               │
└─────────────────────────────────────────────────────────────┘

Player Combines:
    Component 1: Lavender
        Family: Plant | Traits: Floral, Medicinal
    
    Component 2: Life Essence
        Family: Essence | Traits: Life, Light, Healing

System Analysis:
    ┌─────────────────────────────────────┐
    │ Family + Trait Match:                │
    │ - Plant + Medicinal → Consumable     │
    │ - Life + Healing → Healing effect   │
    │ - Floral → Potion variant            │
    │                                      │
    │ Result: Healing Potion               │
    │ Quality: Good (based on skill)      │
    └─────────────────────────────────────┘

Outcome:
    ✅ Created: "Floral Healing Potion"
    ✅ Restores 2d4+2 HP
    ✅ Player gains XP in Alchemy skill
    ✅ Trait discovery progress on Lavender
```

---

## 📜 Recipe System: Predictable Crafting

### How Recipes Work

Recipes are **structured instructions** stored in journal entries. They provide **predictable outcomes** with **benefits** over experimentation.

```
┌─────────────────────────────────────────────────────────────┐
│              RECIPE SYSTEM FLOW                              │
└─────────────────────────────────────────────────────────────┘

RECIPE: Healing Potion
├── Stored in: "Artificer Recipes" Journal
├── Format: HTML with structured fields
├── Requirements:
│   ├── Skill: Alchemy (Level 25)
│   ├── Workstation: Alchemist Table
│   └── Ingredients:
│       ├── Lavender (2)
│       └── Life Essence (1)
└── Benefits:
    ├── Reduced material cost (vs experimentation)
    ├── Quality bonus (+10%)
    └── Guaranteed variant unlock

CRAFTING FLOW:
    [Player selects recipe]
         │
         ▼
    [System validates requirements]
         │
         ├─ Has materials? ──NO──→ [Show missing items]
         ├─ Has skill? ─────NO──→ [Show skill requirement]
         ├─ Has workstation? ─NO──→ [Show workstation needed]
         │
         └─YES──→ [Craft item]
                      │
                      ▼
              [Apply recipe benefits]
                      │
                      ▼
              [Create item with bonus quality]
                      │
                      ▼
              [Add to inventory]
```

### Recipe vs Experimentation

```
┌─────────────────────────────────────────────────────────────┐
│         RECIPE vs EXPERIMENTATION COMPARISON                 │
└─────────────────────────────────────────────────────────────┘

EXPERIMENTATION:
    Pros:
    ✅ No recipe needed
    ✅ Discover new combinations
    ✅ Tag discovery progress
    ✅ Surprise results
    
    Cons:
    ❌ Unpredictable outcome
    ❌ May create "sludge"
    ❌ Higher material cost
    ❌ Lower quality potential

RECIPE:
    Pros:
    ✅ Predictable outcome
    ✅ Reduced material cost
    ✅ Quality bonus
    ✅ Guaranteed variant
    
    Cons:
    ❌ Must unlock recipe first
    ❌ Requires specific materials
    ❌ May need specific workstation
    ❌ Skill requirements
```

---

## 🗺️ Blueprint System: Multi-Stage Crafting

### How Blueprints Work

Blueprints are **multi-stage, narrative-driven** crafting projects. They represent **aspirational items** tied to story arcs.

```
┌─────────────────────────────────────────────────────────────┐
│              BLUEPRINT SYSTEM FLOW                            │
└─────────────────────────────────────────────────────────────┘

BLUEPRINT: The Arcanic Wayfinder
├── Stored in: "Artificer Blueprints" Journal
├── Narrative Hook: "Discovered in ancient wizard's tower..."
├── Requirements:
│   ├── Skill: Artifice (Level 75)
│   ├── Workstation: Arcane Workbench
│   └── Stages:
│       ├── Stage 1: Gather Core Components
│       │   └── Requires: [Iron Ingot (3), Arcane Crystal (1)]
│       │
│       ├── Stage 2: Infuse with Arcane Essence
│       │   └── Requires: [Arcane Essence (2), Mana Thread (1)]
│       │
│       ├── Stage 3: Assemble the Mechanism
│       │   └── Requires: [Completed Stage 1, Completed Stage 2]
│       │
│       └── Stage 4: Final Enchantment
│           └── Requires: [All previous stages, Legendary Essence (1)]
│
└── Result: Arcanic Wayfinder (Legendary Artifact)

STAGE PROGRESSION:
    [Stage 1: Active] ──Complete──→ [Stage 1: ✓]
                                         │
                                         ▼
                            [Stage 2: Active] ──Complete──→ [Stage 2: ✓]
                                                                    │
                                                                    ▼
                                                    [Stage 3: Active] ──...
```

### Blueprint State Tracking

```
┌─────────────────────────────────────────────────────────────┐
│         BLUEPRINT STATE MARKERS (HTML)                        │
└─────────────────────────────────────────────────────────────┘

In Journal Entry:
    <ul>
        <li><p>Stage 1: Gather Components</p></li>          ← Active
        <li><p><s>Stage 2: Infuse Essence</s></p></li>     ← Completed
        <li><p><code>Stage 3: Assembly</code></p></li>     ← Failed
        <li><p><em>Stage 4: Hidden Stage</em></p></li>     ← Hidden (GM only)
    </ul>

State Detection:
    - Plain text → Active stage
    - <s> or <del> → Completed stage
    - <code> → Failed stage
    - <em> or <i> → Hidden stage (GM-only)
```

---

## 🎮 Complete Player Workflow

### Example: Player Journey

```
┌─────────────────────────────────────────────────────────────┐
│              COMPLETE PLAYER WORKFLOW                        │
└─────────────────────────────────────────────────────────────┘

SESSION 1: Discovery
    ┌─────────────────────────────────────┐
    │ Player finds gathering node         │
    │ └─ Clicks sparkle on map            │
    │ └─ Plays mini-game                  │
    │ └─ Receives: Lavender (x2)          │
    │                                      │
    │ Player experiments:                │
    │ └─ Combines: Lavender + ???         │
    │ └─ Discovers: Family Plant + traits │
    │ └─ Creates: Basic Herb Potion       │
    └─────────────────────────────────────┘

SESSION 2: Learning
    ┌─────────────────────────────────────┐
    │ Player uses Lavender 3 more times   │
    │ └─ Discovers: traits Floral, Medicinal │
    │                                      │
    │ Player finds recipe in book:        │
    │ └─ "Healing Potion" recipe          │
    │ └─ Unlocks recipe                   │
    │ └─ Crafts using recipe              │
    │ └─ Gets quality bonus               │
    └─────────────────────────────────────┘

SESSION 3: Mastery
    ┌─────────────────────────────────────┐
    │ Player uses Lavender 5+ times       │
    │ └─ Discovers: trait Soothing        │
    │                                      │
    │ Player finds blueprint:            │
    │ └─ "The Arcanic Wayfinder"          │
    │ └─ Begins multi-stage crafting      │
    │ └─ Completes Stage 1                │
    │ └─ Progresses to Stage 2            │
    └─────────────────────────────────────┘
```

---

## 🔄 Data Flow & Storage

### How Data Moves Through the System

```
┌─────────────────────────────────────────────────────────────┐
│              DATA FLOW DIAGRAM                               │
└─────────────────────────────────────────────────────────────┘

STORAGE LAYERS:

TIER 1: Master Data (Compendium Packs)
    ┌─────────────────────────────────────┐
    │ Ingredients (Items)                 │
    │ Components (Items)                   │
    │ Essences (Items)                     │
    │                                      │
    │ Fast lookup, performance            │
    │ Easy sharing/expansion               │
    └─────────────────────────────────────┘
              │
              ▼ (Aggregated with)
              │
TIER 2: World Content (Journals)
    ┌─────────────────────────────────────┐
    │ Recipes (Journal Pages)             │
    │ Blueprints (Journal Pages)          │
    │                                      │
    │ Human-editable HTML                 │
    │ Parser-based architecture           │
    │ Built-in permissions                │
    │                                      │
    │ Note: Ingredients are Items         │
    │ (compendium + world), not journals  │
    └─────────────────────────────────────┘
              │
              ▼ (Parsed into)
              │
TIER 3: Player Data (Actor Flags)
    ┌─────────────────────────────────────┐
    │ Skills (Herbalism, Alchemy, etc.)    │
    │ Tag Discoveries (per ingredient)     │
    │ Blueprint Progress (per blueprint)   │
    │ Unlocked Recipes                     │
    │                                      │
    │ Per-actor, changes frequently        │
    └─────────────────────────────────────┘
              │
              ▼ (Used by)
              │
TIER 4: World/Scene Data (Flags)
    ┌─────────────────────────────────────┐
    │ Workstations (Scene flags)          │
    │ Gathering Nodes (Scene flags)       │
    │ Biome Data (Scene flags)            │
    │                                      │
    │ Spatial configuration               │
    └─────────────────────────────────────┘
```

### Ingredient Loading (Hybrid Approach)

```
┌─────────────────────────────────────────────────────────────┐
│         INGREDIENT STORAGE: HYBRID APPROACH                 │
└─────────────────────────────────────────────────────────────┘

When System Needs Ingredients:

    ┌─────────────────────┐
    │ Load from           │
    │ Compendium Packs    │
    └──────────┬──────────┘
               │
               ├─→ [Default Ingredients]
               │   └─ Fast, shared content
               │
    ┌──────────▼──────────┐
    │ Load from           │
    │ Journals            │
    └──────────┬──────────┘
               │
               ├─→ [Custom Ingredients]
               │   └─ World-specific, GM-created
               │
    ┌──────────▼──────────┐
    │ Aggregate & Cache   │
    └──────────┬──────────┘
               │
               ▼
    [Unified Ingredient Collection]
    └─ Used by crafting system
```

---

## 🎯 Skill System

### How Skills Work

```
┌─────────────────────────────────────────────────────────────┐
│                    SKILL PROGRESSION                         │
└─────────────────────────────────────────────────────────────┘

SKILL CATEGORIES:
    - Herbalism (plant-based crafting)
    - Metallurgy (metal crafting)
    - Artifice (mechanical crafting)
    - Alchemy (potion crafting)
    - Monster Handling (creature parts)

SKILL GAIN:
    ┌─────────────────────────────────────┐
    │ Successful crafting                 │
    │ └─ Base XP                          │
    │                                      │
    │ Quality results                     │
    │ └─ Higher quality = more XP         │
    │                                      │
    │ Tag discoveries                      │
    │ └─ Discovering tags gives XP       │
    │                                      │
    │ Gathering mini-game success         │
    │ └─ Successful gathering = XP       │
    │                                      │
    │ Salvaging rare items                │
    │ └─ Rare salvage = bonus XP         │
    └─────────────────────────────────────┘

SKILL GATING:
    Recipe requires: Alchemy 25
    └─ Player has: Alchemy 20
    └─ Result: Recipe is LOCKED
    
    Recipe requires: Alchemy 25
    └─ Player has: Alchemy 30
    └─ Result: Recipe is AVAILABLE
```

---

## 🏭 Workstation System

### How Workstations Influence Crafting

```
┌─────────────────────────────────────────────────────────────┐
│              WORKSTATION EFFECTS                            │
└─────────────────────────────────────────────────────────────┘

WORKSTATION: Alchemist Table
├── Quality Modifier: +15%
├── Stability Bonus: +10%
├── Recipe Unlock Chance: +5%
└── Essence Synergy: +20%

CRAFTING WITH WORKSTATION:
    Base Quality: 60%
    + Workstation Bonus: +15%
    + Skill Bonus: +10% (from Alchemy 50)
    └─ Final Quality: 85% (Excellent)

CRAFTING WITHOUT WORKSTATION:
    Base Quality: 60%
    + Skill Bonus: +10%
    └─ Final Quality: 70% (Good)
```

---

## 🎨 Visual: Complete Crafting Flow

```
┌─────────────────────────────────────────────────────────────┐
│              COMPLETE CRAFTING FLOWCHART                     │
└─────────────────────────────────────────────────────────────┘

                    [PLAYER OPENS CRAFTING UI]
                              │
                              ▼
                    ┌─────────────────────┐
                    │ Choose Method:      │
                    │ 1. Experiment       │
                    │ 2. Recipe           │
                    │ 3. Blueprint        │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
   [EXPERIMENT]          [RECIPE]              [BLUEPRINT]
        │                      │                      │
        │              ┌───────┴───────┐             │
        │              │               │             │
        │         [Select Recipe]  [Validate]       │
        │              │               │             │
        │              └───────┬───────┘             │
        │                      │                     │
        │              ┌────────▼────────┐            │
        │              │ Has Materials? │            │
        │              │ Has Skill?     │            │
        │              │ Has Station?   │            │
        │              └────────┬────────┘            │
        │                       │                     │
        │              ┌────────▼────────┐            │
        │              │ Select Stage    │            │
        │              └────────┬────────┘            │
        │                       │                     │
        ▼                       ▼                     ▼
   [Select 1-3          [Select Ingredients]    [Select Stage
    Ingredients]                │                  Materials]
        │                       │                     │
        ▼                       ▼                     ▼
   [Tag Analysis]        [Apply Recipe Logic]    [Complete Stage]
        │                       │                     │
        ▼                       ▼                     ▼
   [Generate Item]       [Create Item with      [Progress to
        │                  Quality Bonus]         Next Stage]
        │                       │                     │
        └───────────────────────┼─────────────────────┘
                                │
                                ▼
                    [Calculate Quality]
                                │
                                ▼
                    [Apply Workstation Bonus]
                                │
                                ▼
                    [Apply Skill Bonus]
                                │
                                ▼
                    [Create FoundryVTT Item]
                                │
                                ▼
                    [Add to Actor Inventory]
                                │
                                ▼
                    [Update Skills & Discoveries]
                                │
                                ▼
                    [Show Notification]
                                │
                                ▼
                            [DONE]
```

---

## 📊 Example: Complete Crafting Session

### Scenario: Player Wants to Create a Healing Potion

```
┌─────────────────────────────────────────────────────────────┐
│         EXAMPLE: COMPLETE CRAFTING SESSION                   │
└─────────────────────────────────────────────────────────────┘

STEP 1: Gathering
    Player explores forest
    └─ Finds gathering node (sparkle on map)
    └─ Clicks node → Mini-game appears
    └─ Success! → Receives: Lavender (x3)

STEP 2: Discovery
    Player opens crafting UI
    └─ Selects "Experimentation"
    └─ Drags Lavender to slot 1
    └─ Drags Life Essence to slot 2
    └─ Clicks "Craft"
    
    System:
    ├─ Analyzes tags: [Herb, Floral, Medicinal] + [Life, Light, Healing]
    ├─ Matches pattern: Consumable + Healing
    ├─ Creates: "Healing Potion"
    ├─ Quality: Good (skill 20, no workstation)
    └─ Player discovers: Lavender's "Herb" tag (1st use)

STEP 3: Recipe Discovery
    Player finds book in dungeon
    └─ Reads "Alchemist's Primer"
    └─ Unlocks: "Healing Potion" recipe
    └─ Recipe shows: Exact ingredients, skill requirement, workstation

STEP 4: Recipe Crafting
    Player opens crafting UI
    └─ Selects "Recipes" tab
    └─ Finds "Healing Potion" (now unlocked)
    └─ Clicks "Craft from Recipe"
    
    System:
    ├─ Validates: Has Lavender (2)? ✓
    ├─ Validates: Has Life Essence (1)? ✓
    ├─ Validates: Alchemy skill 25? ✓ (player has 30)
    ├─ Validates: Alchemist Table? ✓ (at workstation)
    ├─ Applies recipe benefits:
    │  ├─ Reduced cost (saves 1 Lavender)
    │  ├─ Quality bonus (+10%)
    │  └─ Guaranteed variant
    ├─ Creates: "Superior Healing Potion" (better than experiment)
    └─ Player gains: Alchemy XP, recipe mastery progress

STEP 5: Blueprint Discovery
    Player completes quest
    └─ Receives: "Blueprint: The Arcanic Wayfinder"
    └─ Opens Blueprint panel
    └─ Sees 4-stage project
    └─ Begins Stage 1: Gather Core Components
```

---

## 🔍 Key Concepts Summary

### 1. **Family + Traits Drive Crafting**
   - Family and traits determine what you can craft
   - Traits can reveal gradually (encourages experimentation)
   - Family + traits create predictable patterns (no spreadsheets needed)

### 2. **Three Crafting Methods**
   - **Experimentation**: Free-form, discover new things
   - **Recipes**: Predictable, efficient, requires unlocking
   - **Blueprints**: Multi-stage, narrative-driven, aspirational

### 3. **Progressive Discovery**
   - Start with unknown components
   - Discover traits (and family) through use
   - Unlock recipes through exploration
   - Complete blueprints through dedication

### 4. **Skill-Based Progression**
   - Skills gate advanced content
   - Skills improve through crafting
   - Higher skills = better results

### 5. **Workstations Matter**
   - Different workstations for different crafts
   - Workstations provide quality bonuses
   - Some recipes require specific workstations

---

## 🎮 Player Experience Flow

```
┌─────────────────────────────────────────────────────────────┐
│              PLAYER EXPERIENCE JOURNEY                      │
└─────────────────────────────────────────────────────────────┘

NEW PLAYER:
    ┌─────────────────────────────────────┐
    │ 1. Finds unknown ingredient         │
    │ 2. Experiments blindly              │
    │ 3. Discovers family + traits          │
    │ 4. Creates first item                 │
    │ 5. Learns: "Family + traits matter!" │
    └─────────────────────────────────────┘

EXPERIENCED PLAYER:
    ┌─────────────────────────────────────┐
    │ 1. Knows component family + traits   │
    │ 2. Plans combinations               │
    │ 3. Uses recipes for efficiency      │
    │ 4. Works on blueprints               │
    │ 5. Masters crafting system          │
    └─────────────────────────────────────┘

MASTER CRAFTER:
    ┌─────────────────────────────────────┐
    │ 1. Creates custom ingredients       │
    │ 2. Discovers new combinations        │
    │ 3. Completes legendary blueprints    │
    │ 4. Shares knowledge with party      │
    │ 5. Becomes crafting expert          │
    └─────────────────────────────────────┘
```

---

## 💡 Design Philosophy

**Why This System Works:**

1. **No Spreadsheets Needed**
   - Family + traits are intuitive (Plant + Medicinal = Potion)
   - Patterns emerge naturally
   - No need to look up tables

2. **Encourages Exploration**
   - Unknown ingredients create mystery
   - Trait discovery rewards experimentation
   - Recipes found in world (books, NPCs, dungeons)

3. **Scales with Player**
   - New players: Simple experimentation
   - Experienced: Recipe-based efficiency
   - Masters: Complex blueprints

4. **Narrative Integration**
   - Blueprints tied to story
   - Recipes found in world
   - Gathering encourages travel

5. **Community Friendly**
   - Clear family + trait conventions
   - Easy to add content
   - Expandable system

---

This system creates a **fun, tactile, exploration-driven crafting loop** that rewards curiosity and experimentation while providing structure for players who prefer predictability.
