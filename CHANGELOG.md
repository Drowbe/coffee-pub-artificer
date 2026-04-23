# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [13.0.14]

### Added
- **Blacksmith pin taxonomy at runtime:** Gather pins resolve `component-location` tags from `pins.getModuleTaxonomy('coffee-pub-artificer')` when available (`manager-pins.js`, `manager-gather.js`), with safe fallbacks if taxonomy is missing.
- **Secondary bar grouping:** Artificer secondary bar (`artificer-crafting`) uses `groups`, `groupBannerEnabled`, and item `group`/`order` for three sections: **Manage Artificer**, **Craft and Tinker**, **Gather and Harvest** (Blacksmith API only; no custom menubar CSS).

### Changed
- **Gather pin type (new pins only):** New gather pins use Blacksmith type `component-location` with at least one taxonomy tag; legacy `gather-spot` pins are left unchanged but still listed, synced, cleared, and double-click handled during transition.
- **Component family → pin tag mapping:** `CreaturePart` maps to taxonomy tag `creature` (and accepts legacy alias `creaturepart` when resolving against live taxonomy); other families unchanged (`environmental`, `essence`, `gem`, `mineral`, `plant`).
- **Secondary bar labels:** Renamed actions to match UX copy (e.g. Populate Location, Clear Locations, Skill Mapping, Recipes and Blueprints, Request Component Roll, Forage and Scavenge); bar height increased to `42` to fit group banners.
- **`documentation/guides/guide-pin-migration.md`:** Artificer section documents `component-location`, taxonomy-driven tags, transition behavior, and GM checklist.

### Removed
- **`styles/menubar.css`:** Removed unused legacy `#artificer-crafting-bar` overrides; dropped `@import "menubar.css"` from `styles/default.css` so menubar/secondary bar appearance stays on Blacksmith defaults and API options.

### Fixed
- **`PinsManager` sync:** Replaced `foundry.utils.deepEqual` (unavailable in some runtimes) with a local stable comparison for `eventAnimations` so GM pin sync no longer throws.

## [13.0.13]

### Added
- **`scripts/utils/blacksmith-console.js`:** Shared `getBlacksmithApi()` and `postBlacksmithConsole()` helpers that prefer `game.modules.get('coffee-pub-blacksmith').api.utils.postConsoleAndNotification`, then fall back to optional `globalThis.BlacksmithUtils`, matching Coffee Pub Blacksmith guidance for early `ready` (globals attach later than synchronous `module.api`).

### Changed
- **`artificer.js`:** Uses the shared Blacksmith console helpers; registers with Blacksmith via `api.registerModule` / `api.ModuleManager.registerModule` when available before falling back to `BlacksmithModuleManager`.
- **Data models and load path:** `model-ingredient.js`, `model-component.js`, `model-essence.js`, `model-recipe.js`, `model-blueprint.js`, ingredient/recipe/blueprint storage modules, and `parser-recipe.js` / `parser-blueprint.js` now log validation and parse issues through `postBlacksmithConsole` instead of bare `BlacksmithUtils` (safe during `ArtificerAPI.initialize()`).
- **Ruleset and cache reporting:** `cache/cache-items.js`, `skills-rules.js`, and `manager-gathering-images.js` use the same api-first logging pattern with GM `ui.notifications` fallback when neither API nor globals can log.

### Fixed
- **`TypeError: Cannot read properties of null (reading 'postConsoleAndNotification')`** when Artificer `ready` or `ArtificerAPI.initialize()` ran before `window.BlacksmithUtils` was wired (Blacksmith `markReadyForConsumers()` ordering).
- **`settings.js`:** Settings-loaded notification no longer called `BlacksmithUtils` in the `else` branch when utils were unavailable (could throw on `null`).
- **Fragile guards:** Replaced `typeof BlacksmithUtils !== 'undefined'` checks that still allowed `null` with api-first / optional-chained access for the updated paths.


## [13.0.12]

