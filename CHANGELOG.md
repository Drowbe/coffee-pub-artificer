# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

