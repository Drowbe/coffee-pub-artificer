# Quest System Patterns Analysis for Artificer

## Overview

After reviewing the Quest system architecture from Coffee Pub Squire, several additional patterns emerge that could enhance the Artificer crafting system. This document analyzes which Quest patterns apply and how they could be adapted.

---

## Key Quest Patterns & Their Applicability

### 1. **State-Based Markup in HTML** ✅ Highly Applicable for Blueprints

**Quest Approach:**
- Uses HTML markup to represent task states:
  - `<s>`, `<del>`, `<strike>`: Completed tasks
  - `<code>`: Failed tasks
  - `<em>` or `<i>`: Hidden tasks (GM-only)
  - Plain text: Active tasks

**Application to Artificer:**

#### ✅ Perfect Fit: Blueprint Stages
Blueprints are multi-stage crafting projects. Each stage could use HTML markup to represent completion state:

```html
<p><strong>Blueprint Name:</strong> Arcanic Wayfinder</p>
<p><strong>Status:</strong> In Progress</p>
<p><strong>Stages:</strong></p>
<ul>
  <li>Gather Moonstone Fragment</li>
  <li><s>Craft Silver Frame</s></li>
  <li>Infuse with Essence of Light</li>
  <li><em>Secret Stage: Add Temporal Essence</em></li>
</ul>
```

**Benefits:**
- Visual state representation in journal
- Parser can extract stage completion status
- Easy to toggle completion (wrap/unwrap tags)
- No separate flags needed for stage state
- GMs can edit directly and see progress visually

#### ⚠️ Partial Fit: Recipe Requirements
Could use similar markup for optional/required ingredients:
- Required ingredients: Plain text
- Optional ingredients: `<em>Optional: ...</em>`
- Alternative ingredients: `<code>Alternative: ...</code>`

---

### 2. **Hash-Based Numbering System** ✅ Applicable for Recipes/Blueprints

**Quest Approach:**
- Generates consistent quest numbers from UUIDs using hash function
- Provides Q1-Q100 numbering automatically
- No database needed, calculated on-demand

**Application to Artificer:**

#### Recipe/Blueprint Numbering
- **Recipes**: R1, R2, R3... (Recipe 1, Recipe 2, etc.)
- **Blueprints**: B1, B2, B3... (Blueprint 1, Blueprint 2, etc.)
- Or combined: RB1.01, RB1.02 for multi-stage blueprints

**Benefits:**
- Easy reference: "Craft R42" instead of full name
- Consistent numbering (same UUID = same number)
- No sequential ID management needed
- Can be displayed in UI for quick reference

**Use Cases:**
- Recipe/Blueprint browser with numbered entries
- Quick reference in chat/logs
- Pin labels (if using canvas pins for workstations/recipes)

---

### 3. **Scene Pin Integration** ✅ Highly Applicable for Workstations & Gathering

**Quest Approach:**
- PIXI-based visual pins on canvas
- Interactive (drag, click, right-click)
- Visual state representation
- Position persistence via scene flags

**Application to Artificer:**

#### Workstation Pins
- **Workstation pins** on canvas (Smithy, Alchemist Table, etc.)
- Visual representation of crafting locations
- Click to open crafting interface at that workstation
- Different icons for different workstation types
- Color/state based on availability or upgrade level

#### Gathering Node Pins
- **Gathering node pins** on canvas
- Represent material gathering locations
- Visual indicators for:
  - Material type (icon/color)
  - Rarity (visual intensity/glow)
  - Availability (sparkle/wiggle animation)
  - Respawn status (filled vs. empty)
- Click to interact/gather
- Hot/cold proximity indicators

**Implementation Considerations:**
- Store pin positions in scene flags (like Quest system)
- Use PIXI containers for pins
- Support drag & drop for GM placement
- Interactive clicks for players
- State synchronization (gathering nodes respawn, workstation availability)

---

### 4. **Progress Calculation from State** ✅ Applicable for Blueprints

**Quest Approach:**
- Calculates quest progress dynamically from task completion ratio
- Status determined from task states (In Progress, Complete, Failed)
- Progress bars based on completed/total tasks

**Application to Artificer:**

