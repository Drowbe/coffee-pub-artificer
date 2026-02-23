# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [13.0.3] - Quick error update

## [13.0.2] - Phase 1 Core Data System Implementation

### Added
- **Data Models:**
  - `ArtificerIngredient` class - Raw materials with tags, family, tier, rarity
  - `ArtificerComponent` class - Refined materials with component types
  - `ArtificerEssence` class - Magical affinities with essence types
  - `ArtificerRecipe` class - Recipe definitions with hash-based numbering (R1, R2, etc.)
  - `ArtificerBlueprint` class - Multi-stage blueprints with hash-based numbering (B1, B2, etc.)
  - All models include validation, serialization, and helper methods
  - Recipe model includes `canCraft()`, `getMissingMaterials()`, `getNumber()` methods
  - Blueprint model includes `getStageStatus()`, `canStartStage()`, `getActorProgress()` methods

- **Storage System:**
  - `IngredientStorage` - Loads ingredients from user-configured compendiums (priority-based)
  - `RecipeStorage` - Loads recipes from journal entries using parser
  - `BlueprintStorage` - Loads blueprints from journal entries using parser
  - All storage classes include caching and refresh capabilities
  - Storage managers integrated into manager classes

- **Parser System:**
  - `RecipeParser` - Parses HTML journal pages into ArtificerRecipe objects
  - `BlueprintParser` - Parses HTML journal pages with stage markup into ArtificerBlueprint objects
  - Both parsers handle FoundryVTT HTML format (`<p><strong>Label</strong>: value</p>`)
  - Handles ingredient/requirement lists from `<ul><li>` elements
  - Extracts `@UUID` links for result items
  - Version-tolerant parsing with graceful error handling

- **TagManager System:**
  - `TagManager` class - Comprehensive tag validation and management
  - Tag validation (2-5 tags per ingredient)
  - Tag categories (primary, secondary, quirk, element, structural)
  - Tag family definitions (Herbs, Minerals, Gems, CreatureParts, Environmental)
  - Tag lookup methods (`getTagCategory()`, `getTagFamily()`, `getTagMetadata()`)
  - Tag suggestion methods (`suggestPrimaryTag()`, `suggestSecondaryTags()`)
  - Tag combination analysis (base structure for Phase 2)
  - Singleton pattern via `getTagManager()`
  - Integrated into API as `api.tags`

- **Compendium Mapping Settings:**
  - `numIngredientCompendiums` setting - Slider (0-10) to configure number of priority slots
  - `ingredientCompendium1`, `ingredientCompendium2`, etc. - Priority-based compendium selection
  - Dropdown menus for selecting Item compendiums
  - Only configured compendiums are scanned for ingredients
  - Prevents errors from malformed items in other compendiums

- **Journal Settings:**
  - `recipeJournal` setting - Select journal for recipe entries
  - `blueprintJournal` setting - Select journal for blueprint entries
  - Both settings with full localization support
  - Graceful fallback to defaults if settings not registered

- **Utilities:**
  - `helpers.js` - General utilities including `getOrCreateJournal()` and `hashString()`
  - Hash-based numbering for recipes (R1, R2, etc.) and blueprints (B1, B2, etc.)
  - Consistent with Quest system numbering pattern

- **Documentation:**
  - `documentation/architecture-artificer.md` - Renamed from `overview-artificer.md` for naming consistency
  - `documentation/SYSTEM_EXPLANATION.md` - Comprehensive visual explanation of system
  - `documentation/IMPLEMENTATION_ROADMAP.md` - Updated with progress and decisions

### Changed
- **Ingredient Loading:**
  - Now only loads from user-configured compendiums (priority-based)
  - No longer scans all compendiums, reducing errors and improving performance
  - Per-item error handling to gracefully skip malformed items
  - Checks for `flags.artificer.type === 'ingredient'` before processing

- **Settings Access:**
  - Added try-catch guards around `game.settings.get()` calls
  - Graceful fallback to defaults when settings not yet registered
  - Prevents initialization errors during module startup

- **Storage Initialization:**
  - Storage classes now have `isInitialized` flag
  - Better error handling during initialization
  - Individual item loading to avoid bulk initialization errors

### Fixed
- Fixed "setting not registered" errors during initialization
- Fixed errors from loading malformed items in compendiums (midi-qol compatibility)
- Improved error handling to prevent one bad item from breaking entire pack loading
- Fixed settings registration order to ensure compendium choices are available
- **Consumable detection:** Use `item.type` for consumable check (D&D 5e 5.5 stores subtype in `system.type.value`); Flask of Oil and similar items now appear in component list