### Added
- **Item name aliases setting:** **Skills and Gathering** → **Item name aliases JSON** (default bundled `resources/translation-item.json`). Loads like other rulesets (strict fetch/parse; GM notification on failure). Changing the path clears the alias cache. **`config-rulesets.js`:** `getTranslationItemPath` / `getTranslationItemFetchUrl`.
- **Gathering `runtimeDefaults`:** Optional block in the gathering ruleset JSON (alongside `states`) for pin timeout/size/default icon, discovery radius and rarity offsets, min point separation for spot placement, and Blacksmith sound basenames. Merged over builtins in `manager-gathering-images.js` (`getGatherRuntimeDefaultsSync`); `manager-gather.js` reads these values. Boot preloads the gathering mapping so runtime defaults apply as soon as the file loads.
- **Crafting kit detection from skills mapping:** `buildCraftingKitNameSet()` in `skills-rules.js` collects `skillKit` + optional `extraKitNames` from enabled skills; the crafting window uses that set instead of a hardcoded kit list, with the same heuristics as before for edge cases.
- **Skills & Gathering settings:** New module section **Skills and Gathering** → **Rules** with file-picker world settings **Skills Ruleset JSON** and **Gathering Ruleset JSON** (defaults: bundled `skills-mapping.json` and `gathering-mapping.json`). Changing a path invalidates the in-memory cache so the next UI load uses the new file.
- **`scripts/config-rulesets.js`:** Resolves configured paths to fetch URLs via `foundry.utils.getRoute` where available.

### Changed
- **Renamed** `resources/skills-details.json` → **`resources/skills-mapping.json`** (same schema). All loaders now read the path from **Skills Ruleset JSON** (defaulting to the bundled file).
- **Gathering imagery** (`manager-gathering-images.js`) loads from **Gathering Ruleset JSON** instead of a hardcoded module path. Load/parse failures are reported to the GM (no silent embedded fallback); failed loads clear the cache so fixing the file or settings allows retry.
- **`SkillManager` / Skills window** use `loadSkillsDetails()` from `skills-rules.js` so a single cache and URL source drive skills data.
- **Strict skills ruleset loading:** `loadSkillsDetails()` no longer returns a fake empty document on failure; GMs get a console/notification error (same pattern as gathering mapping). Boot calls `loadSkillsDetails()` after settings register so `_lastKnownEnabledCraftingSkillIds` is populated before recipe APIs run when possible.
- **Skill ids from JSON:** Removed hardcoded `CRAFTING_SKILLS` enum; enabled skills come from the mapping (`skillEnabled !== false`). Added optional root **`gatherDefaults`** (`singleSkillIds`, `gatherWindowSkillIds`, `dc`, optional `harvestingSkillIds`) for gather window, scene harvesting defaults, and single-skill gather fallbacks. Gather window settings default to empty `skillIds` / `dc: 0` so unset values pull from `gatherDefaults`.
- **Gather roll-complete hook registration:** `manager-gather.js` now registers `blacksmith.requestRollComplete` through Blacksmith HookManager (`BlacksmithAPI.getHookManager().registerHook(...)`) instead of raw `Hooks.on(...)`, aligning with module API guidance and improving lifecycle consistency.
- **Crafting countdown update path:** Craft countdown no longer triggers a full window `render()` every second; it now updates only timer/container progress DOM during countdown to reduce repeated heavy context recomputation.
- **Gathering skill context:** `_getGatheringSkillContext()` memoizes results per actor + enabled skills + learned perks so repeated calls in the same flow skip redundant async rule work.
- **Crafting inventory lists:** Crafting window caches derived ingredient/apparatus/container/tool rows until the crafter’s inventory fingerprint changes, reducing CPU on filter/search re-renders.
- **Crafting UI delegation:** Document-level handlers prefer the last-focused crafting window before scanning all open crafting windows.
- **Debug logging:** Recipe journal “cover list state” console output runs only when `CONFIG.debug.coffeePubArtificer.recipeJournalCovers` is true.
- **Menubar active styling:** Artificer menubar button now uses Blacksmith/Foundry default active styling (removed custom green selected tint).
- **Crafting/Recipes details panel refresh:**
  - Replaced top detail rows with a scoreboard-style layout (small label + larger value tiles).
  - Metadata requirements block (apparatus/container/process/time/cost/work hours) now uses matching tile treatment with smaller values and responsive multi-row wrapping.
  - Removed redundant detail rows (`Result`, `Skill Kit`, and `DC`) from the default details view.