#### Blueprint Progress
- Calculate blueprint completion from stage completion
- Progress bar: "3 of 5 stages complete"
- Status: "In Progress", "Complete", "Failed"
- Derived automatically from HTML markup (no separate tracking)

#### Recipe Mastery Progress
- Track recipe usage/failures for progression
- Calculate mastery level from success rate
- Progress bar for recipe mastery

---

### 5. **Export/Import System with Scene Data** ✅ Applicable for Community Content

**Quest Approach:**
- Exports quests + scene pins together
- Smart merging on import (updates existing, creates new)
- Preserves state and progress
- Scene pin restoration on matching scenes

**Application to Artificer:**

#### Recipe/Blueprint Export/Import
- Export recipes as journal compendiums
- Export workstations with scene pin data
- Export gathering node configurations with scene pin data
- Import with smart merging
- Community recipe packs with scene setup data

**Export Format Structure:**
```json
{
  "recipes": [...],
  "blueprints": [...],
  "workstations": {
    "sceneId1": {
      "sceneName": "Town",
      "pins": [...]
    }
  },
  "gatheringNodes": {
    "sceneId1": {
      "sceneName": "Forest",
      "nodes": [...]
    }
  },
  "exportVersion": "1.0",
  "timestamp": "..."
}
```

---

### 6. **Status-Based Organization** ✅ Applicable for Recipe/Blueprint Browsing

**Quest Approach:**
- Groups quests by status (In Progress, Not Started, Complete, Failed)
- Automatic status determination from task states
- Status sections in UI

**Application to Artificer:**

#### Recipe Browser Organization
- **Available**: Recipes player can craft (skill/workstation met)
- **Unlocked**: Recipes player has discovered/unlocked
- **Locked**: Recipes not yet discovered
- **Mastered**: Recipes player has crafted multiple times

#### Blueprint Organization
- **In Progress**: Blueprints with stages completed
- **Not Started**: Available but not begun
- **Complete**: Fully completed blueprints
- **Failed**: Blueprints with failed stages

---

### 7. **Participant/Treasure Linking** ⚠️ Potentially Applicable

**Quest Approach:**
- Links quests to actors (participants)
- Links to treasure items via UUID
- Extracts UUID links from HTML content

**Application to Artificer:**

#### Recipe Result Linking
- Link recipes to result items via UUID
- Auto-populate result item data when creating recipes
- Link recipes to source materials (ingredients) via UUID
- Link recipes to workstations via UUID (if workstations are actors/items)

#### Blueprint Reward Linking
- Link blueprints to reward items
- Link to narrative quests (integration with Quest system)
- Link to unlockable recipes

---

### 8. **GM Hints & Hidden Content** ✅ Applicable

**Quest Approach:**
- Uses `||text||` for GM-only hints in tasks
- Uses `<em>` or `<i>` for hidden tasks
- Parser extracts and separates GM content

**Application to Artificer:**

#### Recipe Secrets
- GM notes in recipes: `||Note: This recipe unlocks at level 5||`
- Hidden alternative ingredients: `<em>Secret Ingredient: ...</em>`
- GM-only blueprint stages

#### Crafting Tips
- GM hints for experimentation: `||Try combining with Fire Essence||`
- Hidden tag combinations
- GM notes on ingredient sources

---

### 9. **Objective-Level Pins** ✅ Applicable for Blueprint Stages

**Quest Approach:**
- Quest-level pins (whole quest)
- Objective-level pins (individual objectives)
- Combined numbering (Q1.01, Q1.02)
- Different visual styles for different pin types

**Application to Artificer:**

#### Blueprint Stage Pins
- Blueprint-level pin (entire blueprint)
- Stage-level pins (individual stages)
- Combined numbering (B1.01, B1.02, B1.03)
- Visual progression as stages complete
- Click stage pin to see what materials needed

#### Recipe Material Pins
- Pin locations where specific ingredients can be gathered
- Link recipe ingredients to gathering node pins
- Visual connection between recipe and gathering locations

---

### 10. **Notification Integration** ✅ Applicable

**Quest Approach:**
- Integrates with Coffee Pub Blacksmith for notifications
- Notifies on quest completion, task completion
- Visual feedback for state changes

**Application to Artificer:**

