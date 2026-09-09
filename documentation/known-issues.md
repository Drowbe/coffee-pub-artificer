# Known issues

**Audience:** anyone using Artificer or deciding whether to

Defects and gaps that are real today. Things we intend to build but have not started are not listed here
unless the module currently *implies* they work -- a half-present feature is a defect; an absent one is
not.

## Features the interface implies but does not deliver

**Skill progression and XP do nothing.** The Skill Mapping window shows crafting skills and their perks,
and perks apply correctly during crafting and gathering. There is no mechanism that raises a character's
skill level through use. Advancement is the GM's to adjudicate.

**Skill-level gating is not enforced.** A recipe carries a skill level and it sets the difficulty, but a
character below that level is not prevented from attempting the recipe. They are limited by the roll
alone.

**Custom ingredients in journals do not work.** `IngredientStorage._loadFromJournals` is an empty method,
so ingredients are read only from compendiums. The method's name implies otherwise, and the architecture
overview describes journal-based custom ingredients that have never existed.

**Blueprints have no editor.** The browser lists them and crafting reads them, but there is no authoring
form -- a blueprint is written as a journal page directly. Recipes do have an editor.

**The full experimentation model is not built.** Trait-based matching works. Solvent selection, quantity
inputs, and temperature-and-time control are designed and not implemented.

**Workstations are designed and not implemented.** Nothing in the module places or reads one yet.

## Behaviour worth knowing before it surprises you

**Recipes match ingredients by name, not by link.** This is deliberate -- a recipe survives an item moving
between compendiums, and resolves at craft time. The cost is that **renaming an item silently breaks every
recipe that names it**, and the failure looks identical to the character simply not having the ingredient.

**Item lookup order decides which copy of an item is used.** A component usually exists twice: once in the
shipped compendium, once imported into a world. The setting decides which one a recipe resolves to and
therefore which one crafting consumes. Getting it wrong produces no error, only crafting that uses a
version you did not mean.

**A crafting skill named in a recipe is not validated.** Skills come from a user-configurable ruleset, so
there is no fixed list to check against. A typo in a recipe's skill name produces a recipe whose perks
never apply, rather than an error.

**Artificer refuses to start if Blacksmith failed to initialize.** This is intentional. Habitat comes from
Blacksmith, and settings registration cannot be retried once it has run, so a partially-started Artificer
would leave permanently unusable settings. The notification names the Blacksmith stage that failed; that
is where to look.

## Foundry v14

Artificer is verified on Foundry v14 (measured on 14.367 with dnd5e 5.3.3) and still runs on v13. No
behaviour differs between them.

**Two `Dialog` call sites are deprecated rather than broken.** `utils/helpers.js` and `window-skills.js`
still construct the v1 `Dialog`, which Foundry has deprecated with a v16 horizon. It resolves and works on
v14; migrating both to `DialogV2` is scheduled work, not a defect you will see.

**One dead hook registration is kept on purpose.** `renderItemSheet` does not fire on Foundry 14.367 with
dnd5e 5.3.3 -- dnd5e emits `renderItemSheet5e` there instead. Artificer also registers the core
`renderDocumentSheetV2`, which does fire, so the Artificer block on item sheets renders normally. The dead
registration stays because a system using an older sheet class fires only the old name.

## Data left behind by older versions

**Some scenes may carry junk habitat, component-type or harvesting-skill flags.** Foundry writes one
`null` per unticked box in a checkbox group, and an earlier version of Artificer turned those into literal
`"null"` strings. A scene configured before that fix may hold entries that are not real values.

Nothing is broken by leaving them: current code filters them out, and such a flag reads as empty rather
than as configuration. No repair pass is required.

**Scenes still carry `enabled` and `profile` flags.** Both controls were removed. The flags are left on the
documents deliberately -- deleting data is not reversible -- and nothing reads them.
