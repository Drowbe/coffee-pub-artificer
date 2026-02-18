# Recipe Migration Reference

**Source:** Potion Brewing and Ingredient Gathering for DnD 5e (piccolo917, GM Binder)

This document defines the fields needed for Coffee Pub Artificer recipe import and provides migration blocks for every recipe from the source document.

---

## Artificer Recipe Schema (Import Fields)

These fields come from `scripts/schema-recipes.js` and `scripts/data/models/model-recipe.js`. A future recipe import utility should populate them.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (UUID). Generated at import if not provided. |
| `name` | string | Recipe name |
| `resultItemUuid` | string | UUID of the resulting Item document. At migration time, use `resultItemName` to match by name until items exist. |
| `ingredients` | Array | See `RecipeIngredient` below |

### RecipeIngredient (per ingredient)

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | `'ingredient'` (Artificer), `'component'`, `'essence'`, or `'item'` (any D&D item by name) |
| `name` | string | Ingredient/component/essence/item name |
| `quantity` | number | Required quantity |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | `Consumable` | Item type: Weapon, Armor, Consumable, Tool, Gadget, Trinket, ArcaneDevice |
| `category` | string | `''` | Category within type (e.g., "Potion", "Oil", "Poison") |
| `skill` | string | `Alchemy` | Herbalism, Metallurgy, Artifice, Alchemy, MonsterHandling |
| `skillLevel` | number | 0 | Minimum skill level (0–100) |
| `workstation` | string\|null | null | Required workstation UUID or name |
| `tags` | string[] | [] | Recipe tags |
| `description` | string | `''` | Recipe description/notes |
| `source` | string | `''` | Source journal UUID |
| `journalPageId` | string | `''` | Journal page ID within source |

---

## GM Binder Extension Fields (Optional)

The source document uses additional metadata. Consider supporting these in import or as recipe flags:

| Field | Type | Description |
|-------|------|-------------|
| `tool` | string | Required kit: Alchemist's Supplies, Herbalism Kit, Poisoner's Kit |
| `dc` | number | Crafting check DC (8=Common, 12=Uncommon, 15=Rare, 18=Very Rare) |
| `workHours` | number | Hours to craft (8, 24, 80, 240) |
| `goldCost` | number | Gold cost after ingredient deduction (25, 100, 500, 1000) |
| `productValue` | number | Product market value in gp (50, 200, 1000, 2000) |
| `rarity` | string | Common, Uncommon, Rare, Very Rare |
| `resultItemName` | string | Fallback when resultItemUuid not yet available—match by name |
| `isHomebrew` | boolean | True if marked with * in source (non-official D&D item) |

---

## Tool-to-Skill Mapping

| GM Binder Tool | Artificer Skill |
|----------------|-----------------|
| Alchemist's Supplies | Alchemy |
| Herbalism Kit | Herbalism |
| Poisoner's Kit | Alchemy |

---

## Recipe Blocks

Each block uses the schema fields. `resultItemName` is provided for matching; `resultItemUuid` must be set when the target item exists in the world.

### Alchemist's Supplies

#### Common (DC 8, 8 hrs, 25 gp cost, 50 gp value)

```
name: Alchemist's Fire
resultItemName: Alchemist's Fire
type: Consumable
category: Alchemical
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 8
workHours: 8
goldCost: 25
productValue: 50
rarity: Common
ingredients:
  - { type: ingredient, name: Fire Peas, quantity: 1 }
  - { type: item, name: Flask of Oil, quantity: 1 }
description: Sticky adhesive fluid that ignites when exposed to air. 1d4 fire damage per turn until extinguished (DC 10 DEX).
```

```
name: Bottled Breath
resultItemName: Bottled Breath
type: Consumable
category: Alchemical
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 8
workHours: 8
goldCost: 25
productValue: 50
rarity: Common
ingredients:
  - { type: ingredient, name: Air Elemental Wisp, quantity: 1 }
description: Breath of elemental air. Exhale for gust of wind; hold to not breathe for 1 hour.
```

```
name: Blasting Powder
resultItemName: Blasting Powder
type: Consumable
category: Alchemical
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 8
workHours: 8
goldCost: 25
productValue: 50
rarity: Common
ingredients:
  - { type: ingredient, name: Flame Lily, quantity: 1 }
  - { type: item, name: Charcoal, quantity: 1 }
description: Volatile powder. DC 13 DEX save, 3d6 bludgeoning within 5 ft.
```