#### Crafting Notifications
- "Recipe discovered: Healing Potion"
- "Blueprint stage complete: Arcanic Wayfinder Stage 2/5"
- "Tag discovered: Fire (on Lavender - 3 uses)"
- "Skill increased: Alchemy Level 5"
- "Crafting failed - ingredients consumed"
- "Crafting success! Quality: Exceptional"

---

### 11. **Dynamic Status Calculation** ✅ Highly Applicable

**Quest Approach:**
- Status calculated dynamically from task states
- No separate status field stored
- Status updates automatically as tasks change

**Application to Artificer:**

#### Blueprint Status
- **Not Started**: No stages completed
- **In Progress**: Some stages completed, not all
- **Complete**: All stages completed
- **Failed**: Failed stage present (if failure is possible)
- **Blocked**: Missing requirements (skill, materials, workstation)

#### Recipe Availability Status
- **Available**: Can craft now (skill, materials, workstation met)
- **Locked**: Missing requirements
- **Unlocked**: Discovered but not yet craftable
- **Mastered**: High success rate / many uses

---

### 12. **UUID Storage in Flags** ✅ Applicable

**Quest Approach:**
- Stores quest UUID in page flags for tracking
- Links between journal pages and system data
- Enables tracking without database

**Application to Artificer:**

#### Recipe/Blueprint Tracking
- Store recipe UUID in page flags
- Link journal pages to crafted items
- Track which recipes/blueprints player has unlocked
- Link gathering nodes to ingredient UUIDs

---

## Revised Architecture Considerations

### Blueprint Implementation Using Quest Patterns

Blueprints could use almost the exact same patterns as Quests:

1. **Journal Storage**: Blueprints as journal pages (structured HTML)
2. **Stage Markup**: Stages as HTML list with state markup (`<s>` for complete, etc.)
3. **Parser**: BlueprintParser similar to QuestParser
4. **Panel**: BlueprintPanel with status-based organization
5. **Pins**: Blueprint pins on canvas (blueprint-level and stage-level)
6. **Progress**: Calculated from stage completion
7. **Status**: Determined dynamically from stages

**Key Difference:**
- Blueprints have **crafting requirements** (materials, skill, workstation)
- Blueprints have **staged crafting** (each stage produces intermediate result)
- Blueprints may have **failure states** (if crafting fails, stage fails)

### Workstation Implementation Using Quest Pin Patterns

Workstations could use PIXI pins similar to Quest pins:

1. **Scene Pins**: Workstation pins placed on canvas
2. **Visual States**: Different appearance based on availability/upgrade
3. **Interactive**: Click to open crafting interface
4. **Persistence**: Positions stored in scene flags
5. **Types**: Different icons for different workstation types

### Gathering Node Implementation

Gathering nodes could also use PIXI pins:

1. **Scene Pins**: Gathering node pins on canvas
2. **Visual States**: 
   - Material type (icon/color)
   - Rarity (glow/intensity)
   - Availability (animation)
   - Respawn timer (visual indicator)
3. **Interactive**: Click to gather (trigger mini-game or direct gathering)
4. **Proximity**: Hot/cold indicators when player token nearby
5. **Persistence**: Node states and positions in scene flags

---

## Questions to Resolve (Updated List)

### Data Storage Questions

1. **Ingredient Storage:** Compendium Packs or Journals?
   - Recommendation: Compendium Packs (performance)
   - Alternative: Journals (flexibility)

2. **Recipe Storage:** Single journal or multiple?
   - Single "Artificer Recipes" journal?
   - Multiple journals by category?
   - Default journal or user-selectable?

3. **Blueprint Storage:** Same journal as recipes or separate?
   - Combined journal (recipes + blueprints)?
   - Separate journals?
   - How to differentiate in parser?

4. **Workstation Storage:** 
   - As journal entries (like recipes)?
   - As scene flags only?
   - As compendium entries?

5. **Gathering Node Storage:**
   - Scene flags only (positions and states)?
   - Or also journal entries (node definitions)?

### Pin & Canvas Questions

6. **Workstation Pins:** Should workstations be placed on canvas?
   - Canvas-based (like Quest pins)?
   - Or abstract menu selection?
   - Or both options?