- **Journal filter locked marker:** Journal dropdown options now prefix journals that contain perk-locked recipes with a Unicode lock (`🔒`), which works with native select/option rendering.
- **Crafting bench traits block:** Traits now render inside a dedicated block with the same top-border treatment as other bench rows; the divider block only renders when traits exist.
- **Crafting bench overflow behavior:** Bench column now scrolls vertically when content exceeds available height, matching the other columns.
- **Artificer window launch behavior:** Gameplay windows now require a selected token before opening (skills, recipe browser, crafting station, gather roll), and opening one Artificer window closes other open Artificer windows first (single-window behavior).

### Fixed
- **Crafting window timer cleanup on close:** `CraftingWindow._preClose()` now clears `_searchDebounceTimer` and `_craftCountdownInterval` and resets pending countdown state to prevent post-close callbacks.
- **Window ref cleanup for document delegation:** `GatherWindow._preClose()` and `SkillsWindow._preClose()` now clear `_currentGatherWindowRef` / `_currentSkillsWindowRef` when closing the active instance, reducing stale-reference retention risk.
- **Foundry v13 template preload API migration:** Replaced deprecated global `loadTemplates(...)` usage with `foundry.applications.handlebars.loadTemplates(...)` in module init to remove v13 compatibility warnings and align with v15 requirements.


## [13.0.11]

### Added
- **Recipe Browser window:** Added a dedicated recipe browser window with the same visual language as the crafting station, focused on recipe browsing and details without the components and bench columns.
- **Recipe Browser menubar entry:** Added a new secondary bar button to open the Recipe Browser directly.

### Changed
- **Recipe Browser action flow:** Replaced the crafting action in the recipe-focused view with `Open in Crafting Window`, which opens the selected recipe in the normal crafting station.
- **Crafting window event handling:** Crafting-style windows now track delegation per open window so the new Recipe Browser and the Crafting Station can coexist more reliably.

### Fixed
- **Gather node consumption on failure:** Gather spots are now consumed when a harvest roll resolves, even when the roll fails, matching the intended gather-node lifecycle.


## [13.0.10]

### Fixed
- **Scene Config Artificer tab scrolling:** Added explicit vertical overflow handling so Artificer scene settings remain scrollable when tab content is taller than the Scene Config window.
- **Scene Config remembered-tab empty state:** Fixed initial render when reopening Scene Config with Artificer as the last-selected tab by re-binding/activating tab state after Artificer tab injection.


## [13.0.9] - Gather discovery, scene settings, and pins reliability

### Added
- **Discovery rarity thresholds (Base + Offset):** Scene settings now support rarity-based discovery thresholds using `Base DC + offset` per rarity band (Common, Uncommon, Rare, Very Rare, Legendary), evaluated from Legendary down to Common.
- **Pin add animation support for gather spots:** Gather pins now use Blacksmith `add` event animation (`ping`) with `interface-pop-02` sound for clearer discovery feedback when a new spot is placed.
- **Immediate pin materialization on discovery:** GM discovery application now creates missing Blacksmith pins for newly discovered nodes immediately instead of waiting for later reconciliation.
- **Shared gather pin config:** Added `scripts/config-gather-pins.js` as single source of truth for gather pin type, text, size, default image, and event animations/sounds.

### Changed
- **Scene settings defaults:**
  - Component Types default to all checked when unset.
  - Harvesting Skills default to all checked when unset.
- **Scene settings sliders:**
  - Gather Spots now uses a minimum of `1` (range `1-30`) in UI and runtime clamping.
  - Discovery radius remains slider-based (`5-300`, step `5`).
  - DC/offset controls use slider inputs and hint text presentation.