```
name: Fake Blood
resultItemName: Fake Blood
type: Consumable
category: Alchemical
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 8
workHours: 8
goldCost: 25
productValue: 50
rarity: Common
isHomebrew: true
ingredients:
  - { type: ingredient, name: Bloodroot, quantity: 1 }
description: Looks, smells, tastes like real blood. Investigation 15+ or identification magic reveals true nature.
```

```
name: Grenade, smoke
resultItemName: Grenade, smoke
type: Consumable
category: Alchemical
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 8
workHours: 8
goldCost: 25
productValue: 50
rarity: Common
ingredients:
  - { type: ingredient, name: Flame Lily, quantity: 1 }
  - { type: ingredient, name: Frost Lichen, quantity: 1 }
description: Creates heavily obscured 20-ft radius. Moderate wind disperses in 4 rounds.
```

```
name: Ink, Spell Writing (common)
resultItemName: Ink, Spell Writing (common)
type: Consumable
category: Alchemical
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 8
workHours: 8
goldCost: 25
productValue: 50
rarity: Common
isHomebrew: true
ingredients:
  - { type: item, name: Charcoal, quantity: 1 }
description: 1 oz bottle for Level 1-3 spells (scrolls and books).
```

```
name: Potion of Climbing
resultItemName: Potion of Climbing
type: Consumable
category: Potion
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 8
workHours: 8
goldCost: 25
productValue: 50
rarity: Common
ingredients:
  - { type: ingredient, name: Giant Wolf Spider Hair, quantity: 2 }
description: Climbing speed equal to walking speed for 1 hour; advantage on Athletics (climb).
```

```
name: Potion of Swimming
resultItemName: Potion of Swimming
type: Consumable
category: Potion
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 8
workHours: 8
goldCost: 25
productValue: 50
rarity: Common
isHomebrew: true
ingredients:
  - { type: ingredient, name: Quipper Scale, quantity: 3 }
description: Swimming speed equal to walking speed for 1 hour; advantage on Athletics (swim).
```

```
name: Soothsalts
resultItemName: Soothsalts
type: Consumable
category: Alchemical
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 8
workHours: 8
goldCost: 25
productValue: 50
rarity: Common
ingredients:
  - { type: ingredient, name: Soothsalt Geode, quantity: 1 }
description: Advantage on Intelligence checks for 1d4 hours. DC 15 CON save or 1 level exhaustion per dose.
```

#### Uncommon (DC 12, 24 hrs, 100 gp cost, 200 gp value)

```
name: Ink, Spell Writing (Uncommon)
resultItemName: Ink, Spell Writing (Uncommon)
type: Consumable
category: Alchemical
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 12
workHours: 24
goldCost: 100
productValue: 200
rarity: Uncommon
isHomebrew: true
ingredients:
  - { type: item, name: Charcoal, quantity: 1 }
  - { type: item, name: Finely Ground Iron, quantity: 1 }
description: 1 oz bottle for Level 4-6 spells (scrolls and books).
```

```
name: Invisible Ink
resultItemName: Invisible Ink
type: Consumable
category: Alchemical
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 12
workHours: 24
goldCost: 100
productValue: 200
rarity: Uncommon
isHomebrew: true
ingredients:
  - { type: ingredient, name: Pixie's Parasol, quantity: 1 }
  - { type: item, name: Ink, quantity: 1 }
description: Visible only with see-invisible magic/traits or mild acid.
```

```
name: Lesser Potion of Mana
resultItemName: Lesser Potion of Mana
type: Consumable
category: Potion
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 12
workHours: 24
goldCost: 100
productValue: 200
rarity: Uncommon
isHomebrew: true
ingredients:
  - { type: ingredient, name: Pixie's Parasol, quantity: 1 }
  - { type: ingredient, name: Silverthorn, quantity: 1 }
description: Regain 2 Recovery Points or 2 sorcery points.
```

```
name: Midnight Oil
resultItemName: Midnight Oil
type: Consumable
category: Oil
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 12
workHours: 24
goldCost: 100
productValue: 200
rarity: Uncommon
isHomebrew: true
ingredients:
  - { type: item, name: Flask of Oil, quantity: 1 }
  - { type: ingredient, name: Pixie's Parasol, quantity: 1 }
description: Light 5 ft bright, 5 ft dim for 8 hrs. Full 8 hrs in light = long rest benefits without sleep.
```

