# Coffee Pub Artificer — User Guide

Artificer adds gathering, recipes and crafting to a D&D 5e world. Players forage a scene for raw
components, and turn what they find into potions, poisons, food, materials and gear by working a recipe at
a crafting station.

This guide covers running it. For how it is built, see Artificer in the architecture section.

## Before you start

**Coffee Pub Blacksmith is required.** Artificer is a consumer of it, not a companion to it — Blacksmith
owns the menubar Artificer lives in, the chat cards it posts, the map pins it drops, and the scene
information it reads. If Blacksmith fails to load, Artificer will refuse to start and say so rather than
run half-configured. See "When something is wrong" at the end.

**Artificer ships its own content.** Four compendiums install with the module: components, creations,
tools and recipes. A new world can craft immediately without any authoring. "Enhanced" variants of the
component and creation packs ship alongside the core ones and are opt-in — they are not enabled by
default, so a world that wants the smaller set gets it.

## Where everything lives

Artificer has one entry point: the **hammer icon** in the Blacksmith menubar. Clicking it opens a bar of
tools in three groups.

**Craft and Tinker** — visible to everyone.

| | |
|---|---|
| Crafting Station | The bench. Load a recipe, add ingredients, run the process. |
| Recipes and Blueprints | Browse every recipe your world knows about. |
| Skill Mapping | Which character skills apply to crafting and gathering. |

**Gather and Harvest** — visible to everyone except where noted.

| | |
|---|---|
| Forage and Scavenge | Search the current scene for gathering spots. Finds them; does not collect. |
| Gather and Harvest | Work a spot you have found and collect what is there. |
| Request Component Roll | GM only. Ask a player to roll against a component. |

**Manage Artificer** — GM only.

| | |
|---|---|
| Create Artificer Item | Author a component, creation or tool. |
| Import Recipes | Bring recipes in from JSON. |
| Populate Scene | Place gathering spots on the current scene directly. |
| Clear Locations | Remove them again. |

## Setting up a scene for gathering

Gathering is per-scene, and a scene needs two things before anything can be found there.

**1. Set the scene's habitat.** Open Scene Configuration and go to the **Geography** tab — this is
Blacksmith's, not Artificer's. Choose one or more habitats: Forest, Mountain, Coastal, Underdark and so on.

Habitat lives with Blacksmith because it describes the scene as a *place*, and more than one module reads
it — Minstrel uses the same value to choose ambient playlists. Setting it once serves all of them. The
Artificer tab shows the habitats currently set and points you here to change them.

**2. Configure harvesting on the Artificer tab.** Same window, next tab along:

- **Component Types** — which families can be found here: Plant, Mineral, Gem, CreaturePart,
  Environmental, Essence. Leave them all ticked unless a scene should only yield certain kinds.
- **Harvesting Skills** — which skills a character may roll. Defaults come from your selected skills
  ruleset.
- **Gathering Spots** — how many discoverable spots the scene holds.
- **Discovery DC** and **Harvest DC** — how hard it is to find a spot, and to work it once found.
- **Discovery offsets by rarity** — how much harder rarer components are to spot.
- **Discovery radius** — how close a token must be.

A scene with a habitat and at least one component type is ready. The scene directory shows a marker on
scenes that are configured, so you can see at a glance which ones you have set up.

## Gathering, in play

**Forage and Scavenge** searches the scene. Successful rolls reveal gathering spots as pins on the map;
what can be found is drawn from components whose habitat matches the scene and whose family is one you
allowed. A component with no habitat set can be found anywhere.

**Gather and Harvest** works a spot. Success adds the component to the character's inventory; the spot is
consumed.

If foraging turns up nothing, the usual cause is a scene with no habitat, no component types ticked, or a
component pool that has nothing matching both.

## Crafting

Open the **Crafting Station**.

1. **Load a recipe.** Recipes come from your recipe compendiums and from journals in the world.
2. **Add ingredients.** Drag items from an actor's inventory into the bench. The recipe lists what it
   wants; the bench tells you what you are missing.
