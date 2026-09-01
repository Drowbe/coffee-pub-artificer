# Getting started with Artificer

**Audience:** someone playing or running a game with Artificer

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

![The Artificer menubar](../assets/artificer-menubar.webp)

**Craft and Tinker** — visible to everyone.

| | |
|---|---|
| Crafting Station | The bench. Load a recipe, add ingredients, run the process. |
| Recipes and Blueprints | Browse every recipe your world knows about. |
| Skill Mapping | Which character skills apply to crafting and gathering. |

**Recipes and Blueprints** lists everything craftable, with what each one needs.

![The recipe browser](../assets/artificer-recipe-browser.webp)

**Skill Mapping** shows which character skills back each crafting and gathering skill, so a player can
see what a Herbalism check actually rolls.

![Skill mapping](../assets/artificer-skillmapping.webp)

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

**1. Set the scene's habitat.** Open Scene Configuration and go to the **Geography** tab -- this is
Blacksmith's tab, not Artificer's.

![The Geography tab, where habitat is set](../assets/artificer-scene-geography.webp)

**Habitat is global, and Artificer only reads it.** It is set once on the Geography tab and belongs to
Blacksmith, because it describes the scene as a *place* rather than as a gathering site. Other Coffee Pub
modules read the same value for their own purposes -- Minstrel uses it to choose ambient audio -- so
setting Forest on a scene tells the whole suite where it is, not just Artificer.

That is why there is no habitat control on the Artificer tab. Artificer has no opinion about where a scene
is; it asks Blacksmith and decides what can be found there. If the habitats are wrong, change them on the
Geography tab and every module follows.

**2. Turn Artificer on for the scene and configure harvesting.** Next tab along:

![The Artificer tab](../assets/artificer-scene-configuration.webp)

- **Enable Artificer Features** -- the master switch. Nothing is gathered on this scene until it is ticked.
- **Habitats** -- shown here read-only, exactly as set on the Geography tab, so you can confirm without
  switching tabs.
- **Component Types** -- which families can be found: Creature Part, Environmental, Essence, Gem, Mineral,
  Plant.
- **Harvesting Skills** -- which skills a character may roll here. Untick one and it cannot be used on this
  scene.
- **Discovery DC Thresholds** -- a Base DC plus an offset per rarity. Rolls are checked from Legendary
  down through Very Rare, Rare, Uncommon and Common, so a high roll can turn up something rare and a
  modest one still finds common material.
- **Harvest DC** -- the difficulty of working a spot once found, 0 to 20.
- **Gather Spots** -- how many discovered spots the scene may hold at once, up to 30.
- **Discovery Radius** -- how close to the rolling token new spots appear, 5 to 300 feet.

A scene needs Artificer enabled, at least one habitat, and at least one component type before anything can be found. Miss any of the three and foraging returns nothing, with no error to tell you which. The scene directory shows a marker on
scenes that are configured, so you can see at a glance which ones you have set up.

## Gathering, in play

**Forage and Scavenge** searches the scene. Successful rolls reveal gathering spots as pins on the map;
what can be found is drawn from components whose habitat matches the scene and whose family is one you
allowed. A component with no habitat set can be found anywhere.

**Gather and Harvest** works a spot. Success adds the component to the character's inventory; the spot is
consumed.

If foraging turns up nothing, check the three preconditions above before anything else.

## Crafting

Open the **Crafting Station**.

![The Crafting Station](../assets/artificer-crafting-station.webp)

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

**Create Artificer Item** opens the authoring window.

![Creating an Artificer item](../assets/artificer-createitem.webp)

Every Artificer item has:

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

An Artificer item is also a real D&D 5e item, and its Artificer fields appear as a block on the normal
item sheet rather than in a separate window.

![Artificer properties on a 5e item sheet](../assets/artificer-item-embeded.webp)

A healing herb can be chewed, a poison applied, a crystal used — give it the item type and activities that
effect needs rather than reducing it to a trinket. Only raw ores and pure reagents with no use effect are
correctly plain loot.

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