```
name: Oil of Slipperiness
resultItemName: Oil of Slipperiness
type: Consumable
category: Oil
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 12
workHours: 24
goldCost: 100
productValue: 200
rarity: Uncommon
ingredients:
  - { type: item, name: Flask of Oil, quantity: 1 }
  - { type: ingredient, name: Crawler Mucus, quantity: 1 }
  - { type: ingredient, name: Water Elemental Droplet, quantity: 1 }
description: Freedom of movement 8 hrs, or grease spell 10-ft square 8 hrs.
```

```
name: Pixie Dust
resultItemName: Pixie Dust
type: Consumable
category: Alchemical
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 12
workHours: 24
goldCost: 100
productValue: 200
rarity: Uncommon
ingredients:
  - { type: ingredient, name: Rainbow Mushroom, quantity: 1 }
  - { type: ingredient, name: Eagle Claw, quantity: 1 }
description: Flying speed 30 ft, hover, 1 minute. One use per packet.
```

```
name: Potion of Animal Friendship
resultItemName: Potion of Animal Friendship
type: Consumable
category: Potion
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 12
workHours: 24
goldCost: 100
productValue: 200
rarity: Uncommon
ingredients:
  - { type: ingredient, name: Cat's Tongue, quantity: 1 }
  - { type: ingredient, name: Quipper Scale, quantity: 1 }
description: Animal Friendship at will for 1 hour (DC 13 WIS save).
```

```
name: Potion of Fire Breath
resultItemName: Potion of Fire Breath
type: Consumable
category: Potion
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 12
workHours: 24
goldCost: 100
productValue: 200
rarity: Uncommon
ingredients:
  - { type: ingredient, name: Ashblossom, quantity: 1 }
  - { type: ingredient, name: Fire Elemental Ember, quantity: 1 }
description: Bonus action exhale fire 30 ft, DC 13 DEX, 4d6 fire. 3 uses or 1 hour.
```

```
name: Potion of Growth
resultItemName: Potion of Growth
type: Consumable
category: Potion
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 12
workHours: 24
goldCost: 100
productValue: 200
rarity: Uncommon
ingredients:
  - { type: ingredient, name: Sourgrass, quantity: 1 }
  - { type: ingredient, name: Everfrost Berries, quantity: 1 }
  - { type: ingredient, name: Giant Wolf Spider Hair, quantity: 1 }
description: Enlarge effect 1d4 hours, no concentration.
```

```
name: Potion of Resistance
resultItemName: Potion of Resistance
type: Consumable
category: Potion
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 12
workHours: 24
goldCost: 100
productValue: 200
rarity: Uncommon
ingredients:
  - { type: ingredient, name: Hagfinger, quantity: 1 }
  - { type: ingredient, name: [SPECIAL - see table], quantity: 1 }
description: Resistance to one damage type for 1 hour. Special: Acid=Crawler Mucus, Cold=Frost Lichen, Fire=Ashblossom, Force=Amphibian Saliva, Lightning=Lightning Moss, Necrotic=Nightshade, Poison=Earth Elemental Pebble, Psychic=Mindflayer Stinkhorn, Radiant=Sourgrass, Thunder=Singing Nettle.
```

```
name: Potion of Waterbreathing
resultItemName: Potion of Waterbreathing
type: Consumable
category: Potion
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 12
workHours: 24
goldCost: 100
productValue: 200
rarity: Uncommon
ingredients:
  - { type: ingredient, name: Gillyweed, quantity: 1 }
  - { type: ingredient, name: Water Elemental Droplet, quantity: 1 }
description: Breathe underwater 1 hour.
```

#### Rare (DC 15, 80 hrs, 500 gp cost, 1000 gp value)

```
name: Ink, Spell Writing (Rare)
resultItemName: Ink, Spell Writing (Rare)
type: Consumable
category: Alchemical
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 15
workHours: 80
goldCost: 500
productValue: 1000
rarity: Rare
isHomebrew: true
ingredients:
  - { type: item, name: Charcoal, quantity: 1 }
  - { type: item, name: Finely Ground Iron, quantity: 1 }
  - { type: ingredient, name: Willowshade Fruit, quantity: 1 }
description: 1 oz bottle for Level 7-8 spells (scrolls and books).
```

