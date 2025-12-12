# Questions to Resolve - Coffee Pub Artificer

This document tracks all questions that need to be answered before implementation begins. These questions emerged from reviewing the Codex and Quest system patterns.

---

## Data Storage Questions

### 1. Ingredient Storage
**Question:** Should Ingredients/Components/Essences be stored in Compendium Packs or Journals?

**Options:**
- ✅ **Option A (Recommended):** Compendium Packs
  - Better performance (frequently accessed during crafting)
  - Fast lookup for tag combination logic
  - Less likely to be edited frequently
  - Can create expansion compendiums easily

- ⚠️ **Option B:** Journals
  - More flexible (GMs can edit easily)
  - No technical knowledge needed to add custom ingredients
  - Could cache parsed data for performance

**Recommendation:** Compendium Packs for performance and scalability.

**Status:** ⏳ Pending Decision

---

### 2. Recipe Storage Organization
**Question:** How should recipes be organized in journals?

**Options:**
- Single "Artificer Recipes" journal (simple, centralized)
- Multiple journals by category (Consumables, Weapons, Armor, etc.)
- Default journal auto-created, but user can select different one
- User-selectable journal (no default)

**Recommendation:** Default journal that auto-creates if missing, but allows user to select different journal.

**Status:** ⏳ Pending Decision

---

### 3. Blueprint Storage
**Question:** Should blueprints be stored in the same journal as recipes or a separate journal?

**Options:**
- Same journal as recipes (combined storage)
- Separate "Artificer Blueprints" journal
- User-configurable (can choose same or different)

**Considerations:**
- How to differentiate in parser? (Category field, or separate parser?)
- Combined might be simpler for GMs
- Separate allows different permissions/ownership

**Status:** ⏳ Pending Decision

---

### 4. Workstation Storage
**Question:** How should workstations be stored?

**Options:**
- Journal entries (like recipes, editable by GMs)
- Scene flags only (positions and availability)
- Compendium entries (master workstation definitions)
- Hybrid (compendium for definitions, scene flags for instances)

**Recommendation:** Hybrid - Compendium for master definitions, scene flags for placed instances.

**Status:** ⏳ Pending Decision

---

### 5. Gathering Node Storage
**Question:** How should gathering nodes be stored?

**Options:**
- Scene flags only (positions, states, respawn timers)
- Journal entries for node definitions + scene flags for instances
- Compendium entries for node definitions + scene flags for instances

**Considerations:**
- Node definitions (material type, rarity, biome requirements) vs. instances (position, state)
- Do we need reusable node definitions or is each node unique?

**Status:** ⏳ Pending Decision

---

## Canvas & Pin Questions

### 6. Workstation Pin Placement
**Question:** Should workstations be placed on canvas as pins (like Quest pins)?

**Options:**
- ✅ Canvas-based pins (visual representation, click to craft)
- Abstract menu selection (no visual representation)
- Both options (GM preference setting)

**Recommendation:** Canvas-based pins for immersive experience, but allow abstract menu as fallback/option.

**Status:** ⏳ Pending Decision

---

### 7. Gathering Node Pin Placement
**Question:** Should gathering be canvas-based (click nodes on map) or abstract (menu-based)?

**Options:**
- ✅ Canvas-based pins (click nodes on map, immersive)
- Abstract menu-based (simpler, no scene setup needed)
- Both options (GM can choose per-scene or globally)

**Recommendation:** Canvas-based for immersive experience, but abstract option for convenience.

**Status:** ⏳ Pending Decision

---

### 8. Pin Types Needed
**Question:** What pin types do we need to implement?

**Confirmed Needed:**
- Workstation pins
- Gathering node pins

**Potential (Optional):**
- Recipe/Blueprint pins (visual reference on map)
- Material location pins (link ingredients to gathering nodes)
- Blueprint stage pins (like Quest objective pins)

**Status:** ⏳ Pending Decision - Need to confirm which are MVP vs. future

---

### 9. Pin Interactions
**Question:** What interactions should pins support?

**Options:**
- Left-click to interact (craft at workstation, gather from node)
- Drag to reposition (GM only)
- Right-click context menu (GM actions, settings)
- Tooltips (hover to see details)
- Double-click (quick actions?)

**Status:** ⏳ Pending Decision

---

## Blueprint Questions

### 10. Blueprint Stage Progression
**Question:** How should multi-stage blueprint crafting work?

**Options:**
- Each stage requires separate crafting action (player initiates each stage)
- Stages auto-progress when materials available (if player has materials, can craft next stage)
- Hybrid (player must initiate, but stages unlock sequentially)

**Considerations:**
- Should stages be crafted independently or in sequence?
- Can stages fail independently, or does failure block entire blueprint?
- Can stages be crafted out of order?

**Status:** ⏳ Pending Decision

---

### 11. Blueprint State Representation
**Question:** Should blueprint stages use HTML markup for state (like Quest tasks)?

