# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