```
name: Oil of Dragon's Bane
resultItemName: Oil of Dragon's Bane
type: Consumable
category: Oil
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 15
workHours: 80
goldCost: 500
productValue: 1000
rarity: Rare
isHomebrew: true
ingredients:
  - { type: ingredient, name: Dragon's Blood, quantity: 1 }
  - { type: ingredient, name: Wyvern Poison, quantity: 1 }
description: +6d6 damage vs dragons. 3 weapon uses or 3 ammunition. Inert after 1 hour.
```

```
name: Potion of Aqueous Form
resultItemName: Potion of Aqueous Form
type: Consumable
category: Potion
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 15
workHours: 80
goldCost: 500
productValue: 1000
rarity: Rare
ingredients:
  - { type: ingredient, name: Water Elemental Droplet, quantity: 1 }
  - { type: ingredient, name: Gillyweed, quantity: 1 }
  - { type: ingredient, name: Quipper Scale, quantity: 3 }
description: Transform into pool of water 10 min. Swimming 30 ft, resistance to nonmagical damage, advantage on STR/DEX/CON saves.
```

```
name: Potion of Gaseous Form
resultItemName: Potion of Gaseous Form
type: Consumable
category: Potion
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 15
workHours: 80
goldCost: 500
productValue: 1000
rarity: Rare
ingredients:
  - { type: ingredient, name: Ectoplasm, quantity: 1 }
  - { type: ingredient, name: Singing Nettle, quantity: 1 }
description: Gaseous form spell 1 hour, no concentration.
```

```
name: Potion of Giant Strength
resultItemName: Potion of Giant Strength
type: Consumable
category: Potion
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 15
workHours: 80
goldCost: 500
productValue: 1000
rarity: Rare
ingredients:
  - { type: ingredient, name: Frost Lichen, quantity: 1 }
  - { type: ingredient, name: Giant's Fingernail, quantity: 1 }
description: STR changes per giant type (Hill 21, Frost/Stone 23, Fire 25, Cloud 27, Storm 29) for 1 hour.
```

```
name: Potion of Mana
resultItemName: Potion of Mana
type: Consumable
category: Potion
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 15
workHours: 80
goldCost: 500
productValue: 1000
rarity: Rare
isHomebrew: true
ingredients:
  - { type: ingredient, name: Pixie's Parasol, quantity: 1 }
  - { type: ingredient, name: Silverthorn, quantity: 1 }
  - { type: ingredient, name: Dragon's Blood, quantity: 1 }
description: Regain 4 Recovery Points or 4 sorcery points.
```

```
name: Potion of True Dreaming
resultItemName: Potion of True Dreaming
type: Consumable
category: Potion
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 15
workHours: 80
goldCost: 500
productValue: 1000
rarity: Rare
isHomebrew: true
ingredients:
  - { type: ingredient, name: Nothic Tears, quantity: 1 }
  - { type: ingredient, name: Willowshade Fruit, quantity: 1 }
description: True visions of past/present/future when drunk before sleep. Alternately Willowshade Oil.
```

```
name: Oil of Etherealness
resultItemName: Oil of Etherealness
type: Consumable
category: Oil
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 15
workHours: 80
goldCost: 500
productValue: 1000
rarity: Rare
ingredients:
  - { type: ingredient, name: Ectoplasm, quantity: 1 }
  - { type: item, name: Flask of Oil, quantity: 1 }
description: Etherealness spell 1 hour.
```

```
name: Potion of Clairvoyance
resultItemName: Potion of Clairvoyance
type: Consumable
category: Potion
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 15
workHours: 80
goldCost: 500
productValue: 1000
rarity: Rare
ingredients:
  - { type: ingredient, name: Morning Dew, quantity: 1 }
  - { type: ingredient, name: Mandrake Root, quantity: 1 }
description: Clairvoyance spell 10 minutes.
```

```
name: Potion of Diminution
resultItemName: Potion of Diminution
type: Consumable
category: Potion
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 15
workHours: 80
goldCost: 500
productValue: 1000
rarity: Rare
ingredients:
  - { type: ingredient, name: Pixie's Parasol, quantity: 1 }
  - { type: ingredient, name: Moonstalker, quantity: 1 }
description: Reduce effect 1d4 hours, no concentration.
```

```
name: Potion of Heroism
resultItemName: Potion of Heroism
type: Consumable
category: Potion
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 15
workHours: 80
goldCost: 500
productValue: 1000
rarity: Rare
ingredients:
  - { type: ingredient, name: Hagfinger, quantity: 1 }
  - { type: ingredient, name: Cat's Tongue, quantity: 1 }
description: 10 temp HP + bless 1 hour, no concentration.
```