7. **Gathering Node Pins:** Should gathering be canvas-based?
   - Canvas-based (click nodes on map)?
   - Or abstract menu-based?
   - Or both options?

8. **Pin Types:** What pin types do we need?
   - Workstation pins
   - Gathering node pins
   - Recipe/Blueprint pins (optional)?
   - Material location pins (link ingredients to nodes)?

9. **Pin Interactions:** What interactions should pins support?
   - Click to interact?
   - Drag to reposition (GM only)?
   - Right-click menus?
   - Tooltips?

### Blueprint Questions

10. **Blueprint Stages:** How to handle multi-stage crafting?
    - Each stage requires separate crafting action?
    - Or stages auto-progress when materials available?
    - Can stages fail independently?

11. **Blueprint State:** Should blueprint state use HTML markup (like Quest tasks)?
    - `<s>` for completed stages?
    - `<code>` for failed stages?
    - Or separate state tracking?

12. **Blueprint Pins:** Should blueprints have canvas pins?
    - Blueprint-level pins?
    - Stage-level pins?
    - Link to workstation pins?

### Recipe Questions

13. **Recipe Numbering:** Should recipes have hash-based numbers (R1, R2, etc.)?
    - Like Quest Q1, Q2 numbering?
    - Or no numbering?

14. **Recipe Status:** How to determine recipe availability?
    - Skill requirements?
    - Workstation requirements?
    - Material availability?
    - Unlock status?

15. **Recipe Linking:** Should recipes link to result items via UUID?
    - Auto-create items on craft?
    - Or link to existing items?
    - Both options?

### Integration Questions

16. **Export/Import:** What should be exportable/importable?
    - Recipes (journal entries)
    - Blueprints (journal entries)
    - Workstations (with pin data)?
    - Gathering nodes (with pin data)?
    - Ingredients (compendium packs)?

17. **Community Content:** Format for community sharing?
    - Recipe journal compendiums?
    - Complete packs (recipes + workstations + nodes)?
    - Separate packs for different content types?

18. **Notification Integration:** What crafting events should trigger notifications?
    - Recipe discovery?
    - Tag discovery?
    - Skill increases?
    - Crafting success/failure?
    - Blueprint stage completion?

### UI/UX Questions

19. **Panel Organization:** How to organize recipe/blueprint browser?
    - Status-based (like Quest system)?
    - Category-based (like Codex)?
    - Both with tabs/filters?

20. **Progress Display:** Where to show progress?
    - Blueprint progress bars?
    - Recipe mastery progress?
    - Skill progress?

---

## Implementation Recommendations

Based on Quest patterns, here are recommendations:

### High Priority Patterns to Adopt

1. **✅ State-Based HTML Markup for Blueprints**
   - Use `<s>`, `<code>`, `<em>` for stage states
   - Visual representation in journal
   - Parser extracts state automatically

2. **✅ Scene Pin System for Workstations**
   - PIXI-based pins on canvas
   - Click to open crafting interface
   - Position persistence in scene flags

3. **✅ Scene Pin System for Gathering Nodes**
   - Visual gathering locations on canvas
   - Interactive gathering
   - State persistence (respawn, availability)

4. **✅ Status-Based Organization**
   - Group recipes/blueprints by availability/status
   - Dynamic status calculation
   - Progress bars

5. **✅ Export/Import with Scene Data**
   - Include pin positions in exports
   - Smart merging on import
   - Community content sharing

### Medium Priority Patterns

6. **Hash-Based Numbering**: Recipe/Blueprint numbers (R1, B1)
7. **Notification Integration**: Crafting event notifications
8. **GM Hints**: Hidden content in recipes/bluerints
9. **Progress Calculation**: From HTML state markup

### Low Priority Patterns

10. **Objective-Level Pins**: Blueprint stage pins (nice-to-have)
11. **Participant Linking**: Less relevant for crafting
12. **Treasure Linking**: Already covered by result items

---

## Next Steps

1. Resolve questions from the list above
2. Update architecture analysis with Quest patterns
3. Revise development plan to include:
   - Blueprint implementation using Quest patterns
   - Scene pin systems for workstations and gathering
   - State-based HTML markup for blueprints
   - Export/import with scene data

