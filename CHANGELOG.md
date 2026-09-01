# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [Unreleased]

### Added
- **Artificer flags are contributed to Blacksmith's JSON importer:** The flag block registers as a field
  group (`scripts/declarations/declaration-artificer-item-group.js`), so Blacksmith derives the authoring
  template, guide, prompt, validation and document construction from one declaration rather than from
  prompt text we maintained separately. A field group rather than a profile because Artificer flags are
  orthogonal to the D&D type — an Artificer item *is* a loot, or a consumable, or a tool, with our block
  added. The four Process-only fields are gated on `artificerFamily`, so they never appear on anything
  that is not a Process.
- **An import checker, `tools/check-imports.mjs`:** Run `node tools/check-imports.mjs`; every named import
  under `scripts/` and `testing/` must name an export its target actually has. This closes a class our only
  other static gate cannot see at all -- `node --input-type=module --check` *parses without resolving*, so a
  symbol renamed or moved between files without its `export` leaves every file valid and every check
  passing. A static import then fails the whole module load, and a lazy one is worse: it destructures to
  `undefined` and throws only when something finally calls it, on whichever branch of whichever window
  reaches it first. Adapted from Blacksmith's tool of the same name.

- **A test harness, in `testing/`:** Paste `testing/test-harness.js` into a script macro and run it as GM;
  it loads the suites listed in `SUITES` and opens a dialog with a headless tier that self-reports PASS/FAIL
  and an interactive tier for what a person has to judge. It exists because most of what needs checking in
  this module reports *nothing* when broken — a field group that failed to register, a gate that can never
  fire, a cache claiming 668 items and returning none all look like working code from the console. The first
  suite covers the importer field group: that it registered, that every field writes inside our flag
  namespace, that the Process fields gate on family rather than type, that each gate names a value its gate
  field can actually hold, and that our fields reach a derived template when the import option is ticked and
  no template when it is not.

- **Scene habitat is Blacksmith's, not Artificer's:** Habitat is a property of a scene as a *place*, and
  several modules read it -- Minstrel's habitat-conditioned playlists gated on Artificer being installed
  purely because we used to own the flag, so they did nothing in worlds without a harvesting module. It now
  lives on Blacksmith's Geography tab. Artificer's Habitats fieldset is gone, replaced by a read-only
  summary that says where to set them, and all five places that read our own `scene.habitats` flag now call
  `api.geography.getHabitats()`. Blacksmith migrates existing habitats on first load; **your scene
  configuration carries over and the old flag is left in place untouched**, though nothing reads it.
- **Artificer refuses to start when Blacksmith failed to initialize:** Previously it would have started
  anyway. Because habitat now comes from Blacksmith and their habitat migration runs before consumers wake,
  a degraded Blacksmith means an empty habitat list is indistinguishable from a scene that genuinely has
  none -- so continuing would silently stop gathering on every configured scene. Settings registration is
  unretryable besides. **If you see "Artificer: not starting", it names the Blacksmith stage that failed;
  that is where to look, not in Artificer.**

- **The habitat vocabulary now comes from Blacksmith:** `api.geography.HABITATS` is the source of
  truth -- twelve `{key, label}` pairs with lowercase keys -- and Artificer keeps a fallback copy only for
  a Blacksmith too old to expose it. Two consequences worth knowing. Habitat buttons and checkboxes now
  show a proper label ("Underdark") while round-tripping the key, which were the same string until the
  vocabulary moved. And the vocabulary is resolved through a function rather than held in a constant,
  because `game` does not exist when module scripts evaluate: a constant would have captured the fallback
  permanently, and our importer field-group declaration would have registered a habitat `values` list in
  the wrong case -- cleanly, silently, and then rejecting valid content.

- **Biome comparisons are case-insensitive everywhere:** Habitat is a join key -- scene habitats are matched
  against item biome flags -- and every comparison between the two was case-sensitive, including the ones
  that decide what a form renders and then writes back. `normalizeBiome` and `normalizeBiomeList` in
  `schema-ingredients.js` are now the single place that decides case, and no stored biome is compared
  directly anywhere. This matters because the vocabulary is moving to Blacksmith's scene geography as a
  lowercase constant: without this, every biome-tagged component would have rendered with its habitats
  unselected and refused to save, and gather would have quietly returned only the components that have no
  habitats at all -- working, plausible, and wrong.