```
name: Potion of Invulnerability
resultItemName: Potion of Invulnerability
type: Consumable
category: Potion
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 15
workHours: 80
goldCost: 500
productValue: 1000
rarity: Rare
ingredients:
  - { type: ingredient, name: Lightning Struck Metal, quantity: 1 }
description: Resistance to all damage 1 minute.
```

```
name: Potion of Mind Reading
resultItemName: Potion of Mind Reading
type: Consumable
category: Potion
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 15
workHours: 80
goldCost: 500
productValue: 1000
rarity: Rare
ingredients:
  - { type: ingredient, name: Mindflayer Stinkhorn, quantity: 1 }
  - { type: ingredient, name: Moonstalker, quantity: 1 }
description: Detect thoughts 10 min (DC 13 WIS save).
```

```
name: Thor's Might
resultItemName: Thor's Might
type: Consumable
category: Potion
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 15
workHours: 80
goldCost: 500
productValue: 1000
rarity: Rare
isHomebrew: true
ingredients:
  - { type: ingredient, name: Air Elemental Wisp, quantity: 1 }
  - { type: ingredient, name: Lightning Moss, quantity: 1 }
  - { type: ingredient, name: Singing Nettle, quantity: 1 }
description: +1d6 thunder on melee weapon hit for 1 min. Alternately Giant's Fingernail (Cloud) instead of Air Elemental Wisp.
```

#### Very Rare (DC 18, 240 hrs, 1000 gp cost, 2000 gp value)

```
name: Ink, Spell Writing (Very rare)
resultItemName: Ink, Spell Writing (Very rare)
type: Consumable
category: Alchemical
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 18
workHours: 240
goldCost: 1000
productValue: 2000
rarity: Very Rare
isHomebrew: true
ingredients:
  - { type: item, name: Charcoal, quantity: 1 }
  - { type: item, name: Finely Ground Iron, quantity: 1 }
  - { type: ingredient, name: Willowshade Oil, quantity: 2 }
description: 1 oz bottle for Level 9 spells (scrolls and books).
```

```
name: Oil of Sharpness
resultItemName: Oil of Sharpness
type: Consumable
category: Oil
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 18
workHours: 240
goldCost: 1000
productValue: 2000
rarity: Very Rare
ingredients:
  - { type: ingredient, name: Ankheg Ichor, quantity: 1 }
  - { type: ingredient, name: Silverthorn, quantity: 1 }
description: +3 attack and damage for 1 hour. Slashing/piercing weapon or 5 ammo.
```

```
name: Potion of Flying
resultItemName: Potion of Flying
type: Consumable
category: Potion
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 18
workHours: 240
goldCost: 1000
productValue: 2000
rarity: Very Rare
ingredients:
  - { type: ingredient, name: Air Elemental Wisp, quantity: 1 }
  - { type: ingredient, name: Singing Nettle, quantity: 1 }
description: Flying speed = walking speed, hover, 1 hour.
```

```
name: Potion of Invisibility
resultItemName: Potion of Invisibility
type: Consumable
category: Potion
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 18
workHours: 240
goldCost: 1000
productValue: 2000
rarity: Very Rare
ingredients:
  - { type: ingredient, name: Skulk Claw, quantity: 1 }
  - { type: ingredient, name: Fairy Stool, quantity: 1 }
description: Invisibility 1 hour. Ends on attack or spell.
```

```
name: Potion of Longevity
resultItemName: Potion of Longevity
type: Consumable
category: Potion
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 18
workHours: 240
goldCost: 1000
productValue: 2000
rarity: Very Rare
ingredients:
  - { type: ingredient, name: Imp Heart, quantity: 1 }
  - { type: ingredient, name: Red Amanita Mushroom, quantity: 1 }
description: Age -1d6-6 years (min 13). 10% cumulative chance to age instead on repeat use.
```

```
name: Potion of Possibility
resultItemName: Potion of Possibility
type: Consumable
category: Potion
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 18
workHours: 240
goldCost: 1000
productValue: 2000
rarity: Very Rare
ingredients:
  - { type: ingredient, name: Skulk Claw, quantity: 1 }
  - { type: ingredient, name: Ectoplasm, quantity: 1 }
description: 2 Fragments of Possibility (roll extra d20, choose result). 8 hours or until used.
```