### Crafting Window UI (13.0.2 session)
- **Broader component list:** Show D&D consumables (potions, oils, etc.) without artificer flags as valid components using `asCraftableConsumable()` and D&D subtype → family mapping
- **Recipe row redesign:** Result item image, recipe title on top, tags below; async `getRecipesForDisplay()` resolves result item for image
- **Components section:** Renamed "Ingredients" to "Components" (section title, search placeholder, empty state)
- **Craftable indicator:** Hammer icon right-justified in recipe rows
- **Time slider:** Range 0–120 seconds (was 5–120); default 0 when no recipe
- **Recipe defaults:** When recipe does not set heat or time, sliders reset to 0 (none)
- **Tags display:** "Tags for this combination" moved from Crafting Bench to Details section

### Skills Window (13.0.2)
- **Skills Window** (ApplicationV2) opened from Artificer secondary bar
- **Data-driven UI:** Skills and slots loaded from `resources/skills-details.json` (skill name, img, description; slot name, description, requirement, cost, value, icon, backgroundColor, borderColor)
- **Panel layout:** Label row above badge and slots — left-aligned skill name, right-aligned dots (count = sum of slot costs); badge (square image) + 2×5 grid of slots (10 max)
- **Interactions:** Click badge → show skill details in Details pane; click slot → show slot details (name, requirement, description, cost)
- **Slot display:** Number in upper-right = cost from JSON; when slot is applied (value > 0), number badge uses `.slot-applied` (green) styling
- **Layout:** Panels column fixed 700px; details pane flexes with window; panels area scrolls when many skills
- **Event handling:** Delegation attached in `_onFirstRender` so badge and slot clicks work with ApplicationV2 PARTS

### Roll for Components (Gather) — 13.0.2
- **Gather window** (Roll for Components): GM selects habitats (biomes), component types, and DC; requests a roll for selected canvas tokens.
- **Habitat multi-select:** Same approach as Create window — grid of Habitat buttons (multi-select, `.gather-biome-btn` with `.active`); eligibility uses selected biomes (item eligible if it has no biomes or its biomes intersect the selection).
- **Blacksmith Request a Roll integration:**
  - **Wisdom roll:** Uses `initialType: 'ability'`, `initialValue: 'wis'` (no Herbalism Kit).
  - **Silent mode:** `silent: true` — request is posted to chat immediately without opening the dialog; gather window closes after posting.
  - **onRollComplete payload:** Uses `payload.result.total`, `payload.tokenId` (actor from scene token), `payload.allComplete`.
- **Only components:** Eligibility filters by `artificerType === Component` so weapons/tools/creations are never returned.
- **No cards until all have rolled:** Results are buffered per roll; chat cards (success, failure, or “no matching components here”) are sent only when `payload.allComplete`, one card per actor.
- **Remember settings:** `gatherWindowSettings` world setting stores last-used biomes, component types, and DC; restored when the gather window is reopened.
- **Chat cards:** Success card shows found item with image and UUID link (investigation-tool style), left-aligned. Distinct “You searched the area but found no components of the types you were looking for here” when roll succeeded but pool was empty (`sendGatherNoPoolCard`).
- **Manager:** `processGatherRollResult()` runs DC check, picks item, adds to actor; returns outcome without sending cards. `handleGatherRollResult()` uses it and sends one card (for non-buffered use). Cache records include `biomes`; `getEligibleGatherRecords(biomes, families)` uses records only and fetches a single item via `fromUuid` for speed (no bulk load when cache is cold).

### Technical Details
- All data models use class-based structure with validation
- Storage managers use Map-based caching for performance
- Parsers use DOMParser for safe HTML parsing
- TagManager uses singleton pattern for efficient reuse
- Compendium loading uses individual item loading to avoid bulk errors
- Hash-based numbering provides consistent IDs even if names change

## [13.0.1] - Phase 0-1 Implementation

### Added
- **Complete Folder Structure:**
  - `scripts/data/models/` - Data model classes (Ingredient, Component, Essence, Recipe, Blueprint, Workstation)
  - `scripts/data/storage/` - Storage managers (IngredientStorage, RecipeStorage, BlueprintStorage, StorageManager)
  - `scripts/parsers/` - HTML parsers (RecipeParser, IngredientParser, BlueprintParser)
  - `scripts/systems/` - Core systems (TagManager, ExperimentationEngine, SkillManager)
  - `scripts/ui/forms/` - FormApplication classes (RecipeForm, BlueprintForm, IngredientForm)
  - `scripts/ui/panels/` - ApplicationV2 panels (CraftingPanel, RecipePanel, BlueprintPanel, IngredientPanel)
  - `scripts/utils/` - Utility functions (DnD5eHelpers, ItemGenerator, Helpers, Logging)

- **Data Models:**
  - `ArtificerIngredient` - Raw materials with tags, family, tier, rarity
  - `ArtificerComponent` - Refined materials
  - `ArtificerEssence` - Magical affinities
  - `ArtificerRecipe` - Recipe definitions with ingredient requirements
  - `ArtificerBlueprint` - Multi-stage blueprint definitions
  - `ArtificerWorkstation` - Workstation definitions
  - All models include validation, serialization, and getter methods