**Options:**
- ✅ **Option A (Recommended):** Use HTML markup (`<s>` for completed, `<code>` for failed, `<em>` for hidden)
  - Visual in journal
  - Parser extracts state automatically
  - Consistent with Quest system

- ⚠️ **Option B:** Separate state tracking in flags
  - More explicit control
  - But requires synchronization with journal

**Recommendation:** HTML markup (consistent with Quest patterns).

**Status:** ⏳ Pending Decision

---

### 12. Blueprint Pins on Canvas
**Question:** Should blueprints have canvas pins (like Quest pins)?

**Options:**
- Blueprint-level pins (one pin per blueprint)
- Stage-level pins (pins for each stage, like Quest objective pins)
- Both (blueprint pin + stage pins)
- No pins (abstract only)

**Considerations:**
- Would stage pins show what materials needed for that stage?
- Would pins link to workstation where blueprint is crafted?

**Status:** ⏳ Pending Decision - Likely future enhancement, not MVP

---

## Recipe Questions

### 13. Recipe Numbering
**Question:** Should recipes have hash-based numbers (R1, R2, etc.) like Quest numbering?

**Options:**
- ✅ Yes, use hash-based numbering (consistent with Quest system)
- No numbering (use names only)

**Considerations:**
- Helps with quick reference ("Craft R42")
- Consistent with Quest system patterns
- Can display in UI for quick lookup

**Status:** ⏳ Pending Decision

---

### 14. Recipe Availability Status
**Question:** How should recipe availability be determined?

**Factors to Consider:**
- Skill requirements (Herbalism level 25)
- Workstation requirements (must be at Alchemist Table)
- Material availability (has required ingredients)
- Unlock status (discovered vs. locked)

**Question:** Should status be calculated dynamically or stored?

**Status:** ⏳ Pending Decision - Likely dynamic calculation (like Quest status)

---

### 15. Recipe Result Linking
**Question:** Should recipes link to result items via UUID (like Quest treasure linking)?

**Options:**
- Link to existing items (create item, then link)
- Auto-create items on craft (no pre-existing item needed)
- Both options (GM preference)

**Considerations:**
- Auto-create is simpler for GMs
- Linking allows customization of result item before crafting

**Status:** ⏳ Pending Decision

---

## Integration Questions

### 16. Export/Import Scope
**Question:** What should be exportable/importable for community sharing?

**Options:**
- Recipes (journal entries)
- Blueprints (journal entries)
- Workstations (definitions + pin data)
- Gathering nodes (definitions + pin data)
- Ingredients (compendium packs)

**Question:** Should export include scene pin data or just definitions?

**Status:** ⏳ Pending Decision

---

### 17. Community Content Format
**Question:** What format should community content packs use?

**Options:**
- Recipe journal compendiums (just recipes)
- Complete packs (recipes + workstations + nodes + scene data)
- Separate packs for different content types
- JSON export/import (like Quest system)

**Considerations:**
- Journal compendiums are easier to share
- Complete packs provide full setup
- JSON allows more control but less user-friendly

**Status:** ⏳ Pending Decision

---

### 18. Notification Events
**Question:** What crafting events should trigger notifications (via Blacksmith API)?

**Options to Consider:**
- Recipe discovered
- Tag discovered (e.g., "Fire tag discovered on Lavender")
- Skill increased (e.g., "Alchemy Level 5")
- Crafting success (with quality)
- Crafting failure
- Blueprint stage complete
- Blueprint complete

**Status:** ⏳ Pending Decision - Likely configurable in settings

---

## UI/UX Questions

### 19. Panel Organization
**Question:** How should recipe/blueprint browser be organized?

**Options:**
- Status-based (Available, Locked, Unlocked, Mastered) - like Quest system
- Category-based (Consumables, Weapons, Armor) - like Codex system
- Both (tabs or filters to switch views)

**Recommendation:** Both - default to status-based, but allow category filter.

**Status:** ⏳ Pending Decision

---

### 20. Progress Display
**Question:** Where should progress bars be displayed?

**Options:**
- Blueprint progress (stages complete / total stages)
- Recipe mastery progress (usage count / mastery threshold)
- Skill progress (current XP / next level XP)

**Question:** In main crafting panel, recipe browser, actor sheet, or all of the above?

**Status:** ⏳ Pending Decision

---

## Priority Classification

### Critical (Must Decide Before Phase 1)
- Questions 1-5 (Data Storage)
- Questions 6-7 (Canvas/Pin approach)
- Question 11 (Blueprint state representation)

### Important (Should Decide Before Phase 2-3)
- Questions 10, 12 (Blueprint implementation)
- Questions 13-15 (Recipe implementation)
- Question 19 (UI organization)

### Nice to Have (Can Decide During Implementation)
- Questions 8-9 (Pin interactions - can refine during development)
- Questions 16-18 (Integration features - can add later)
- Question 20 (Progress display - can optimize UX later)

---

## Decision Log

*Decisions will be recorded here as they are made:*

- **None yet** - All questions pending resolution