### Changed
- **Importing a Component without a habitat, or an Essence without an affinity, now fails:** Both have
  always been stated in the authoring prompt and enforced nowhere, so payloads carrying neither imported
  cleanly and produced content that could never be gathered or matched. They are declared rules now and
  are reported as validation errors naming the field. **This will reject JSON that imported before.** The
  fix is to supply the missing value; a Component with no habitat has nowhere to be found, and an Essence
  with no affinity cannot be matched by a recipe.

## [13.2.1]

### Fixed
- **An unticked checkbox group wrote junk that read as configuration:** Foundry resolves several inputs
  sharing a name to a `RadioNodeList` and yields `checked ? value : null` for each, so a scene whose
  habitat, component-type or harvesting-skill boxes were all unticked submitted a *list of nulls* -- not an
  empty array, and not an absent key, so it was written. Our list normalizer then stringified them into
  literal `"null"` entries, because `String(null)` is truthy. The scene reported itself configured with
  twelve habitats that match no component, and gather returned only the components that have no habitat at
  all. Reachable without any of the case work: enabling Artificer on a scene and saving Scene Config from
  any tab was enough, since the fields submit whether or not the tab is visible. Nulls are now dropped
  before stringifying (`normalizeCheckboxList`), and habitat lists are filtered through the vocabulary so
  values that are not habitats cannot be counted as configuration.
- **Importing a component with lowercase habitats silently produced no habitats:** The import path filtered
  biomes through a case-sensitive membership test, so a payload supplying `"forest"` had it dropped without
  an error, producing a Component that can never be gathered. Values are normalized now rather than
  filtered.
- **Removed `getBiomeOptions`,** which had no callers.

### Fixed
- **13.2.0 shipped the pre-conversion compendiums:** The release was tagged before the converted pack files existed on disk. LevelDB does not write through on export — Foundry holds a pack open and compacts lazily, so the 266 converted recipes sat in an unflushed `.log` while `git status` reported `packs/` as clean. The new `.ldb` was only committed three commits after `BUILD 13.2.0`, so the release zip carried the old compendiums even though the development world was correct. No data was lost anywhere; the packs simply were not in the release. This build contains them.

## [13.2.0]