```
name: Potion of Speed
resultItemName: Potion of Speed
type: Consumable
category: Potion
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 18
workHours: 240
goldCost: 1000
productValue: 2000
rarity: Very Rare
ingredients:
  - { type: ingredient, name: Eagle Claw, quantity: 4 }
  - { type: ingredient, name: Lightning Moss, quantity: 1 }
  - { type: item, name: Sugar, quantity: 1 }
description: Haste spell 1 minute, no concentration.
```

```
name: Potion of Truesight
resultItemName: Potion of Truesight
type: Consumable
category: Potion
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 18
workHours: 240
goldCost: 1000
productValue: 2000
rarity: Very Rare
isHomebrew: true
ingredients:
  - { type: ingredient, name: Fairy Stool, quantity: 1 }
  - { type: ingredient, name: Nothic Tears, quantity: 1 }
description: Truesight 120 ft for 1 hour.
```

```
name: Superior Potion of Mana
resultItemName: Superior Potion of Mana
type: Consumable
category: Potion
skill: Alchemy
skillLevel: 0
tool: Alchemist's Supplies
dc: 18
workHours: 240
goldCost: 1000
productValue: 2000
rarity: Very Rare
isHomebrew: true
ingredients:
  - { type: ingredient, name: Pixie's Parasol, quantity: 1 }
  - { type: ingredient, name: Silverthorn, quantity: 1 }
  - { type: ingredient, name: Dragon's Blood, quantity: 1 }
  - { type: ingredient, name: Remorhaz Ichor, quantity: 1 }
description: Regain more Recovery Points or sorcery points than standard Potion of Mana.
```

---

### Herbalism Kit Recipes

(Format: name, resultItemName, ingredients, description, dc, workHours, goldCost, productValue, rarity. Skill: Herbalism.)

#### Common
- **Antitoxin**: Everfrost Berry, Cat's Tongue | Advantage vs poison 1 hr
- **Potion of Healing**: Red Amanita Mushroom | 2d4+2 HP
- **Muroosa Balm**: Flame Lily, Muroosa Bush | Fire resistance 1 min after 1 min apply
- **Pepper Peppers**: Fire Peas | 3 temp HP (6 per batch)
- **Potion of Plantspeak**: Cat's Tongue, Muroosa Bush | Speak with plants 5 min
- **Soothing Salve**: Sourgrass, Acid Dew | +3 HP per Hit Die during short rest
- **Quenching Pilther**: Muroosa Bush, Gillyweed | Quenches thirst, removes 1 exhaustion
- **Willowshade Oil**: Willowshade Fruit | Counter petrification if &lt;1 min

#### Uncommon
- **Blight Ichor**: Blight Spores | DC 15 CON or poisoned 1d6 hrs + confusion 1 min
- **Brew of Babel**: Singing Nettle (2) | Speak/understand all languages 1 hr
- **Fire Balm**: Flame Lily, Flask of Oil, Theki Root | +3 single CON/WIS/CHA save, 14 hrs
- **Forgetfulness Antidote**: The Bearded Green (2), Sourgrass | Cures Forgetfulness poison
- **Greater Antitoxin**: Theki Root, Sourgrass | Advantage vs poison 12 hrs
- **Keoghtom's Restorative Ointment**: Flask of Oil, Theki Root, Red Amanita Mushroom (2) | 3 doses, 2d8+2 HP or cure disease
- **Life's Liquor**: Red Amanita Mushroom, Muroosa Bush | Polymorph self 1 hr
- **Murgaxor's Elixir of Life**: White Ghost Orchid Seed | Advantage on death saves 24 hrs
- **Pomander of Warding**: Hagfinger | Undead CR≤2 DC save or flee 24 hrs
- **Potion of Advantage**: Willowshade Fruit, Rainbow Mushroom | Advantage on one check/attack/save within 1 hr
- **Potion of Greater Healing**: Red Amanita Mushroom (2) | 4d4+4 HP
- **Potion of Maximum Power**: Theki Root, Olisuba Leaf, Dreamlily | Max damage on first damage spell 4th or lower
- **Potion of Shapeshifting**: Rainbow Mushroom, Olisuba Leaf | Change appearance at will 1 hr
- **Tea of Refreshment**: Morning Dew, Cat's Tongue | Remove 1 exhaustion
- **Thessaltoxin Antidote**: White Ghost Orchid Seed, Theki Root | End Thessaltoxin polymorph

