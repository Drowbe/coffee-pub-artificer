# Settings

**Audience:** a GM configuring Artificer

Configure Settings, then Module Settings, then Coffee Pub Artificer. **A new world needs none of this** --
the shipped compendiums are pre-selected and Artificer works out of the box. Change these when you want
your own content, or a different ruleset.

## Where recipes come from

| Setting | What it does |
|---|---|
| **Recipe journal name** | The world journal Artificer reads recipes from and writes them to. |
| **Recipe journal folder** | Which folder that journal lives in. |
| **Number of recipe compendiums** | How many compendium slots to offer, up to ten. |
| **Recipe compendium 1..N** | The compendiums themselves, in priority order. |
| **Recipe lookup order** | Whether the world journal or the compendiums win when both hold a recipe. |
| **Recipe storage source** | Where newly created recipes are written. |
| **Blueprint journal** | The world journal holding blueprints. |

## Where components and tools come from

| Setting | What it does |
|---|---|
| **Number of ingredient compendiums** | How many slots to offer, up to ten. |
| **Ingredient compendium 1..N** | The compendiums, in priority order. |
| **Ingredient storage source** | Where newly created items are written. |
| **Item lookup order** | Whether world items or compendium items win when both exist. |

**Item lookup order deserves attention.** A component very often exists twice -- once in the shipped
compendium, once imported into your world. This setting decides which copy a recipe resolves to, and
therefore which one crafting consumes. It is also what lets you modify shipped content: import an item,
edit it, and set the order so the world copy wins.

Getting it wrong does not produce an error. It produces crafting that uses a version of an item you did
not mean.

## Rulesets

| Setting | What it does |
|---|---|
| **Skills ruleset** | The JSON defining crafting skills, perks and their benefits. |
| **Gathering ruleset** | The JSON defining gathering defaults and per-habitat imagery. |
| **Item translation** | The JSON mapping imported item vocabulary onto Artificer's. |

Artificer ships a core file for each. Point a setting at your own to change the rules without touching
code -- see [Skills and perks](userguide-skills.md) for what the skills file controls.

## Things Artificer remembers

These are not configuration; they are state the module stores so windows reopen the way you left them.
You will not normally touch them.

| Setting | What it holds |
|---|---|
| **Item cache** | A persisted index of item data, rebuilt on load. |
| **Gather window settings** | The last habitats, families, skills and DC used. |
| **Skills window: hide unavailable** | The toggle's last state. |
| **Crafting window: show only recipes I have kit for** | The toggle's last state. |
| **Last recipe source / license** | Provenance carried between authoring sessions. |

**If crafting or gathering lists look stale**, the item cache is the likely cause. It is rebuilt when the
world loads, so reloading is the fix.

## What is not a setting

**Habitat is not configured here.** It is set per scene on Blacksmith's Geography tab, because it belongs
to the scene rather than to Artificer -- see [Gathering](userguide-gathering.md).

**There is no per-scene enable.** Installing the module is the opt-in; every scene with a habitat can be
gathered from, and the Artificer tab on a scene narrows that rather than switching it on.