3. **Fit the apparatus and container**, if the recipe calls for them — a still, a mortar, a vial.
4. **Choose the process and its intensity.** A process is how the work is done: Heat, Grind, Brew, Steep,
   Ferment, Forge, Imbue and others. Each has four intensity positions with its own names — a heat runs
   Off / Low / Medium / High, a grind runs Off / Coarse / Medium / Fine — and the recipe specifies which
   one it needs.
5. **Craft.** The station rolls the crafting skill against the recipe's difficulty. Success produces the
   result; failure consumes the ingredients.

Recipes you lack the equipment for can be hidden with the "show only recipes I have kit for" toggle, which
is remembered between sessions.

## Authoring content

### Items

**Create Artificer Item** opens the authoring window. Every Artificer item has:

- **Type** — Component (raw, found in the world), Creation (crafted), or Tool (the apparatus, containers
  and processes that do the work).
- **Family** — the kind within the type. A Component may be a Plant, Mineral, Gem, CreaturePart,
  Environmental or Essence; a Creation may be Food, Material, Poison or Potion; a Tool may be an
  Apparatus, Container or Process.
- **Traits** — two to five words describing what the item is good for. These drive recipe matching, so
  choose them as data rather than flavour.
- **Skill Level** — crafting difficulty from 1 to 20.

Components additionally take **habitats** — where they occur — and an optional **quirk**. An Essence takes
an **affinity**. A Component with no habitat can never be gathered, and an Essence with no affinity can
never be matched by a recipe, so both are required.

An Artificer item is also a real D&D 5e item. A healing herb can be chewed, a poison applied, a crystal
used — give it the item type and activities that effect needs rather than reducing it to a trinket. Only
raw ores and pure reagents with no use effect are correctly plain loot.

### Processes

A process is an item, so you can author new ones without touching code. Set Family to **Process** and the
window reveals its fields: four intensity positions each with a label and a colour, a named animation the
crafting bench plays, an optional sound, and whether full intensity is unstable.

Animation names describe the **motion**, not the process — pulse, shake, strike, swirl, sweep, shimmer,
settle, ring, blur — so a ferment can pulse and a sieve can shake. Nineteen processes ship in the tools
compendium.

### Recipes

Recipes are journal pages with a dedicated editor. Every item-valued field is a drop target: drag an item
onto the result, apparatus, container or ingredient slots to fill them. Dropping an ingredient reads its
type and family from the item, so one gesture fills three fields.

**Import Recipes** brings recipes in from JSON, and Artificer's item fields are also available through
Blacksmith's JSON importer — tick "Artificer Item" when importing items to get the full block.

## Settings

Under Configure Settings, Module Settings:

| | |
|---|---|
| Recipe compendiums | Which journal compendiums hold recipes, in priority order. |
| Ingredient compendiums | Which item compendiums hold components and tools. |
| Item lookup order | Whether world items or compendium items win when both exist. |
| Gathering ruleset | The JSON driving habitat images and gathering defaults. |
| Skills ruleset | The JSON mapping character skills to crafting and gathering. |

The shipped compendiums are pre-selected, so a new world works without touching any of this.

**Item lookup order** matters more than it looks. A component often exists twice — once in the shipped
compendium, once imported into your world. This setting decides which one a recipe resolves to, and
changing it changes what crafting consumes.

## When something is wrong

**"Artificer: not starting"** — Blacksmith failed to initialise, and the message names the stage that
failed. The problem is in Blacksmith, not here. Look for Blacksmith errors above that line in the console
(F12). Artificer refuses to start rather than run degraded because a half-started module leaves settings
that cannot be repaired without a fresh world.

**Foraging finds nothing** — check the scene has a habitat on the Geography tab, has component types
ticked on the Artificer tab, and that your component pool contains items matching both.

**A recipe cannot find an ingredient** — recipes store ingredients by name. If an item was renamed, the
recipe no longer matches it. Check the item lookup order setting if you have two copies.

**Items are missing from the crafting or gathering lists** — Artificer keeps a cache of item data. If it
looks stale, reload the world; the cache is rebuilt on load.