#### Rare
- **Bottled Rest**: Gillyweed, Hagfinger, Morning Dew | Restore 3 Hit Die
- **Elixir of Health**: Fairy Stool, Gillyweed | Cure disease, blinded, deafened, paralyzed, poisoned
- **Liquid Luck**: Rainbow Mushroom, Muroosa Bush, Fairy Stool | Advantage deception/insight/persuasion 1 hr
- **Meditative Rest**: Fire Peas, Everfrost Berries, Flame Lily | Restore 4 Ki
- **Polymorph Potion**: Rainbow Mushroom, Dreamlily, Willowshade Fruit | Polymorph self 15 min
- **Potion of Restoration**: Acid Dew (2), Morning Dew, Red Amanita Mushroom (2) | Regrow body parts
- **Potion of Revival**: Acid Dew, Dreamlily, White Ghost Orchid Seed | Revivify-like if dead &lt;1 min
- **Potion of Superior Healing**: Red Amanita Mushroom (3) | 8d4+8 HP
- **Tincture of Werewolf's Bane**: Wolfsbane, Silverthorn | Lycanthrope DC 19 CON or 3d10 necrotic + humanoid form

#### Very Rare
- **Reincarnation Dust**: Angel's Trumpet, White Ghost Orchid Seed, Lightning Struck Metal, Mandrake Root | Reincarnate
- **Potion of Continuous Healing**: Acid Dew, Red Amanita Mushroom (3), Olisuba Leaf | 2d10 HP/turn for 1 min
- **Potion of Enhanced Reactions**: Lightning Struck Metal, Idle Claws, Hagfinger | +2 initiative, saves, AC 1 min
- **Potion of Legendary Resistance**: Black Sap, Mindflayer Stinkhorn, Mandrake Root | 2 legendary resistance
- **Potion of Protection**: Hagfinger, Idle Claws, White Ghost Orchid Seed | Immunity to status except poisoned
- **Potion of Supreme Healing**: Red Amanita Mushroom (4) | 10d4+20 HP
- **Potion of Vitality**: Morning Dew (2), Cat's Tongue (2), Olisuba Leaf | Remove exhaustion, disease, poison
- **Vampiric Essence**: Bloodroot, Theki Root, Black Cup Mushroom | Vampire spawn control 24 hrs

---

### Poisoner's Kit Recipes

(Skill: Alchemy. Same DC/workHours/goldCost/productValue as Alchemist tiers.)

#### Common
- **Acid Tablets**: Grey Ooze Residue (as Acid) | DC 14 CON or 1d6 acid, no vomit 30 sec
- **Basic Poison**: Nightshade | Injury, DC 10 CON or poisoned 1 hr
- **Biza's Breath**: Angel's Trumpet, Frost Lichen | Inhaled, DC 16 CON or poisoned 1 min
- **Dazzling Bomb**: Nightshade, Gillyweed | 30 ft sphere, CON save or blinded
- **Liquid Paranoia**: Moonstalker | Ingested, DC 15 WIS or frightened
- **Nausea Pellet**: Sourgrass (2) | 5×5 ft, CON save or poisoned
- **Perfume of Bewitching**: Perfume, Mindflayer Stinkhorn | Advantage CHA checks 1 hr

#### Uncommon
- **Angel's Powder**: Angel's Trumpet, Dreamlily | Inhaled, DC 15 CHA
- **Assassin's Blood**: Basic Poison, Nightshade | Ingested, DC 10 CON, 1d12 + poisoned 24 hrs
- **Bane Berry Extract**: Bane Berry | Ingested, DC 14 CON
- **Black Paste**: Black Cup Mushroom, Black Sap | Contact via clothing
- **Directed Delay**: Idle Claws, Death Cap | Injury, DC 15 WIS
- **Lava Paste**: Flame Lily, Fire Peas | Contact, DC 14 CON
- **Malice**: Morning Dew, Black Sap | Inhaled, DC 15 CON or blinded 1 hr
- **Noxious Transpiration**: Death Cap, Mindflayer Stinkhorn | Contact via sweat 2 hrs after drinking
- **Pale Tincture**: Black Sap, Death Cap | Ingested, DC 16 CON, repeat every 24 hrs
- **Philter of Love**: Fairy Stool, Serpent's Venom | Ingested, charmed 1 hr
- **Potion of Poison**: Potion of Healing, Bane Berry | Disguised as healing
- **Truth Serum**: Fairy Stool, Mindflayer Stinkhorn | Ingested, DC 12 CON or zone of truth 1 hr
- **Taratella: The Great Humiliator**: Dreamlily, Bloodroot | Ingested, DC 14 CHA