- **Storage System:**
  - Hybrid storage approach: Compendiums for defaults, Journals for world-specific content
  - `IngredientStorage` - Aggregates ingredients from compendiums and journals
  - `RecipeStorage` - Loads recipes from journals (parser-based)
  - `BlueprintStorage` - Loads blueprints from journals (parser-based)
  - `StorageManager` - Central coordinator for all storage systems
  - Auto-creation of default journals if missing

- **Parser System:**
  - `RecipeParser` - Parses HTML journal pages into ArtificerRecipe objects
  - `IngredientParser` - Parses custom ingredients from journals
  - `BlueprintParser` - Parses multi-stage blueprints with state markers
  - All parsers follow FoundryVTT HTML format (`<strong>Label</strong>: value`)
  - Handles list items with `<li><p>content</p></li>` format
  - Version-tolerant parsing with graceful error handling

- **Core Systems:**
  - `TagManager` - Tag validation, categories, and families
  - `ExperimentationEngine` - Placeholder for Phase 2 tag combination logic
  - `SkillManager` - Basic skill tracking via actor flags

- **Settings Framework:**
  - Journal selection settings (Recipes, Blueprints, Ingredients)
  - Feature toggles (Gathering, Salvage, Experimentation)
  - Progression settings (Tag discovery thresholds, skill progression rate)
  - All settings with full localization support

- **Module API:**
  - `ArtificerAPI` class - External access point
  - Registered on `game.modules[ID].api`
  - Provides access to storage, tags, and skills
  - `createExamples()` method for generating test data

- **Initial Data System:**
  - Auto-creation of example recipes and blueprints in new journals
  - Example recipe: "Healing Potion" (Alchemy, basic potion)
  - Example blueprint: "The Arcanic Wayfinder" (multi-stage artifact)
  - Journal auto-creation helpers

- **Logging System:**
  - `logging.js` utility with Blacksmith API integration
  - Debug, info, warn, and error logging functions
  - Uses `postConsoleAndNotification` when available

### Changed
- **HTML Format:**
  - Updated all example data to use FoundryVTT format (`<strong>Label</strong>: value` instead of `<strong>Label:</strong> value`)
  - Updated parsers to handle FoundryVTT list item format (`<li><p>content</p></li>`)
  - Fixed value extraction to handle colon placement correctly
  - Updated menubar registration to support th eupdated API in blacksmith

- **Ingredient ID Resolution:**
  - Disabled ingredient ID resolution during initial load to prevent circular dependencies
  - Model validation now automatically generates temporary IDs (`temp:type:name`) when IDs are missing
  - Prevents errors when ingredients don't exist yet
  - Real IDs can be resolved later when needed

### Fixed
- Fixed recipe parsing errors when ingredients don't have IDs
- Fixed circular dependency issues during storage initialization
- Fixed repeated console warnings from ingredient resolution
- Fixed HTML parsing to match FoundryVTT's native format
- Fixed journal auto-creation to properly set settings

### Technical Details
- All parsers use async/await for enriched HTML content
- Storage managers cache loaded data for performance
- Models validate data structure on creation
- Temporary ingredient IDs allow recipes to load before ingredients exist
- Parser-based architecture follows Codex/Quest system patterns

## [13.0.0] - Initial Framework Release - NON FUNCTIONAL

### Added
- Initial module structure
- Integration with Coffee Pub Blacksmith
- Menubar integration with Artificer tool (middle zone)
- Secondary bar system (100px height, ready for crafting UI)
- Architecture analysis and design documentation
- Consolidated design document with technical decisions and outstanding questions
- Phase 0: Foundation & Architecture Setup
  - Folder structure (resources/, templates/)
  - Schema files with JSDoc type definitions (schema-*.js)
  - Manager placeholder classes (manager-*.js)
  - Module API structure (api-artificer.js)
  - Updated module.json with all new script files

### Changed
- **Data Storage Clarification:** Updated documentation to clarify that Ingredients, Components, Essences, and Recipe/Blueprint results are FoundryVTT Items (stored in compendium packs), while Recipes and Blueprints themselves are Journal Entries. This aligns with the architecture where Items represent physical materials/crafted results, and Journals represent knowledge/instructions.

### Added
- **Item Creation & Import Architecture:**
  - Core item creation utilities (`utility-artificer-item.js`)
  - Artificer data stored in `flags.artificer.*` (tags only visible in crafting UI)
  - Unified form approach for creating ingredients/components/essences
  - JSON import utilities planned (supports single and bulk imports)
  - Menubar integration for Create Item and Import Items tools
  - Items created in world (GM drags to compendium manually)