- **Gather image selection moved to data-first logic:**
  - `resources/gathering-mapping.json` migrated to v2 structure with biome + family buckets (`byFamily` + `anyFamily`).
  - Resolver now selects by state/biome/family from mapping data, with explicit fallback order, instead of filename token heuristics.
- **Family-aware pin imagery:** Discovered node family is passed to image resolution for idle gather pin art selection.
- **Blacksmith roll completion integration:** Gather/discovery roll completion now relies on Blacksmith’s completion path (`blacksmith.requestRollComplete`) and no longer uses Artificer-side socket forwarding.
- **Pin sync flow hardening:**
  - Added queued GM sync pass (`_syncQueued`) so scene updates arriving during active sync are not dropped.
  - Player clients now refresh pin renderer on both Artificer scene-flag updates and Blacksmith pin-flag updates.
  - Existing pins now re-sync image/event animation drift directly when resolved values differ.

### Fixed
- **Player explore reliability:** Fixed case where a second explore could discover spots but not show pins until a later gather/delete action.
- **Player/GM visual consistency:** Fixed cases where pin removals or updates appeared on GM first and lagged on player canvases.
- **Gather pin audio field compatibility:** Event animation sounds now use normalized Blacksmith sound paths for stable config/playback.
- **Family mapping gaps:** Added normalization aliases (`Gem/Gems -> mineral`, `CreaturePart -> creature parts`, etc.) and stronger fallback behavior to prevent seedling fallback from empty image pools.
- **Gather consume render lag on players:** Added gather-spot delete refresh handling on `blacksmith.pins.deleted` so player canvases reload pins when a gather spot is consumed.
- **Session hotfix for gather pin lifecycle:** Removed active gather image/state swap from the live gather roll flow to avoid renderer desync artifacts (stuck/overlay pin behavior) during consume/delete.

### Removed
- **Artificer custom roll-relay socket path:** Removed temporary gather/discovery relay registration and usage from `manager-gather.js`; Blacksmith authoritative completion flow is now the only path.

## [13.0.8] - Skills rules, gather enhancements, Request Roll API integration

### Added
- **skills-rules.json:** New `resources/skills-rules.json` (Option A) keyed by skill then perkID. Herbalism perks define `recipeTierAccess`, `craftingDCModifier`, `ingredientLossOnFail`, `experimentalCrafting`, and `componentSkillAccess` for use by the crafting window and gather logic.
- **Skills rules loader:** New `scripts/skills-rules.js` loads and caches the rules file and exposes `getEffectiveCraftingRules`, `getEffectiveComponentSkillAccess`, and `getEffectiveGatheringRules`. API exposes `getEffectiveCraftingRules(skillId, learnedPerkIds)` for callers that pass all learned perk IDs.
- **Crafting window — recipe visibility by perk:** For each recipe with a `skill` and `skillLevel`, the window uses the actor’s learned perks for that skill and the rules to determine if the recipe tier is visible. If not (and no Experimental Botanist bypass), the recipe row shows a generic icon, gets class `crafting-recipe-row-hidden`, and the Details pane shows: “You do not have the perk required to view this recipe.” Metadata (DC, skill kit, etc.) is hidden for locked recipes.
- **Gather — component skill access:** On a successful gather roll, only components whose skill level is 0 or within the actor's Herbalism `componentSkillAccess` ranges (from perks) are eligible. Actors can always receive level 0 components.
- **Skills window — Benefits display:** Perk details pane now loads `skills-rules.json` and displays each perk's benefits (title + description) in a structured list below "About the Perk."
- **Request Roll — per-actor situational bonus:** When opening Blacksmith Request Roll for forage, passes token-centric actors with per-actor `situationalBonus` from Herbalism perks and `groupRoll: false`.
- **Macro — Set component skill by rarity:** New `macros/set-component-skill-by-rarity-macro.js` crawls the "Artificer items" folder and sets each item's skill level from its D&D rarity (Common 0-3, Uncommon 4-9, Rare 10-14, Very rare 15-19, Legendary 20). Exception: if skill is already 0 and rarity is common, leaves 0. Supports dry run.

