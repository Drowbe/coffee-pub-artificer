# Crafting

**Audience:** someone playing or running a game with Artificer

Crafting is what Artificer is for. A character takes a recipe, puts the right ingredients on the bench,
fits whatever apparatus the recipe calls for, sets the process running at the right intensity, and rolls
against the recipe's difficulty.

Open the **Crafting Station** from the hammer icon in the menubar.

![The Crafting Station](../assets/artificer-crafting-station.webp)

## The bench

The station has three areas: the recipe you are working, the bench itself, and the feedback the bench
gives you about whether what you have assembled will work.

**Load a recipe.** Recipes come from your recipe compendiums and from journals in the world. The recipe
tells you what it needs; you are filling that list.

**Add ingredients.** Drag items from the character's inventory onto the bench. Ingredients are matched by
name, so the item has to be the thing the recipe asks for, not merely something similar.

**Fit the apparatus and container.** Some recipes need a still, a mortar, a vial. If the recipe names one
and it is not on the bench, the craft will fail before it is rolled.

**Choose the process and its intensity.** A process is how the work is done. Each one has four intensity
positions with its own vocabulary -- a heat runs Off, Low, Medium, High; a grind runs Off, Coarse, Medium,
Fine -- and the recipe specifies which position it wants.

Turn on **show only recipes I have kit for** to hide anything you cannot currently attempt. The setting is
remembered between sessions.

## What happens when you craft

There are three outcomes, and only one of them involves a roll.

**The bench does not match the recipe.** No roll happens at all. You get **Experimenter's Sludge** and the
ingredients are gone. This is not a failed roll -- it is the bench telling you the assembly was wrong
before it tried. Check the recipe's apparatus, container, process and intensity against what you set.

**The roll fails.** The craft produces sludge instead of the result. By default the ingredients are
consumed; certain skill perks reduce that to half, in which case the bench tells you which ingredients
survived.

**The roll succeeds.** The result is created and added to the character's inventory. A critical success
can multiply the output if the character has a perk that grants it.

Sludge is a real item, so a run of bad luck leaves a visible trail in the inventory rather than nothing at
all.

## What decides the difficulty

The recipe carries a skill and a skill level. The station resolves the DC from your skills ruleset, then
applies whatever perks the character has learned in that skill -- some shift the DC, some change how long
the work takes, some change what a failure costs.

If a recipe names a crafting skill the character does not have, they can still attempt it; the perks
simply do not apply. Skill-level gating is not implemented yet, so a low-skill character is limited by the
roll rather than blocked from trying.

## When a craft will not work

**"No recipe"** -- nothing is loaded on the station.

**Sludge with no roll** -- the bench did not match the recipe. The most common causes are a missing
apparatus, the wrong process, or the right process at the wrong intensity.

**An ingredient will not drop** -- the bench takes items from the character's inventory. Check the
character actually has it, and that the name matches what the recipe names.

**A recipe you expect is missing** -- check your recipe compendium settings, and see
[Recipes and blueprints](userguide-recipes.md).
