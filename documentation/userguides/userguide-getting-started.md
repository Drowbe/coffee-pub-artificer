# Getting started with Artificer

**Audience:** someone playing or running a game with Artificer

Artificer adds gathering, recipes and crafting to a D&D 5e world. Players forage a scene for raw
components, and turn what they find into potions, poisons, food, materials and gear by working a recipe at
a crafting station.

This is the first five minutes. Each part has its own guide, linked as it comes up.

## Before you start

**Coffee Pub Blacksmith is required.** Artificer is a consumer of it, not a companion to it -- Blacksmith
owns the menubar Artificer lives in, the chat cards it posts, the map pins it drops, and the scene
information it reads. If Blacksmith fails to load, Artificer refuses to start and says so rather than
running half-configured.

**Artificer ships its own content.** Four compendiums install with the module: components, creations,
tools, and recipes and blueprints. A new world can craft immediately without any authoring and without
touching [Settings](userguide-settings.md).

## Where everything lives

One entry point: the **hammer icon** in the Blacksmith menubar.

![The Artificer menubar](../assets/artificer-menubar.webp)

It opens a bar of tools in three groups.

**Craft and Tinker**, visible to everyone.

| | |
|---|---|
| Crafting Station | The bench. See [Crafting](userguide-crafting.md). |
| Recipes and Blueprints | What can be made. See [Recipes and blueprints](userguide-recipes.md). |
| Skill Mapping | Crafting skills and perks. See [Skills and perks](userguide-skills.md). |

**Gather and Harvest**, visible to everyone except where noted.

| | |
|---|---|
| Forage and Scavenge | Search a scene for gathering spots. |
| Gather and Harvest | Work a spot you have found. |
| Request Component Roll | GM only. |

See [Gathering and harvesting](userguide-gathering.md).

**Manage Artificer**, GM only.

| | |
|---|---|
| Create Artificer Item | Author a component, creation or tool. |
| Import Recipes | Bring recipes in from JSON. |
| Populate Scene | Place gathering spots directly. |
| Clear Locations | Remove them again. |

See [Authoring content](userguide-authoring-content.md).

## Your first five minutes

**1. Give a scene a habitat.** Open Scene Configuration, go to the **Geography** tab -- this is
Blacksmith's tab, not Artificer's -- and tick one or more habitats.

That is the only thing a scene needs. There is no switch to turn Artificer on for a scene; installing the
module is the opt-in. A scene with a habitat and nothing else configured yields every component family
that habitat supports.

**2. Forage.** With a token on that scene, use **Forage and Scavenge**. Successful rolls place gathering
spots as pins.

**3. Harvest one.** **Gather and Harvest** works a spot and puts the component in the character's
inventory.

**4. Craft something.** Open the **Crafting Station**, load a recipe, drag ingredients from the
character's inventory onto the bench, set the process and its intensity, and craft.

If any of those four steps does nothing, the answer is almost certainly in that step's guide rather than
here.

## Where to go next

- **[Crafting](userguide-crafting.md)** -- the bench, processes, and what success and failure produce.
- **[Recipes and blueprints](userguide-recipes.md)** -- reading them, writing them, importing them.
- **[Gathering and harvesting](userguide-gathering.md)** -- scene setup and the discovery loop.
- **[Authoring content](userguide-authoring-content.md)** -- your own components, tools and processes.
- **[Skills and perks](userguide-skills.md)** -- crafting skills, and what is not built yet.
- **[Settings](userguide-settings.md)** -- compendiums, rulesets, and the lookup-order trap.