#### Rare
- **Burnt Othur Fumes**: Ashblossom, Moonstalker | Inhaled, DC 13 CON
- **Devil's Powder**: Angel's Trumpet, Blight Spores | Inhaled, DC 18 CHA
- **Drow Poison**: Drider Poison, Mandrake Root | Injury, DC 13 CON
- **Essence of Ether**: Nightshade, Mandrake Root | Inhaled, DC 15 CON or unconscious 8 hrs
- **Dracula's Essence**: Dracula's Blood, Dragon's Blood, Bloodroot, Red Amanita Mushroom | Ingested/Injury
- **Forgetfulness**: Soothsalt Geode, Blight Spores | Inhaled, DC 14 INT
- **Fire Plague**: Fairy Stool, Drider Poison, Flame Lily | Ingested via baked goods
- **Magebane**: Wolfsbane, Drider Poison, Serpent's Venom | Mage Slayer 1 min
- **Magic's Bane**: Bane Berry, The Bearded Green, Wolfsbane | Injury/Injection
- **Oil of Taggit**: Flask of Oil, Wolfsbane | Contact, DC 13 CON or unconscious 24 hrs
- **Thessaltoxin**: Dracula's Blood, Black Cup Mushroom | Polymorph
- **Torpor**: Mandrake Root, Lightning Moss | Ingested, DC 15 CON or incapacitated 4d6 hrs

#### Very Rare
- **Armourer's Blight**: Giant's Fingernail (Cloud/Storm), Acid Dew (3), Flask of Oil | Contact, armour poison
- **Coup de Poudre**: Black Thistle (4), powdered human bones, Blue-Ringed Octopus Poison, lidded clay jar | Revenant creation
- **Medusa's Vengeance**: Angel's Trumpet, Black Sap, Idle Claws (2) | Injury, petrification risk
- **Black Thistle Poison**: Black Thistle (4) | Exposure/Injection/Injury
- **Deathsleep**: Tea of Refreshment, Purple Worm Poison | Ingested, DC 19 CON or appear dead
- **Essence of Rage**: Dragon's Blood, Moonstalker, Lightning Struck Metal | Barbarian Rage
- **Midnight Tears**: Death Cap, Ankheg Ichor | Ingested, effect at midnight
- **Sandman's Revenge**: Remorhaz Ichor, Mandrake Root, Bane Berry | Inhaled, DC 18 WIS, 2d10 necrotic
- **Night Hag's Curse**: Devil's Powder | Ingested/injury/injected
- **Water of Death**: Black Cup Mushroom, Wyvern Poison, Dreamlily, Hagfinger | DC 20 CON, severe effects

---

### Minor Potions

(10 gp, 2 hrs each; batch of 5: 45 gp, 8 hrs. No special ingredients unless noted.)

- **Acid**: Grey Ooze Residue | 12.5 gp cost, 25 gp value
- **Patch-up Potion**: Gillyweed
- **Nerve Calmer**: Nightshade
- **Sleeping Pills**: Dreamlily
- *(Others: Airway Aid, Dandruff Draught, Ear Clear, Eye Drops, etc.—no special ingredients)*

---

## Summary

| Kit | Common | Uncommon | Rare | Very Rare | Total |
|-----|--------|----------|------|-----------|-------|
| Alchemist's Supplies | 9 | 10 | 12 | 9 | 40 |
| Herbalism Kit | 8 | 14 | 9 | 8 | 39 |
| Poisoner's Kit | 7 | 12 | 11 | 9 | 39 |
| Minor Potions | ~25 (many no special ingredients) | | | | |
| **Total (main)** | | | | | **118** |

**Ingredient type notes:**
- `ingredient` = Artificer/gatherable item (from ingredient-migration.md)
- `item` = Mundane D&D or supply item (Flask of Oil, Charcoal, Ink, Sugar, Perfume, Finely Ground Iron)

**Pre-requisite recipes:** Some recipes require crafted items as ingredients (e.g., Willowshade Oil from Willowshade Fruit, Basic Poison, Potion of Healing, Tea of Refreshment, Devil's Powder). Import order or dependency resolution may be needed.
