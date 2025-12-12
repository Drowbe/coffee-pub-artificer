# Architecture Analysis: Applying Codex Patterns to Artificer

## Overview

After reviewing the Codex system from Coffee Pub Squire, several architectural patterns emerge that could significantly simplify and improve the Artificer crafting system. This document analyzes which patterns apply and how they could be adapted.

---

## Key Codex Patterns & Their Applicability

### 1. **Journal-Based Storage Pattern** ✅ Highly Applicable

**Codex Approach:**
- Uses FoundryVTT's native Journal system as data store
- Each entry is a journal page with structured HTML
- Leverages built-in permissions and ownership
- No custom database or synchronization needed

**Application to Artificer:**

#### ✅ Perfect Fit: Recipes & Blueprints
- **Recipes** should be journal entries (structured HTML)
  - Human-editable by GMs
  - Can be shared/unlocked per actor via ownership
  - Supports rich formatting and descriptions
  - Easy to import/export via journal system
  - Community recipes can be shared as journal compendiums

- **Blueprints** should be journal entries
  - Multi-stage blueprints as structured journal pages
  - Narrative hooks and descriptions naturally fit
  - Can link to related journals (lore, quests)
  - Stage-by-stage instructions in HTML format

#### ⚠️ Partial Fit: Ingredient/Component/Essence Definitions
- **Option A (Recommended for MVP):** Compendium Packs
  - Ingredients are frequently accessed during crafting
  - Need fast lookup for tag combination logic
  - Less likely to be edited frequently by GMs
  - Better performance when parsing many entries
  
- **Option B (Advanced/Flexible):** Journal Entries
  - Allows GMs to customize ingredient properties easily
  - Can add custom ingredients without technical knowledge
  - More flexible but potentially slower performance
  - Could cache parsed data for performance

**Recommendation:** Use **Compendium Packs for Ingredients/Components/Essences** (master data), and **Journals for Recipes/Blueprints** (player-facing, editable content).

#### ❌ Not Applicable: Player Data
- Skills, tag discoveries, blueprint progress → **Actor Flags** (as planned)
- Workstation locations → **Scene Flags** (as planned)

---

### 2. **Parser-Based Architecture** ✅ Highly Applicable

**Codex Approach:**
- Stores structured HTML in journals
- Parses HTML on-demand using DOMParser
- Extracts structured data via semantic HTML (`<p><strong>Label:</strong> value</p>`)
- Flexible schema - can add fields without migration

**Application to Artificer:**

#### Recipe/Blueprint Parser
```javascript
// Example Recipe Journal Entry Structure:
<p><strong>Recipe Name:</strong> Healing Potion</p>
<p><strong>Category:</strong> Consumable</p>
<p><strong>Type:</strong> Potion</p>
<p><strong>Skill Required:</strong> Alchemy 25</p>
<p><strong>Workstation:</strong> Alchemist Table</p>
<p><strong>Ingredients:</strong> Herb: Lavender (2), Essence: Life (1)</p>
<p><strong>Tags:</strong> healing, consumable, potion</p>
<p><strong>Result:</strong> Healing Potion (Item UUID or structured data)</p>
<p><strong>Description:</strong> A basic healing potion...</p>
```

**Benefits:**
- GMs can edit recipes directly in journal sheets
- Version-tolerant (parser handles missing fields gracefully)
- No schema migrations needed
- Rich formatting support
- Can link to other journal entries (narrative hooks)

**Parser Implementation:**
```javascript
class RecipeParser {
    static async parseRecipePage(page, enrichedHtml) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(enrichedHtml, 'text/html');
        
        const recipe = {
            name: this._extractField(doc, 'Recipe Name'),
            category: this._extractField(doc, 'Category'),
            skillRequired: parseInt(this._extractField(doc, 'Skill Required')) || 0,
            workstation: this._extractField(doc, 'Workstation'),
            ingredients: this._parseIngredients(this._extractField(doc, 'Ingredients')),
            tags: this._parseTags(this._extractField(doc, 'Tags')),
            result: this._extractField(doc, 'Result'),
            description: this._extractField(doc, 'Description')
        };
        
        return recipe;
    }
}
```

---

### 3. **Form/Panel Pattern** ✅ Highly Applicable

**Codex Approach:**
- **FormApplication** for creating/editing entries
- **Panel** (ApplicationV2) for browsing/displaying entries
- Drag & drop auto-population
- Smart field management

**Application to Artificer:**

#### Recipe Form (FormApplication)
- Drag & drop items to auto-populate recipe result
- Ingredient selection with tag display
- Skill requirement dropdown
- Workstation selection
- Tag input with suggestions
- Generates structured HTML for journal page

#### Recipe Panel (ApplicationV2)
- Browse available recipes
- Filter by skill, workstation, category, tags
- Search functionality
- Show unlock status per actor
- "Craft from Recipe" button
- Recipe details view