### Added
- **Recipes are a real data model, not parsed HTML:** Recipes are now `coffee-pub-artificer.recipe` journal pages with schema-validated fields in `page.system`, edited through a dedicated sheet. Previously a recipe's HTML was *both* its rendered output and its storage: `buildRecipePageHtml` wrote `<p><strong>Label:</strong> value</p>` and `RecipeParser` read those labels back. That made the template a schema — renaming a bolded label silently dropped that field from every recipe in every world, with no error and no failed validation, just a recipe that came back with less. The description remains the page's native `text.content`, so it keeps stock ProseMirror editing.
- **Every item-valued field on a recipe is a drop slot:** Result, apparatus, container and ingredients are filled by dragging an item in. Dropping an ingredient reads its Artificer type and family from the item's flags, so one gesture fills three fields. Storage is unchanged — names, never UUIDs — so a recipe still survives an item moving compendium, and still resolves at craft time.
- **A Process is an Artificer item:** `heat` and `grind` were hardcoded in six places — a fixed type list, two level-label maps, a boolean CSS class, a sound path, and a pile of `processType === 'heat' ? a : b`. A process is now a Tool in the new **Process** family carrying its own method name, four level positions (each with a label and a colour), a named animation and a sound. Nineteen ship in the Tools compendium — Heat, Boil, Bake, Steam, Brew, Steep, Stir, Tan, Forge, Assemble, Grind, Polish, Scribe, Stitch, Bind, Extract, Dry, Imbue and Attune — and a GM can author more without touching code.
- **Ten named crafting-bench motions:** `none`, `pulse`, `shake`, `strike`, `swirl`, `sweep`, `shimmer`, `settle`, `ring` and `blur`. Names describe the **motion, not the process**, so a ferment can pulse and a sieve can shake — naming an effect after the first process that used it is how the old `isGrinding` boolean happened. Each reads two custom properties and nothing else: `--process-level` (0–1, ramping as a craft runs down) and `--process-color` (the selected level's colour). Adding an effect is a CSS block plus a manifest entry, with no JavaScript change anywhere.
- **The animation vocabulary is a manifest, checked against reality:** `resources/process-animations.json` lists what a Process may choose. Because a manifest is only an *index* of CSS that must already exist, each animation's stylesheet sets a marker custom property and the loader probes for it — an entry with no CSS behind it is dropped and reported rather than being offered to a GM and then silently doing nothing.
- **Image and Process-family fields on the Artificer Item window:** Items are no longer created with a blank icon, which mattered once recipe slots, ingredient rows and the browser began rendering them. Setting Family to Process reveals the four level rows, the animation picker and the sound browser.
- **Recipe migration tooling:** `convert-recipes-to-subtype-macro.js` converts legacy text pages, dry-run by default, writing a backup file before any deletion and verifying each page after recreating it. `seed-processes-macro.js` creates the shipped processes, `repair-recipe-source-macro.js` fixes provenance, and `diagnose-processes-macro.js` reports why a process is not resolving.

### Changed
- **The Artificer Item window is on the Blacksmith Window API:** It extends `BlacksmithWindowBaseV2` via the API bridge, and its fields carry `blacksmith-input` / `blacksmith-select` / `blacksmith-textarea`. Three layers of Artificer CSS were overriding the shared styles — including `!important` background rules and a hard `height: 22px` in `shared.css` — which is why the window looked foreign next to other Blacksmith windows and why its open dropdowns rendered as browser-default grey. Those rules now stand down wherever a shared class is present.
- **"Create Component" is "Create Artificer Item":** The title interpolated the selected type while the Type dropdown sat directly beneath it, so it contradicted the form the moment you changed it.
- **One trait picker, shared:** The item window and the recipe sheet had drifted into different controls for the same idea. Both now use `systems/trait-picker.js`.
- **The crafting bench stores one process level, not one per process:** `heatValue` and `grindValue` were a field per hardcoded process, so a third had nowhere to put its value. Bench validation compares process **names** rather than a fixed pair, and level labels come from the process itself.
- **The bench opens with no process selected:** It defaulted to Heat, telling a crafter their recipe used Heat before they had chosen anything.

### Fixed
- **The item cache silently emptied itself on every refresh:** `refreshCache()` cleared its in-memory record map at the start and never refilled it — records were only ever restored by `loadFromPersisted()` on the *next page load*. So after a refresh, `getAllRecordsFromCache()` returned nothing while `getCacheStatus()` reported hundreds of items, and refreshing the cache actively made things worse while reloading the page fixed them. Nothing had read those records before now, which is why it had never surfaced.
- **Duplicate cache records broke the process cycler:** An item present in both a compendium and the world appears twice, so `indexOf` found the first copy and "next" landed on its twin — the button appeared dead while "previous" worked. Processes are now de-duplicated by id, honouring the existing `itemLookupOrder` setting rather than a hardcoded precedence.
- **A blank apparatus could be overwritten by the container:** The parser tested the parsed *value* rather than whether an `Apparatus:` label was present, conflating a modern page with a blank apparatus and a legacy page that predated the field split. On the import side, `containerName` fell back into `apparatusName` and duplicated a payload's container into both slots.
- **Legacy paths no longer discard an unrecognised process:** The recipe model nulled any `processType` outside `['heat','grind']` — data loss on read — while JSON import silently forced it to `'heat'`, so importing a Ferment recipe produced a Heat recipe with no error anywhere. Both now take the value verbatim.
- **A missing item-type mapping no longer retypes the document:** `deriveItemTypeFromArtificer` fell back to `{ type: 'consumable' }` for any family it did not know, so editing a Tool attempted to convert it to a consumable and dnd5e rejected the whole save. It returns null now; creation falls back to plain loot and editing preserves the document's own type.
- **Sources are no longer invented:** Three item paths and the recipe importer defaulted a blank `source` to `'Artificer'`, writing an attribution the author never gave. A default may supply a zero, never an attribution. The authoring window still stamps its own provenance, which is a fact rather than an invention.
- **Consumable activities are stored in dnd5e's shape:** `system.activities` was built as an array where dnd5e expects an object keyed by activity id, so a consumable with no activities was written as `[]`.
- **Traits could be stored as a single joined string:** The trait field round-tripped through a hidden comma-joined input, and Foundry's form parsing returned it as a one-element array — so a whole list became one trait. Traits are no longer a form field at all, and existing rows are repaired on read.
- **Images and motion no longer break out of their frames:** Any animation that moves, rotates or shrinks the icon now pre-zooms it so no gap can open between the image and its border — a rotating square dragged its corners through the frame, and a shrinking one exposed the background.

## [13.1.1]

### Fixed
- **Artificer tab missing from Scene Configuration:** Tab injection ran as an `async` render-hook callback that awaited the skills ruleset before appending anything. Foundry v13 replaces every template part on each render pass (`HandlebarsApplicationMixin#_replaceHTML` calls `priorElement.replaceWith`), so a render that landed during that await detached the nav and body nodes captured beforehand — the tab was then appended to orphaned DOM and never appeared, while the concurrency guard kept the newer render from injecting at all. Nothing threw and nothing logged. Injection is now synchronous end to end: the ruleset's harvesting skill ids are loaded and cached at `initialize()`, and the dual `renderSceneConfig`/`renderApplicationV2` registrations are deduped by checking for a live nav button *and* panel instead of by an in-flight mutex.
- **Artificer's failures were the only messages it hid:** Every failure report — `Error during initialization`, `Scene manager failed to initialize`, `Pins manager failed to initialize`, `Gather sockets failed to initialize`, `Blacksmith not available`, and the menubar registration failures — passed `blnDebug: true`, which Blacksmith reads as "print only when global debug mode is on". Every *success* message passed `false` and printed unconditionally. So a boot that failed looked identical to a boot that worked, which is why every round of this investigation began with "I see no errors". Failures now pass `false` and always print.
- **The logger no longer disappears exactly when it is needed:** `postBlacksmithConsole()` gave up silently when neither `module.api.utils` nor `window.BlacksmithUtils` was available. Both are unset whenever Blacksmith's ready chain bails early — the precise situation in which Artificer's managers fail — so the reports describing the failure were swallowed by the failure. It now falls back to `console`, still honouring the debug flag. `SceneManager._log` routed around the helper via the raw `BlacksmithUtils` global and so had the same blind spot; it now goes through the helper, and its third parameter is named `debug` rather than `isError`, which is what Blacksmith actually does with it.

- **Scene Config tab no longer depends on the socket handshake:** `SceneManager.initialize()` awaited `sockets.waitForReady()` before registering any hook, so a socket layer that never signalled ready silently took the Scene Config tab, the Scene Directory badge, and the flag-update broadcast with it — again with no error. Hook registration now happens first and socket setup follows; `_broadcastSceneArtificerUpdate` tolerates a socket that is not up yet.

## [13.1.0]

### Changed
- **Every chat card is now posted through the Blacksmith Chat Cards API:** All six posting sites — the explore/populate result, gather failure, gather empty-pool, gather result (success and perk consolation), craft result, and the GM "gathering not configured" whisper — call `chatCards.post({ moduleId, type, parts })` and describe the card as data instead of building HTML. Artificer no longer composes a card wrapper, passes a theme class, or escapes anything itself; Blacksmith owns the wrapper, the theme, escaping, the enrich pipeline, and per-client re-rendering, so a card posted now improves whenever the parts do. Each card carries a `type` (`explore-result`, `gather-failure`, `gather-empty`, `gather-result`, `craft-result`, `gather-not-configured`) stored on the message.
- **Card layouts rebuilt out of parts:** The four `gather-result-*` classes were invented before a list part existed and are replaced by `rows`, which also supplies the document link — supplying a `uuid` makes Blacksmith build the anchor, so the hand-written `@UUID[...]{...}` strings and the local `escapeHtml` are gone. The explore card's rarity breakdown moved from a comma-joined sentence into `tiles`, craft failure reasons into `notes`, and outcomes ("Nothing found", "Crafted", "Craft failed") into tinted `band` parts. Perks are a `section` divider plus one `rows` entry each, shared by the gather and craft cards.
- **Untrusted names travel as literal segments:** Item, actor, scene and perk names now reach the card as `{ literal: name }` inside an array of text segments rather than being interpolated into a string. Card text reads `**bold**` and `*italic*` and runs Foundry's enricher, so a name containing an asterisk previously swallowed the rest of the sentence and one containing `@UUID[...]` or `[[/r 1d20]]` was obeyed. A literal is escaped and shown exactly as given. Because a mark cannot open and close across a segment boundary, names are no longer emboldened in card prose — the emphasis was markup, and withholding markup is the point.

### Fixed
- **Cover scan no longer spams the console:** The `Cover scan` diagnostic in `window-crafting.js` passed `blnDebug: false`, which Blacksmith reads as "always print", so it emitted one line per recipe journal on every render of the crafting window — every open, filter toggle, and recipe selection. It is now gated behind `isBlacksmithDebugOn()` and passes `true`, matching its sibling `Cover scan failed`. The page walk that built the message moved into a `logCoverScan` helper, so the `DOMParser` sweep over every text page of every journal only runs when debug mode is on rather than on every render.
- **Craft failure no longer prints its reason twice:** `issues` fell back to `[lastResult.name]` when the caller supplied no array, so the headline failure appeared both as the failure line and as an "issue" beneath it. `name` carries the headline; `issues` carries only what the caller actually supplied.

### Added
- **`scripts/utils/chat-cards.js`:** `postArtificerCard()` resolves the API, sets the speaker from an optional actor, and stamps the module id and card type; `buildItemRows()` and `buildPerkParts()` hold the two compositions the gather and craft cards share. `buildItemRows()` passes a plain string label when a row carries a `uuid` (Blacksmith builds the anchor text itself) and a literal when it does not.
- **`isBlacksmithDebugOn()` in `utils/blacksmith-console.js`:** Reads Blacksmith's `globalDebugMode` setting behind a try/catch, returning `false` when the setting is not yet registered or Blacksmith is absent. For skipping the construction of a diagnostic that costs something to build — `postConsoleAndNotification` already suppresses the printing.

### Removed
- **`templates/card-results-gather.hbs` and `templates/card-results-craft.hbs`**, along with their `loadTemplates` entries. Their structure is now a parts composition.
- **The `gather-result-*` chat-card block in `styles/window-gather.css`** (~43 lines). Card styling belongs to the theme.
- **`buildChatCardHtml()` in `manager-gather.js`**, including its dead `announcement` branch. Blacksmith removed announcement themes on 2026-08-14; the branch had never run in any case, because all three call sites passed `'card'`.
- **`getChatCardPresentationFields()` in `utils/helpers.js`.** It existed to set the v13/v14 message style field by hand; `chatCards.post` sets `style` itself.
- **`plainText()`**, a stopgap that stripped asterisks from names. It rendered a name that was not the name and did nothing about enricher syntax; `{ literal }` replaces it properly.

### Notes
- Requires the Blacksmith release providing `chatCards.post` with `{ literal }` and segment text. Artificer already declares Blacksmith as a hard `requires`, so no fallback path is carried; a missing API logs and skips the post rather than throwing.
- Cards are visually different — theme-owned rows in place of the custom green item boxes, tinted outcome bands, and names in plain weight. Worth a look at each of the six before shipping.
- Two defects found in Blacksmith during the migration were reported and fixed upstream: inline marks had no escape hatch (now `{ literal }`), and the `rows` uuid path interpolated the label into `@UUID[...]` before enriching, so a name containing `}` closed the link early and the remainder was enriched. Artificer's usage needed no change for either. See `documentation/TODO.md`.

## [13.0.18]

### Changed
- **Compendium dropdowns now come from the Blacksmith API:** `getCompendiumChoices()` and `getJournalCompendiumChoices()` in `settings.js` were hand-rolled `game.packs.filter(...)` loops that each composed their own `"Package: Label"` display string via a private `packageLabel || package || packageName || "Unknown"` fallback chain. Both are now single calls to `api.compendiums.getAllChoices('Item')` and `getAllChoices('JournalEntry')`, removing ~30 lines and the label logic that could silently diverge from Blacksmith's `getPackPackageLabel()`. Pack IDs, the `none` sentinel, and the `-- None --` label are identical, so existing world settings resolve unchanged; the only visible difference is that entries now arrive sorted by package then pack name instead of in raw `game.packs` order.
- **`getAllChoices()`, not `getChoices()`:** These settings ask the GM to point Artificer at a specific pack for its own use — they are not meant to follow Blacksmith's search mapping. `getChoices()` returns only packs the GM nominated for name resolution, narrowed further by the enabled-source checkboxes and by content heuristics (a `JournalEntry` pack must pass `isPrimaryJournalCompendium()`). A recipe or ingredient pack deliberately kept out of the search mapping is exactly the pack a GM would want to select here, and `getChoices()` is structurally unable to offer it.
- **No availability guard on the API call:** Blacksmith is a hard `requires` relationship in `module.json` and publishes `module.api.compendiums` during `init`; `registerSettings()` runs at `ready`. There is no window in which the API is absent while Artificer is active, so no fallback path is carried.

### Added
- **Artificer's own packs are mapped by default:** A fresh world previously shipped with `numRecipeCompendiums: 0` — meaning no recipe compendium dropdowns were registered at all until the GM raised the count and reloaded — and `numIngredientCompendiums: 1` pointing at `none`. Artificer now crafts out of the box: `recipeCompendium1` defaults to `coffee-pub-artificer.recipes-blueprints`, and ingredient priorities 1–3 default to `coffee-pub-artificer.components`, `.creations`, and `.tools`. The enhanced pack variants remain opt-in, and `user-guide` is not mapped as a recipe source — it is documentation, and loading it would put doc pages through the recipe parser.
- **Slot defaults derived from the pack list:** `DEFAULT_RECIPE_PACKS` and `DEFAULT_INGREDIENT_PACKS` drive both the slot-count defaults (`default: DEFAULT_INGREDIENT_PACKS.length`) and each slot's individual default via `slotDefault(defaults, i)`, so the count and the mapping cannot drift apart when a pack is added. Raising the count past the number of shipped packs still yields `none` for the extra slots.

### Notes
- Defaults only apply where a world has never saved a value. Existing worlds keep their current compendium settings and are unaffected.
- Requires the Blacksmith release that introduces `api.compendiums.getAllPacks()` / `getAllChoices()`. Building against an earlier Blacksmith throws during settings registration.

## [13.0.17]

### Changed
- **Secondary bar now takes the Blacksmith house size:** Removed the hardcoded `height: 42` from `registerSecondaryBarType`. Blacksmith replaced the `height` key with `size` presets (`'default'` 30px / `'large'` 45px / `'xlarge'` 60px); `height` is ignored and logs a warning. Artificer passes no `size` at all, which resolves to the 30px default matching the primary menubar. The 42 added in 13.0.14 was buying room for group banners — banners are now added on top of the bar height instead of subtracted from it, so that room is free and the bar's type no longer has to inflate to get it. Bar height is a master scale factor: every font, icon, gap, and padding inside it derives from that number via `clamp()`, so labels and icons drop from 20px to 12px and match the menubar above.
- **Group banner colors set to earth tones:** Each group supplies its own `bannerColor` instead of inheriting Blacksmith's indigo default — Manage Artificer `rgba(120, 106, 84, 0.9)` (sand), Craft and Tinker `rgba(68, 100, 89, 0.9)` (verdigris), Gather and Harvest `rgba(51, 63, 20, 0.9)` (moss). Bar-level `groupBannerColor` set to the sand tone so any group added later inherits the palette rather than the indigo.
- **Secondary bar icons:** Skill Mapping `fa-seedling` → `fa-list`; Request Component Roll `fa-leaf` → `fa-dice-d20`; Forage and Scavenge `fa-binoculars` → `fa-leaf`.
- **`registerMenubarIntegration` is now async:** `registerSecondaryBarType` is an async method, so the call is awaited and the caller in `initializeModule` handles rejection via `.catch()` like the other initializers.
- **GM-only secondary bar items use visibility functions:** `visible: game.user.isGM` → `visible: () => game.user.isGM` on all five GM-restricted items. Blacksmith re-evaluates `visible` on every render and supports functions; a bare boolean froze the value at `ready`.

### Fixed
- **Menubar tool registered into the wrong group slot:** `registerMenubarTool` was passed `groupOrder: null`. Blacksmith only derives the group's order from its name when `groupOrder` is `undefined` — `null` skipped that lookup and then hit the `if (groupOrder < 1) groupOrder = 1` clamp, registering the `utility` group at order 1 (the `combat` slot) instead of 2. The key is now omitted so the name-based default applies.
- **Dead success guard on secondary bar registration:** `const barRegistered = blacksmith.registerSecondaryBarType(...)` captured a Promise rather than a boolean, so `if (!barRegistered)` was always false and a failed registration could never be reported. Resolved by the `await` above.

## [13.0.16]

### Fixed
- **Artificer tab injected multiple times in Scene Config for new unsaved scenes:** Two compounding issues caused the Artificer tab content to appear duplicated (up to 4× in Foundry v13). First, for new unsaved scenes `app.id` is null, bypassing the `_injectPendingAppIds` concurrent-call guard entirely and allowing multiple async inject calls to race past the DOM check. Second, Foundry v13 ApplicationV2 rebuilds the tab nav on every render pass but preserves the tab body container, so the stale-nav-button check always passed and a new panel was appended each time. Fixed by adding a `WeakSet` mutex keyed on the `form` DOM element (always available regardless of save state) and unconditionally removing any existing injected nav button and tab panel before re-appending, making injection idempotent.

## [13.0.15]

### Added
- **Sequential gathering spot placement:** "Populate Scene" now asks how spots should be placed before acting. **Random** places all spots immediately at scattered positions (previous behaviour). **Sequential** enters a click-to-place mode: a HUD indicator shows which spot the GM is placing and the count remaining; each left-click on the canvas assigns that position to the next spot; pressing Escape stops early. Any spots already placed in a partial session are saved; unplaced spots are discarded.
- **Crosshair cursor during sequential pin placement:** The canvas cursor changes to `crosshair` when sequential placement mode is active and restores to its previous value when placement finishes or is cancelled.
- **Pin design overrides via gathering ruleset JSON:** `runtimeDefaults.pinDesign` block added to `gathering-mapping-core.json`. When `overrideDefaultPinDesign: true`, all visual pin properties (`shape`, `dropShadow`, `fill`, `stroke`, `strokeWidth`, `iconColor`, `imageFit`, `imageZoom`, `textLayout`, `textDisplay`, `textColor`, `textSize`, `textMaxLength`, `textMaxWidth`, `textScaleWithPin`) are sourced from JSON and bypass the Blacksmith registered design. When `false` (default), the registered design wins and these fields are ignored.
- **`familyAliases` in gathering ruleset JSON:** Gathering image family name normalisation (e.g. `creaturepart` → `creature parts`, `ore` → `mineral`) is now driven by a `familyAliases` top-level section in the JSON rather than a hardcoded table in code. Hardcoded aliases remain as a silent fallback only if the JSON has no `familyAliases` section. The GM is warned once (per cache load) if a family/biome combination resolves to no images.
- **Player-initiated pin gathering:** Players can now double-click gathering spot pins directly to trigger the roll dialog without GM action. `PinsManager.initialize()` registers the `pins.on('doubleClick', …)` handler for all users (previously GM-only init path prevented registration on player clients). Roll processing and pin deletion remain GM-side via the existing `blacksmith.requestRollComplete` hook and `_processGatherRollOnGM`.
- **Concurrent gather guard:** `_gatherRequestInProgress` flag prevents the same client from opening a second gather roll dialog before the first resolves. Cleared via `finally` on every exit path. `clearGatheringSpotsForScene` also resets the flag to release any orphaned in-progress state when the GM clears the scene.

### Changed
- **"Populate Location" renamed to "Populate Scene"** in the Artificer secondary bar.
- **`populateGatheringSpotsForScene`** refactored: node list is built up-front then routed to `_populateRandom` or `_populateSequential` based on the GM's choice.
- **Gathering image mapping restructured to biome-first JSON (v3):** `gathering-mapping-core.json` bumped to `version: 3`. Structure is now `biomes[biome][idle|active][anyFamily|byFamily[family]]`; the `any` biome is the universal fallback. `runtimeDefaults` section moved to the top of the document.
- **`pinSize` and `pinDefaultImage` runtime defaults now wired to pin creation:** Previously these keys existed in `runtimeDefaults` but were ignored; pin creation used hardcoded local constants. They now read from `getGatherRuntimeDefaultsSync()` at creation time.
- **Pin ownership set to OBSERVER (`default: 2`):** Gather pins are created with `ownership: { default: 2 }` (OBSERVER). Blacksmith dispatches `doubleClick` events for OBSERVER-level players; OWNER (`3`) is not required and would grant unintended edit rights.
- **`PinsManager.initialize()` split by role:** GM-only operations (`isAvailable()` check, `registerPinType`, hook registration, initial sync) run only for GMs. The `pins.on('doubleClick', …)` handler registers for all users so players receive gather events.
- **`evt.userId` guard in double-click handler:** `pins.on()` fires on all connected clients; the handler now returns early if `evt.userId !== game.user.id` so only the clicking user's client initiates the gather flow.

### Fixed
- **Full hook coverage for external pin deletions:** `blacksmith.pins.deleted` fires for all single-pin deletions (right-click, Manage Pins, `pins.delete()` API) and includes `pinId` in the payload — Artificer now extracts it and removes the matching `discoveredNode` directly. Bulk deletions fire `blacksmith.pins.deletedAll` / `blacksmith.pins.deletedAllByType` — handled via a live `pins.list()` reconcile. All three hooks update scene flags on the GM side and reload the pin layer for the active canvas scene.
- **Gather spot cap not updating after external pin deletion:** Pins deleted externally left stale entries in `discoveredNodes`, causing the cap to count them as occupied. Fixed by reconciling `discoveredNodes` against live pins inside `populateGatheringSpotsForScene` before checking the cap.
- **Ghost pin recreation after harvest with stale nodes:** Stale `discoveredNodes` entries caused `syncScenePins` to recreate pins for nodes whose physical pins had been deleted. Fixed by reconciling remaining nodes against live pins inside `_deleteGatherPin` after removing the harvested node.
- **Gathering spot images randomising on every sync:** `resolveGatheringImageForScene` uses `Math.random()`, so each `syncScenePins` call produced a different image for every pin. Fixed by storing `idleImage` in node data at creation time and using `node.idleImage || pin.image` in the update path — existing pins keep their committed image.
- **`_gatherRequestInProgress` flag not reset on early return:** Setting the flag before validation checks (proximity, no tokens, scene not configured) and only resetting it inside the inner `try/finally` left it permanently `true` if any check failed before reaching the `try` block. The entire function body is now wrapped in an outer `try/finally` so every exit path resets the flag.
- **Pin double-click harvest no longer working after 13.0.15:** Removing the `gather-spot` runtime `registerPinType` call broke Blacksmith's event dispatch. Restored `registerPinType` for `gather-spot` for event-callback compatibility; new pins are still created as `component-location`.
- **Scene config tab not appearing:** Regression where over-simplifying the `_injectArtificerTabV2` filter removed the `appName === 'SceneConfig'` check — the only reliable path in Foundry v13 where `renderSceneConfig` may not fire for AppV2. Restored.
- **Scene config Artificer tab blank on reopen when last active:** Foundry falls back to the first tab when the injected tab doesn't exist in the DOM yet; by the time `_syncInjectedTabState` ran, the fallback tab was used to drive `tabs.activate()`. Fixed by capturing `tabs.active` before `tabs.bind()` and honouring it if it was `'artificer'`.


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
- **Journal filter locked marker:** Journal dropdown options now prefix journals that contain perk-locked recipes with a Unicode lock character (U+1F512), which works with native select/option rendering.
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