### Changed
- **module.json:** Added `scripts/skills-rules.js` to esmodules (before api-artificer).
- **Gather success card — template-driven layout:** All HTML moved from JavaScript into `templates/card-results-gather.hbs`; JS passes data only (items array with `img`/`link`, perks array, `actorPossessive`).
- **Gather success card — actor name:** Replaced placeholder "NAME" with the actual character name (e.g. "Nik Melok's") or "their" when no actor.

## [13.0.7] - Skills window: perks, kit indicators, Hide Unavailable

### Added
- **Skills Window — Hide Unavailable:** Toggle in the header (next to Points) to hide skill panels where the actor doesn't have the required kit. Uses the same oval switch style as other module toggles. Points remain on the far right.
- **Skills Window — craft icon on badge:** Hammer icon overlay on each skill badge (same style as perk cost badges). Green when the actor has the required kit (or skill has no kit); red when the kit is missing or no character is selected. Tooltip: "Has required kit" / "Missing required kit".
- **Skills Window — kit-missing indicator:** When the actor doesn't have the required kit for a skill, the panel is dimmed, shows a toolbox icon next to the skill name, and has a hover title listing the missing kit. Skills without a required kit are unchanged.

### Changed
- **Skills Window — slot → perk:** Renamed the skills UI concept from "slot" to "perk" everywhere (data: `slots`→`perks`, `slotID`→`perkID`, `slotSkillLearnedBackgroundColor`→`perkLearnedBackgroundColor` in `resources/skills-details.json`; code: `learnSlot`/`unlearnSlot`→`learnPerk`/`unlearnPerk`, CSS classes `.skills-slot-*`→`.skills-perk-*`, `.slot-applied`→`.perk-applied`). Actor flags now use `learnedPerks`; legacy `learnedSlots` is migrated automatically on first read.

### Fixed
- **Skills Window — kit state:** Craft icon and panel now correctly show red (missing kit) when no character is selected and the skill requires a kit; green only when the selected actor has the kit or the skill has no kit requirement.
- **Skills Window — Hide Unavailable switch:** Change listener is re-attached after each render so the toggle continues to filter unavailable skills when the window re-renders (e.g. after selecting a skill or applying changes).

## [13.0.6] - Compendium updates

## [13.0.5] - Sounds, GM-only menubar, Split Minor Potions macro

### Added
- **Crafting sounds:** Component panel plays SOUNDBUTTON04 when clicking any component row (add to slot, apparatus, container, or tool).
- **Timer sounds:** During crafting countdown, plays fire-boil-01.mp3 for heat process or grind-stone-01.mp3 for grinding, looped for the full timer duration (local only).
- **Split Minor Potions macro:** New script macro `macros/split-minor-potions-by-skill-macro.js` — splits the world journal "Minor Potions" into "Minor Alchemy Potions" (Skill: Alchemy) and "Minor Herbal Potions" (Skill: Herbalism), pages sorted alphabetically; supports dry run.

### Changed
- **Sound scope:** All crafting-window and component-panel sounds play for the acting player only; Success (SOUNDNOTIFICATION05) and Failure (SOUNDERROR05) still broadcast to all clients.
- **Menubar — GM only:** "Create Item", "Import Recipes", and "Roll for Components" secondary bar buttons are visible and usable only by the GM; non-GMs no longer see these buttons.
- **Roll for Components window:** "Request Roll" button is shown only to the GM; `_requestRoll()` is guarded so only the GM can request a roll.

### Fixed
- **Split Minor Potions macro:** Skill detection now strips HTML before matching so "Skill: Alchemy" and "Skill: Herbalism" are found in journal pages whose content is stored as HTML (e.g. `<strong>Skill:</strong> Alchemy`).

## [13.0.4] - Compendium updates

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