#### Crafting Panel (ApplicationV2) 
- Main crafting interface
- Ingredient browser
- Recipe browser (using RecipePanel patterns)
- Experimentation interface
- Result display

---

### 4. **Tag-Based Filtering** ✅ Already in Design

**Codex Approach:**
- Extracts tags from entries
- Client-side filtering with tag cloud
- Multi-select tag filtering
- Search + tags work together (AND logic)

**Application to Artificer:**
- Already planned for tag system
- Can use similar filtering patterns for:
  - Recipe browser (filter by tags, skill, workstation)
  - Ingredient browser (filter by family, tags, tier)
  - Blueprint browser (filter by tags, skill requirement)

---

### 5. **Category-Based Organization** ✅ Applicable

**Codex Approach:**
- Entries grouped by category
- Categories extracted from entries (no predefined list)
- Collapsible category sections

**Application to Artificer:**
- Recipe categories: Consumable, Weapon, Armor, Tool, etc.
- Blueprint categories: Artifact, Legendary, Quest, etc.
- Ingredient families already defined in design
- Can use similar collapsible organization in UI

---

### 6. **Client-Side Filtering** ✅ Highly Applicable

**Codex Approach:**
- DOM-based filtering (no re-render needed)
- Fast, responsive filtering
- Uses `Set` for efficient lookups

**Application to Artificer:**
- Recipe filtering (search + tags + skill + workstation)
- Ingredient filtering (family + tags + tier + rarity)
- Blueprint filtering (skill + tags + category)
- All can use DOM-based filtering for performance

---

## Revised Architecture Recommendation

### Data Storage Strategy

#### Tier 1: Master Data (Rarely Changed, Frequently Accessed)
**Storage:** Compendium Packs

- **Ingredients** (Raw Materials)
  - Fast lookup during tag combination
  - Shared across worlds
  - Can be expanded via additional compendiums
  
- **Components** (Refined Materials)
  - Same rationale as ingredients
  
- **Essences** (Magical Affinities)
  - Same rationale as ingredients

**Rationale:** These are frequently accessed during crafting operations. Compendium packs provide good performance and can be easily shared/expanded.

#### Tier 2: World Content (Frequently Edited, Player-Facing)
**Storage:** Journal Entries

- **Recipes**
  - Human-editable by GMs
  - Unlockable per actor via ownership
  - Rich formatting support
  - Easy to share as journal compendiums
  
- **Blueprints**
  - Multi-stage narrative content
  - Rich descriptions and lore
  - Same benefits as recipes

**Rationale:** These benefit from the flexibility of journal-based storage, human editability, and built-in permissions.

#### Tier 3: Player Data (Per-Actor)
**Storage:** Actor Flags

- Skills (Herbalism, Metallurgy, etc.)
- Tag discoveries (per ingredient, per actor)
- Blueprint progress (per blueprint, per actor)
- Unlocked recipes (could also use ownership, but flags provide more control)

**Rationale:** Player-specific data that changes frequently and needs to be tied to actors.

#### Tier 4: World/Scene Data
**Storage:** Scene Flags / World Settings

- Workstation locations (scene flags)
- Gathering nodes (scene flags)
- Biome data (scene flags)
- World-wide settings (world settings)

**Rationale:** Spatial and world-level configuration.

---

## Updated Development Plan Implications

### Phase 0-1 Changes

**Original Plan:**
- Custom data storage system
- Class-based models for all entities
- Storage manager for CRUD operations

**Revised Plan (Using Codex Patterns):**

1. **Recipe/Blueprint System:**
   - Create `RecipeParser` class (similar to CodexParser)
   - Create `RecipeForm` (FormApplication for editing)
   - Create `RecipePanel` (ApplicationV2 for browsing)
   - Store recipes/bluerints as journal entries

2. **Ingredient/Component/Essence System:**
   - Create compendium pack structure
   - Create data models (class-based) for validation
   - Create lookup/cache system for fast access
   - Import/export functionality

3. **Parser Utilities:**
   - Generic parser utilities (inspired by CodexParser)
   - HTML generation utilities
   - Field extraction utilities

### Benefits of This Approach

1. **Simplified Storage:**
   - No custom database to maintain
   - Leverages FoundryVTT's native systems
   - Built-in permissions and ownership
   - No synchronization issues

2. **Better UX:**
   - GMs can edit recipes directly in journals
   - Rich formatting support
   - Easy to share content (journal compendiums)
   - Familiar workflow (journals)

3. **Flexibility:**
   - Can add fields without migration
   - Version-tolerant parsing
   - Easy to extend

4. **Performance:**
   - Compendium packs for frequently accessed data
   - Journals for less-frequently accessed, editable content
   - Client-side filtering for UI

---

## Implementation Considerations

### Recipe Journal Structure

Each recipe would be a journal page with this structure:

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
<p><strong>Quality Bonus:</strong> +1</p>
<p><strong>Tags:</strong> healing, consumable, potion, basic</p>
<p><strong>Description:</strong> A basic healing potion that restores a small amount of health.</p>
<p><strong>Source:</strong> Basic Alchemy Guide</p>
```

### Parser Implementation Pattern

```javascript
class ArtificerRecipeParser {
    /**
     * Parse a recipe from a journal page
     * @param {JournalEntryPage} page - The journal page
     * @param {string} enrichedHtml - The enriched HTML content
     * @returns {Object|null} - Parsed recipe object or null if invalid
     */
    static async parseRecipePage(page, enrichedHtml) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(enrichedHtml, 'text/html');
            
            const recipe = {
                id: page.id,
                name: this._extractField(doc, 'Recipe Name') || page.name,
                type: this._extractField(doc, 'Type'),
                category: this._extractField(doc, 'Category'),
                skill: this._extractField(doc, 'Skill'),
                skillLevel: parseInt(this._extractField(doc, 'Skill Level')) || 0,
                workstation: this._extractField(doc, 'Workstation'),
                ingredients: this._parseIngredientsList(doc),
                result: this._extractUUID(doc, 'Result'),
                qualityBonus: parseInt(this._extractField(doc, 'Quality Bonus')) || 0,
                tags: this._parseTags(this._extractField(doc, 'Tags')),
                description: this._extractField(doc, 'Description'),
                source: this._extractField(doc, 'Source')
            };
            
            // Validate required fields
            if (!recipe.name || !recipe.ingredients?.length) {
                return null; // Invalid recipe
            }
            
            return recipe;
        } catch (error) {
            console.error('Error parsing recipe:', error);
            return null;
        }
    }
    
    static _extractField(doc, label) {
        // Similar to CodexParser field extraction
        const paragraphs = doc.querySelectorAll('p');
        for (const p of paragraphs) {
            const strong = p.querySelector('strong');
            if (!strong) continue;
            let fieldLabel = strong.textContent.trim();
            if (fieldLabel.endsWith(':')) {
                fieldLabel = fieldLabel.slice(0, -1);
            }
            if (fieldLabel.toLowerCase() === label.toLowerCase()) {
                return p.textContent.replace(strong.textContent, '').trim();
            }
        }
        return null;
    }
    
    static _parseIngredientsList(doc) {
        // Parse ingredients from list format
        const ingredients = [];
        const lists = doc.querySelectorAll('ul, ol');
        for (const list of lists) {
            const prevSibling = list.previousElementSibling;
            if (prevSibling?.querySelector('strong')?.textContent.includes('Ingredients')) {
                const items = list.querySelectorAll('li');
                for (const item of items) {
                    // Parse format: "Type: Name (quantity)"
                    const match = item.textContent.match(/(.+?):\s*(.+?)\s*\((\d+)\)/);
                    if (match) {
                        ingredients.push({
                            type: match[1].trim(),
                            name: match[2].trim(),
                            quantity: parseInt(match[3])
                        });
                    }
                }
            }
        }
        return ingredients;
    }
    
    static _parseTags(tagString) {
        if (!tagString) return [];
        return tagString.split(',').map(t => t.trim()).filter(t => t);
    }
    
    static _extractUUID(doc, label) {
        const value = this._extractField(doc, label);
        if (!value) return null;
        // Extract UUID from @UUID[Type.id]{Name} format
        const match = value.match(/@UUID\[(.*?)\]/);
        return match ? match[1] : null;
    }
}
```

---

## Questions to Resolve

1. **Ingredient Storage:** 
   - ✅ Use Compendium Packs (recommended for performance)
   - ⚠️ OR use Journals (more flexible, slower)
   - Decision needed before Phase 1

2. **Recipe Journal Selection:**
   - How should recipes be organized? Single journal or multiple?
   - Should there be a default "Artificer Recipes" journal?
   - How to handle multiple recipe sources (modules, expansions)?

3. **Blueprint Storage:**
   - Same journal as recipes or separate?
   - How to handle multi-stage blueprints? One page or multiple?

4. **Import/Export:**
   - Export recipes as journal compendiums?
   - Export ingredients as compendium packs?
   - Import/export format for community sharing?

---

## Conclusion

The Codex patterns provide an excellent foundation for Artificer's recipe and blueprint systems. By using journal-based storage for recipes/blueprints and compendium packs for master data (ingredients/components/essences), we can:

- Simplify the architecture significantly
- Leverage FoundryVTT's native systems
- Provide better UX for GMs
- Maintain good performance
- Enable community content sharing

The parser-based architecture is particularly valuable for recipes and blueprints, providing flexibility and version tolerance that will be crucial as the system evolves.

**Next Steps:**
1. Resolve the questions above
2. Update the development plan with journal-based patterns
3. Begin implementation with RecipeParser and RecipeForm following Codex patterns

