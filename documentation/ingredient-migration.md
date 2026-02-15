# Ingredient Migration Reference

**Source:** Artificer - Potion Brewing and Ingredient Gathering for DnD 5e (piccolo917, GM Binder)

This document contains variable blocks for every ingredient from the source PDF, formatted for Coffee Pub Artificer import. Each block uses the template from `prompts/artificer-ingredient.txt`.

**Biomes:** Use only official D&D 5e monster habitats (Arctic, Coastal, Desert, Forest, Grassland, Hill, Mountain, Swamp, Underdark, Underwater, Urban). Avoid non-leverageable descriptors like "Sites of frequent or large-scale death" or "Wyvern poison burned soil"—put those in descriptions only.

**Import JSON mapping:** When building import JSON, map `Source` → `system.source.value` and `system.source.custom`. For non-official content, set both so the Configure Source dialog's "Custom Label" is populated (e.g. `"source": { "value": "Artificer - Potion Brewing and Ingredient Gathering", "custom": "Artificer - Potion Brewing and Ingredient Gathering" }`).

---

## Gatherable Plants & Fungi

### Acid Dew
```
Name: Acid Dew
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Floral, Toxic
Tier: 2
Rarity: Uncommon
Quirk: 
Biomes: Swamp, Forest
Weight: 0.1
Price: 10
Description: Like its more famous family, Honeydews, Acid Dew is a carnivorous plant with a stronger sting. Its droplets dissolve prey with sticky acid instead of enzymes in syrup. Touching the flowers causes damage. Harvest: Herbalism Kit (DC 20). Quantity: 1d6 flowers.
consumableType: poison
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: Damage
Activity name: Use
formula: 
Activity effect type: damage
Activity effect die: 
Activity effect bonus:
Damage type: acid
```

### Angel's Trumpet
```
Name: Angel's Trumpet
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Floral, Toxic
Tier: 3
Rarity: Rare
Quirk: 
Biomes: Forest, Hill
Weight: 0.1
Price: 50
Description: Its name is based on the shape and beauty of the flower—purest white, trumpet-shaped with yellow stems. However, it is a dangerous plant. Inhaling the scent directly from the flower forces a saving throw. Harvest: Herbalism Kit (DC 15). Quantity: 1d8 flowers.
consumableType: poison
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: Save
Activity name: Use
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type: poison
```

### Ashblossom
```
Name: Ashblossom
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Floral, Fire
Tier: 3
Rarity: Rare
Quirk: 
Biomes: Desert, Mountain
Weight: 0.1
Price: 50
Description: This tiny flower is bright red with a yellow centre, found only in hot environments. It deals 1d4 fire damage when ingested, but can be used to brew many fire-related potions. Harvest: Herbalism Kit (DC 15). Quantity: 1d6 blossoms.
consumableType: poison
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: Damage
Activity name: Use
formula: 1d4
Activity effect type: damage
Activity effect die: d4
Activity effect bonus: 0
Damage type: fire
```

### Bane Berry
```
Name: Bane Berry
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Floral, Toxic
Tier: 2
Rarity: Uncommon
Quirk: 
Biomes: Urban
Weight: 0.1
Price: 10
Description: These trees form clusters of small, densely packed red and white berries without ever flowering. Though delicious, they are toxic and even deadly to children. Harvest: Herbalism Kit (DC 15). Quantity: 2d4 berries.
consumableType: poison
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type: poison
```

### Black Cup Mushroom
```
Name: Black Cup Mushroom
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Fungus
Secondary tags: Toxic, Shadow
Tier: 3
Rarity: Rare
Quirk: 
Biomes: Forest, Swamp
Weight: 0.1
Price: 50
Description: This beautiful blue-ish black, cup-shaped mushroom with an extremely poisonous bite is hard to miss against the green background. Touching this fungus is dangerous. Harvest: Herbalism Kit (DC 20). Quantity: 1d4 stalks.
consumableType: poison
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type: poison
```

### Black Sap
```
Name: Black Sap
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Toxic, Shadow
Tier: 3
Rarity: Rare
Quirk: 
Biomes: Swamp, Urban
Weight: 0.1
Price: 50
Description: This tarry substance harvested from the dark boughs of the death's head willow is a powerful intoxicant. For each dose consumed, a creature must succeed on a DC 15 Constitution saving throw or become poisoned for 2d4 hours. Harvest: Herbalism Kit (DC 15). Quantity: 1d6 doses.
consumableType: poison
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: Save
Activity name: Use
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type: poison
```

### Black Thistle
```
Name: Black Thistle
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Floral, Toxic
Tier: 4
Rarity: Very Rare
Quirk: 
Biomes: Grassland, Mountain
Weight: 0.1
Price: 150
Description: These flowers are very rare, found only in specialized herbalist gardens or on farmland previously raided by wyverns. Wyvern poison can change the soil to produce them. Harvest: Herbalism Kit (DC 20). Quantity: 1d4+1 parts per plant.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Blight Spores
```
Name: Blight Spores
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Fungus
Secondary tags: Toxic, Arcane
Tier: 3
Rarity: Rare
Quirk: 
Biomes: Underdark
Weight: 0.1
Price: 50
Description: Bright red spores from Blightshrooms, growing exclusively in caves on the Blightshore. A creature exposed to a large dose must succeed on a DC 16 Constitution saving throw or suffer effects. Harvest: Herbalism Kit (DC 15). Quantity: 1d6 doses.
consumableType: poison
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: Save
Activity name: Use
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type: poison
```

### Bloodroot
```
Name: Bloodroot
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Root, Medicinal
Tier: 2
Rarity: Uncommon
Quirk: 
Biomes: Grassland
Weight: 0.1
Price: 10
Description: On first glance these roots look like purple carrots, but when cut or broken they ooze a blood-red liquid. If processed properly, used as long-lasting dye or food colouring. Harvest: Herbalism Kit (DC 10). Quantity: 1d8 roots.
consumableType: food
Food type: food
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Cat's Tongue
```
Name: Cat's Tongue
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Floral, Medicinal
Tier: 1
Rarity: Common
Quirk: 
Biomes: Grassland, Forest
Weight: 0.1
Price: 5
Description: A mid-sized herbaceous plant with bundles of small 5-bladed purple/white flowers that ripen into fig-sized pods. The pods have a slightly toxic outer shell with inner fruit. Harvest: Herbalism Kit (DC 10). Quantity: 2d4 pods.
consumableType: food
Food type: food
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Death Cap
```
Name: Death Cap
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Fungus
Secondary tags: Toxic, Shadow
Tier: 3
Rarity: Rare
Quirk: 
Biomes: Forest, Swamp
Weight: 0.1
Price: 50
Description: Though unassuming with a slender white stalk and white-to-lightly-brown cap, death cap is dangerous. 12 hours after ingesting, a creature must make a DC 17 Constitution saving throw or suffer severe effects. Harvest: Herbalism Kit (DC 20). Quantity: 1d4 heads.
consumableType: poison
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: Save
Activity name: Use
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type: poison
```

### Dreamlily
```
Name: Dreamlily
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Floral, Arcane
Tier: 1
Rarity: Common
Quirk: 
Biomes: Grassland, Coastal
Weight: 0.1
Price: 5
Description: A white, slightly silvery 5-pointed flower with an intoxicating smell. Soaked in warm water it creates a psychoactive liquid that smells and tastes like your favourite beverage. Harvest: Herbalism Kit (DC 10). Quantity: 2d6 flowers.
consumableType: food
Food type: food
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Everfrost Berries
```
Name: Everfrost Berries
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Berry, Life
Tier: 1
Rarity: Common
Quirk: Soothing
Biomes: Grassland, Forest
Weight: 0.1
Price: 5
Description: Baby-blue, heart-shaped berries the size of blueberries known for purifying properties. The plants are wholly immune to frost damage. Harvest: Herbalism Kit (DC 5). Quantity: 3d6 berries.
consumableType: food
Food type: food
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Fairy Stool
```
Name: Fairy Stool
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Fungus
Secondary tags: Arcane, Fey
Tier: 3
Rarity: Rare
Quirk: 
Biomes: Forest
Weight: 0.1
Price: 50
Description: This small pink mushroom is most often found in fairy rings. Ingesting it causes blindness for 1 minute on a failed DC 20 Constitution saving throw, along with vivid hallucinations. Harvest: Herbalism Kit (DC 15). Quantity: 1d4 stalks.
consumableType: poison
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: true
Consumption magical: true
Activity type: Save
Activity name: Use
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type: 
```

### Fire Peas
```
Name: Fire Peas
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Fire, Spice
Tier: 2
Rarity: Uncommon
Quirk: 
Biomes: Desert, Grassland
Weight: 0.1
Price: 10
Description: Though the pale blue flowers suggest otherwise, the pea pods of this low shrub are scorchingly spicy—a sought-after spice in certain areas. Harvest: Herbalism Kit (DC 15). Quantity: 1d6 pods.
consumableType: food
Food type: food
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Flame Lily
```
Name: Flame Lily
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Floral, Fire
Tier: 2
Rarity: Uncommon
Quirk: 
Biomes: Desert, Grassland
Weight: 0.1
Price: 10
Description: Named for its red and orange 7-leafed flowers whose petals point skywards, resembling a flame. When used carefully, these flowers have curative properties. Harvest: Herbalism Kit (DC 15). Quantity: 1d8 flowers.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Frost Lichen
```
Name: Frost Lichen
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Cold, Environmental
Tier: 2
Rarity: Uncommon
Quirk: 
Biomes: Arctic
Weight: 0.1
Price: 10
Description: An eye-blindingly white lichen that grows on rocks in regions of year-round freezing temperatures. Harvest: Herbalism Kit (DC 15). Quantity: 1d6 bunches.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Gillyweed
```
Name: Gillyweed
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Water, Medicinal
Tier: 1
Rarity: Common
Quirk: 
Biomes: Coastal, Swamp
Weight: 0.1
Price: 5
Description: This emerald green kelp is found underwater and is always covered in tiny air bubbles, making it easy to spot by a trained herbalist. Harvest: Herbalism Kit (DC 10). Quantity: 2d4 leaves.
consumableType: food
Food type: food
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Hagfinger
```
Name: Hagfinger
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Root, Arcane
Tier: 3
Rarity: Rare
Quirk: 
Biomes: Forest, Swamp
Weight: 0.1
Price: 50
Description: Small tubers that are pale, sickly green and resemble long fingers. When dried and ground into powder, they give off a strong aroma useful for herbalism and potion-making. Harvest: Herbalism Kit (DC 15). Quantity: 1d4 dried fingers.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Idle Claws
```
Name: Idle Claws
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Floral, Arcane
Tier: 3
Rarity: Rare
Quirk: 
Biomes: Hill, Mountain
Weight: 0.1
Price: 50
Description: An extremely long-lived, slow-growing creeper vine named after its equally long-lasting flowers—large clusters of claw-shaped, slightly fluorescent turquoise flowers. Harvest: Herbalism Kit (DC 15). Quantity: 1d4 pods.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Lightning Moss
```
Name: Lightning Moss
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Lightning, Environmental
Tier: 2
Rarity: Uncommon
Quirk: 
Biomes: Coastal, Mountain
Weight: 0.1
Price: 10
Description: This light blue moss grows only where lightning has struck and gives off a faint static electric shock when touched. If rubbed on feet or shoes, it can increase speed. Harvest: Herbalism Kit (DC 15). Quantity: 1d6 clumps.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Mandrake Root
```
Name: Mandrake Root
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Root, Toxic
Tier: 2
Rarity: Uncommon
Quirk: 
Biomes: Underdark
Weight: 0.1
Price: 10
Description: This twisted pale root resembles a gnarled humanoid infant. It inflicts the poisoned condition for 1 hour when ingested. Harvest: Herbalism Kit (DC 15). Quantity: 1d4 roots.
consumableType: poison
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: Save
Activity name: Use
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type: poison
```

### Mindflayer Stinkhorn
```
Name: Mindflayer Stinkhorn
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Fungus
Secondary tags: Arcane, Psychic
Tier: 2
Rarity: Uncommon
Quirk: 
Biomes: Underdark
Weight: 0.1
Price: 10
Description: This purple fungus has slimy, tentacle-looking stalks and smells of rotting flesh. A creature who eats it must make a DC 10 Constitution saving throw. On success, can cast detect thoughts. Harvest: Herbalism Kit (DC 10). Quantity: 1d4 stalks.
consumableType: food
Food type: food
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: true
Consumption magical: true
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Moonstalker
```
Name: Moonstalker
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Floral, Arcane
Tier: 3
Rarity: Rare
Quirk: 
Biomes: Coastal, Swamp
Weight: 0.1
Price: 50
Description: This pale blue flower grows in pairs and blooms only at night with an ethereal glow. It sheds dim light for 5 feet when blooming, often mistaken for glowing eyes. Harvest: Herbalism Kit (DC 10). Quantity: 1d4×2 flowers.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: true
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Morning Dew
```
Name: Morning Dew
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Leaf, Medicinal
Tier: 1
Rarity: Common
Quirk: 
Biomes: Forest, Grassland
Weight: 0.1
Price: 5
Description: This plant grows into a large shrub or small tree and reproduces via root systems—it has no flowers. The long, narrow leaves are used in teas and medicine. Harvest: Herbalism Kit (DC 10). Quantity: 2d6 leaves.
consumableType: food
Food type: food
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Muroosa Bush
```
Name: Muroosa Bush
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Fire, Medicinal
Tier: 2
Rarity: Uncommon
Quirk: 
Biomes: Desert, Grassland
Weight: 0.1
Price: 10
Description: Growing in arid areas in savannahs and deserts, this bush seems utterly unaffected by heat and sun. Harvest: Herbalism Kit (DC 15). Quantity: 1d6 twigs.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Nightshade
```
Name: Nightshade
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Floral, Toxic
Tier: 2
Rarity: Uncommon
Quirk: 
Biomes: Forest
Weight: 0.1
Price: 10
Description: An inky black flower with purple stalk. It deals 1d4 poison damage when ingested and, on a failed Constitution saving throw, inflicts the poisoned condition for 2d4 hours. Harvest: Herbalism Kit (DC 20). Quantity: 1d6 flowers.
consumableType: poison
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: Damage
Activity name: Use
formula: 1d4
Activity effect type: damage
Activity effect die: d4
Activity effect bonus: 0
Damage type: poison
```

### Olisuba Leaf
```
Name: Olisuba Leaf
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Leaf, Medicinal
Tier: 2
Rarity: Uncommon
Quirk: 
Biomes: Forest, Grassland
Weight: 0.1
Price: 10
Description: Dried leaves of the Olisuba tree; when steeped as tea, they help the body recover from strenuous activity. Drinking during a long rest reduces exhaustion level. Harvest: Herbalism Kit (DC 10). Quantity: 2d6 leaves.
consumableType: food
Food type: food
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Pixie's Parasol
```
Name: Pixie's Parasol
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Fungus
Secondary tags: Arcane, Fey
Tier: 3
Rarity: Rare
Quirk: 
Biomes: Forest
Weight: 0.1
Price: 50
Description: A tiny mushroom with a bright blue cap, white stalk and gills—hard to miss. At night, bioluminescence makes them easy to find. Key ingredient in many mana potions. Harvest: Herbalism Kit (DC 15). Quantity: 1d12 stalks.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: true
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Rainbow Mushroom
```
Name: Rainbow Mushroom
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Fungus
Secondary tags: Arcane, Fey
Tier: 3
Rarity: Rare
Quirk: 
Biomes: Forest, Mountain, Hill
Weight: 0.1
Price: 50
Description: Appears ordinary—brown cap, black gills, white stem—until cut. The exposed flesh shifts from rosemary green to light blue, then through a rainbow of colours. Harvest: Herbalism Kit (DC 15). Quantity: 1d8 mushrooms.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: true
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Red Amanita Mushroom
```
Name: Red Amanita Mushroom
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Fungus
Secondary tags: Medicinal, Toxic
Tier: 1
Rarity: Common
Quirk: 
Biomes: Swamp, Forest
Weight: 0.1
Price: 5
Description: This red-capped mushroom can grow to the size of a small dish. It deals 1d4 poison damage when ingested but can be used to brew healing potions by a careful herbalist. Harvest: Herbalism Kit (DC 10). Quantity: 2d4 stalks.
consumableType: poison
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: Damage
Activity name: Use
formula: 1d4
Activity effect type: damage
Activity effect die: d4
Activity effect bonus: 0
Damage type: poison
```

### Silverthorn
```
Name: Silverthorn
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Metal, Piercing
Tier: 3
Rarity: Rare
Quirk: 
Biomes: Arctic, Mountain
Weight: 0.1
Price: 50
Description: This thorny vine is pale silver and hard as metal. Patches create difficult terrain and deal 1d6 piercing damage if moved through at normal speed. Harvest: Herbalism Kit (DC 15). Quantity: 1d6 thorns.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Singing Nettle
```
Name: Singing Nettle
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Leaf, Thunder
Tier: 2
Rarity: Uncommon
Quirk: 
Biomes: Swamp, Mountain, Forest
Weight: 0.1
Price: 10
Description: This vine has sharp, stinging hairs. A creature touching them must make a DC 15 Wisdom saving throw or be overwhelmed by the urge to bellow a song at the top of their lungs. Harvest: Herbalism Kit (DC 15). Quantity: 2d4 leaves.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Sourgrass
```
Name: Sourgrass
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Grass, Medicinal
Tier: 2
Rarity: Uncommon
Quirk: 
Biomes: Grassland, Mountain
Weight: 0.1
Price: 10
Description: Green, long-bladed grass with a pungent smell and flavour. Humanoids within 5 feet of uncut sourgrass must succeed on a DC 10 Constitution saving throw or become overwhelmed with nausea. Harvest: Herbalism Kit (DC 5). Quantity: 2d4 clumps.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Theki Root
```
Name: Theki Root
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Root, Medicinal
Tier: 2
Rarity: Uncommon
Quirk: 
Biomes: Swamp
Weight: 0.1
Price: 10
Description: This thick root tastes bitter but aids digestive health. Using an action to consume a dose grants advantage on saving throws against poisonous or toxic substances for 1 hour. Harvest: Herbalism Kit (DC 15). Quantity: 1d6 roots.
consumableType: food
Food type: food
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### The Bearded Green
```
Name: The Bearded Green
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Fungus
Secondary tags: Medicinal, Arcane
Tier: 2
Rarity: Uncommon
Quirk: 
Biomes: Forest
Weight: 0.1
Price: 10
Description: A beautiful mushroom with an emerald green cap, stark white stalk, black gills, and white-grey strands resembling a beard hanging from the cap. Harvest: Herbalism Kit (DC 10). Quantity: 1d6 mushrooms.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### White Ghost Orchid Seed
```
Name: White Ghost Orchid Seed
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Seed, Life
Tier: 3
Rarity: Rare
Quirk: 
Biomes: Forest, Coastal
Weight: 0.1
Price: 50
Description: Rarely, ghost orchids produce a smaller pod holding a single white seed. Well known for properties in resurrection and healing potions. Harvest: Herbalism Kit (DC 10). Quantity: 1d4 seeds.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: true
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Willowshade Fruit
```
Name: Willowshade Fruit
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Fruit, Medicinal
Tier: 2
Rarity: Uncommon
Quirk: 
Biomes: Swamp, Coastal, Forest
Weight: 0.1
Price: 10
Description: A pepper-shaped fruit with great digestive-aiding properties. Can be processed into Willowshade Oil. Harvest: Herbalism Kit (DC 15). Quantity: 1d8 fruit.
consumableType: food
Food type: food
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Wolfsbane
```
Name: Wolfsbane
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Herbs
Primary tag: Herb
Secondary tags: Floral, Arcane
Tier: 3
Rarity: Rare
Quirk: 
Biomes: Mountain
Weight: 0.1
Price: 50
Description: This white-grey flower blooms only on a full moon and at high altitudes. Canines within 10 feet must make a DC 15 Wisdom save or be forced to move away from it. Harvest: Herbalism Kit (DC 15). Quantity: 1d4 flowers.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: true
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

---

## Inorganic Materials

### Lightning Struck Metal
```
Name: Lightning Struck Metal
Type: loot
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Minerals
Primary tag: Metal
Secondary tags: Lightning, Resonant
Tier: 3
Rarity: Rare
Quirk: 
Biomes: Coastal, Desert, Forest, Grassland, Hill, Mountain
Weight: 0.5
Price: 50
Description: A piece of metal struck by lightning weighing at least 0.5 ounces. Coinage struck by lightning is excluded. No specific harvesting method—found or obtained through events.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Soothsalt Geode
```
Name: Soothsalt Geode
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: Minerals
Primary tag: Crystal
Secondary tags: Arcane, Psychic
Tier: 3
Rarity: Rare
Quirk: 
Biomes: Underdark
Weight: 1
Price: 50
Description: A geode covered in crystalline substance that can be extracted into soothsalts. Harvest: Pickaxe or Crowbar (DC 10, no modifier). Quantity: 1d4 geodes.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: true
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

---

## Harvestable Creature Parts

### Ankheg Ichor
```
Name: Ankheg Ichor
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: CreatureParts
Primary tag: MonsterBits
Secondary tags: Venom, Acid
Tier: 3
Rarity: Rare
Quirk: 
Biomes: Grassland, Forest
Weight: 0.1
Price: 50
Description: Mucus from an ankheg. A creature in contact must succeed on a DC 13 Constitution save or be poisoned for 1 minute; poisoned creature is paralyzed. Harvest: Poisoner's Kit (DC 15). Quantity: 1d4 vials. Creature: Dead or Incapacitated.
consumableType: poison
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: Save
Activity name: Use
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type: poison
```

### Blue-Ringed Octopus Poison
```
Name: Blue-Ringed Octopus Poison
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: CreatureParts
Primary tag: Venom
Secondary tags: MonsterBits
Tier: 3
Rarity: Rare
Quirk: 
Biomes: Coastal
Weight: 0.1
Price: 50
Description: Poison from the blue-ringed octopus. Bite: +4 to hit, 1 piercing and CON 14 save or 1d6 poison damage. Harvest: Poisoner's Kit (DC 15). Quantity: 1d4 vials. Creature: Dead or Incapacitated.
consumableType: poison
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: Damage
Activity name: Use
formula: 1d6
Activity effect type: damage
Activity effect die: d6
Activity effect bonus: 0
Damage type: poison
```

### Crawler Mucus
```
Name: Crawler Mucus
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: CreatureParts
Primary tag: MonsterBits
Secondary tags: Venom, Acid
Tier: 4
Rarity: Very Rare
Quirk: 
Biomes: Underdark, Urban, Swamp, Forest
Weight: 0.1
Price: 150
Description: Mucus from a carrion crawler. Contact requires DC 13 Constitution save or poisoned for 1 minute; poisoned creature is paralyzed. Harvest: Poisoner's Kit (DC 20). Quantity: 1d4 vials. Creature: Dead or Incapacitated.
consumableType: poison
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: Save
Activity name: Use
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type: poison
```

### Dracula's Blood
```
Name: Dracula's Blood
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: CreatureParts
Primary tag: MonsterBits
Secondary tags: Blood, Arcane
Tier: 4
Rarity: Very Rare
Quirk: 
Biomes: Swamp
Weight: 0.1
Price: 150
Description: Blood from the Dracula Parrot, which feeds only on Death's Head Willows. Harvest: Alchemist's Kit (DC 10). Quantity: 1d4 vials. Creature: Dead or Incapacitated.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: true
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Drider Poison
```
Name: Drider Poison
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: CreatureParts
Primary tag: Venom
Secondary tags: MonsterBits
Tier: 4
Rarity: Very Rare
Quirk: 
Biomes: Underdark
Weight: 0.1
Price: 150
Description: Poison harvested from a drider. Harvest: Poisoner's Kit (DC 15). Quantity: 1d6 vials. Creature: Dead or Incapacitated.
consumableType: poison
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type: poison
```

### Eagle Claw
```
Name: Eagle Claw
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: CreatureParts
Primary tag: MonsterBits
Secondary tags: Bone
Tier: 3
Rarity: Rare
Quirk: 
Biomes: Coastal, Grassland, Hill, Mountain
Weight: 0.1
Price: 50
Description: Claws harvested from an eagle. Harvest: Knife (DC 10). Quantity: 1d8 claws. Creature: Dead or Incapacitated.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Ectoplasm
```
Name: Ectoplasm
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: CreatureParts
Primary tag: MonsterBits
Secondary tags: Arcane, Shadow
Tier: 3
Rarity: Rare
Quirk: 
Biomes: Underdark, Urban
Weight: 0.1
Price: 50
Description: Ectoplasmic residue from a ghost. Harvest: Alchemist's Kit (DC 15). Quantity: 1d4 flasks. Creature: Unrelated (special harvest condition).
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: true
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Air Elemental Wisp
```
Name: Air Elemental Wisp
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: CreatureParts
Primary tag: Environmental
Secondary tags: Air, Arcane
Tier: 4
Rarity: Very Rare
Quirk: 
Biomes: Desert, Mountain
Weight: 0.1
Price: 150
Description: Essence of an air elemental. Harvest: Alchemist's Kit (DC 15). Quantity: 1d6 wisps. Creature: Trade, Dead, or Incapacitated.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: true
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Earth Elemental Pebble
```
Name: Earth Elemental Pebble
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: CreatureParts
Primary tag: Environmental
Secondary tags: Earth, Arcane
Tier: 4
Rarity: Very Rare
Quirk: 
Biomes: Underdark
Weight: 0.5
Price: 150
Description: Essence of an earth elemental. Harvest: Alchemist's Kit (DC 15). Quantity: 1d6 pebbles. Creature: Trade, Dead, or Incapacitated.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: true
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Fire Elemental Ember
```
Name: Fire Elemental Ember
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: CreatureParts
Primary tag: Environmental
Secondary tags: Fire, Arcane
Tier: 4
Rarity: Very Rare
Quirk: 
Biomes: Desert, Mountain
Weight: 0.1
Price: 150
Description: Essence of a fire elemental. Harvest: Alchemist's Kit (DC 15). Quantity: 1d6 embers. Creature: Trade, Dead, or Incapacitated.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: true
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Water Elemental Droplet
```
Name: Water Elemental Droplet
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: CreatureParts
Primary tag: Environmental
Secondary tags: Water, Arcane
Tier: 4
Rarity: Very Rare
Quirk: 
Biomes: Coastal, Swamp, Underwater
Weight: 0.1
Price: 150
Description: Essence of a water elemental. Harvest: Alchemist's Kit (DC 15). Quantity: 1d6 droplets. Creature: Trade, Dead, or Incapacitated.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: true
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Giant's Fingernail
```
Name: Giant's Fingernail
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: CreatureParts
Primary tag: MonsterBits
Secondary tags: Bone
Tier: 4
Rarity: Very Rare
Quirk: 
Biomes: Hill, Forest, Arctic, Underdark, Mountain
Weight: 0.5
Price: 150
Description: A sliver of fingernail from a giant. Type determines Potion of Giant Strength effect. Harvest: Knife (DC 10). Quantity: 7 nails. Creature: Dead, Incapacitated, or trade.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: true
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Serpent's Venom
```
Name: Serpent's Venom
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: CreatureParts
Primary tag: Venom
Secondary tags: MonsterBits
Tier: 2
Rarity: Uncommon
Quirk: 
Biomes: Desert, Forest, Grassland, Swamp, Underdark, Urban
Weight: 0.1
Price: 10
Description: Venom from a giant poisonous snake. Weapon-coated: DC 11 CON save, 10 (3d6) poison damage on fail. Harvest: Poisoner's Kit (DC 10). Quantity: 1d3 vials. Creature: Dead or Incapacitated.
consumableType: poison
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: Damage
Activity name: Use
formula: 3d6
Activity effect type: damage
Activity effect die: d6
Activity effect bonus: 0
Damage type: poison
```

### Amphibian Saliva
```
Name: Amphibian Saliva
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: CreatureParts
Primary tag: MonsterBits
Secondary tags: 
Tier: 3
Rarity: Rare
Quirk: 
Biomes: Coastal, Desert, Forest, Swamp, Underdark
Weight: 0.1
Price: 50
Description: Saliva harvested from a giant toad. Harvest: Poisoner's Kit (DC 15). Quantity: 1d4 vials. Creature: Dead or Incapacitated.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Giant Wolf Spider Hair
```
Name: Giant Wolf Spider Hair
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: CreatureParts
Primary tag: MonsterBits
Secondary tags: 
Tier: 2
Rarity: Uncommon
Quirk: 
Biomes: Coastal, Desert, Forest, Grassland, Hill
Weight: 0.1
Price: 10
Description: Tufts of hair from a giant wolf spider. Harvest: Knife. Quantity: 1d8 tufts. Creature: Dead or Incapacitated.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Grey Ooze Residue
```
Name: Grey Ooze Residue
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: CreatureParts
Primary tag: MonsterBits
Secondary tags: Acid
Tier: 2
Rarity: Uncommon
Quirk: 
Biomes: Underdark
Weight: 0.1
Price: 10
Description: Residue from a grey ooze. Harvest: Alchemist's Kit (DC 15). Quantity: 1d4 vials. Creature: Dead.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Imp Heart
```
Name: Imp Heart
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: CreatureParts
Primary tag: MonsterBits
Secondary tags: Arcane
Tier: 4
Rarity: Very Rare
Quirk: 
Biomes: Coastal, Desert, Forest, Grassland, Hill, Mountain, Swamp, Underdark, Urban
Weight: 0.5
Price: 150
Description: The heart of an imp. Harvest: Knife (DC 15). Quantity: 1 heart. Creature: Dead.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: true
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Nothic Tears
```
Name: Nothic Tears
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: CreatureParts
Primary tag: MonsterBits
Secondary tags: Arcane
Tier: 3
Rarity: Rare
Quirk: 
Biomes: Urban, Underdark
Weight: 0.1
Price: 50
Description: When used as eyedrops, provides 1d4 hours of darkvision. Harvest: None (trade or collect). Quantity: 1d4 vials. Creature: Dead, Incapacitated, or trade.
consumableType: potion
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: true
Consumption magical: true
Activity type: 
Activity name: Use
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Purple Worm Poison
```
Name: Purple Worm Poison
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: CreatureParts
Primary tag: Venom
Secondary tags: MonsterBits
Tier: 5
Rarity: Legendary
Quirk: 
Biomes: Desert, Underdark
Weight: 0.1
Price: 500
Description: Weapon-coated: DC 19 CON save, 42 (12d6) poison damage on fail. Harvest: Poisoner's Kit (DC 20). Quantity: 1d8 vials. Creature: Dead or Incapacitated.
consumableType: poison
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: Damage
Activity name: Use
formula: 12d6
Activity effect type: damage
Activity effect die: d6
Activity effect bonus: 0
Damage type: poison
```

### Quipper Scale
```
Name: Quipper Scale
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: CreatureParts
Primary tag: MonsterBits
Secondary tags: 
Tier: 1
Rarity: Common
Quirk: 
Biomes: Underwater
Weight: 0.1
Price: 5
Description: Scales from a quipper. Harvest: Knife (DC 5). Quantity: 1d4 scales. Creature: Dead or Incapacitated.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Remorhaz Ichor
```
Name: Remorhaz Ichor
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: CreatureParts
Primary tag: MonsterBits
Secondary tags: Fire
Tier: 5
Rarity: Legendary
Quirk: 
Biomes: Arctic
Weight: 0.1
Price: 500
Description: Ichor from a remorhaz. Harvest: Alchemist's Kit (DC 20). Quantity: 1d6 or 3d6 vials. Creature: Dead or Incapacitated.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: true
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Skulk Claw
```
Name: Skulk Claw
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: CreatureParts
Primary tag: MonsterBits
Secondary tags: Bone
Tier: 3
Rarity: Rare
Quirk: 
Biomes: Coastal, Forest, Swamp, Underdark, Urban
Weight: 0.1
Price: 50
Description: Claws from a skulk. Harvest: Knife (DC 10). Quantity: 1d10 claws. Creature: Dead.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: true
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Dragon's Blood
```
Name: Dragon's Blood
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: CreatureParts
Primary tag: MonsterBits
Secondary tags: Blood, Arcane
Tier: 5
Rarity: Legendary
Quirk: 
Biomes: Coastal, Desert, Forest, Grassland, Hill, Mountain, Swamp, Underdark, Urban
Weight: 0.1
Price: 500
Description: Blood from a true dragon. Quantity depends on dragon size when dead; 1d4 when trading. Harvest: Knife (DC 10). Creature: Dead, Incapacitated, or Trade.
consumableType: trinket
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: true
Consumption magical: false
Activity type: 
Activity name: 
formula: 
Activity effect type: 
Activity effect die: 
Activity effect bonus:
Damage type:
```

### Wyvern Poison
```
Name: Wyvern Poison
Type: consumable
Source: Artificer - Potion Brewing and Ingredient Gathering
Artificer type: ingredient
Family: CreatureParts
Primary tag: Venom
Secondary tags: MonsterBits
Tier: 5
Rarity: Legendary
Quirk: 
Biomes: Hill, Mountain
Weight: 0.1
Price: 500
Description: Weapon-coated: DC 15 CON save, 24 (7d6) poison damage on fail. Harvest: Poisoner's Kit (DC 15). Quantity: 1d8 vials. Creature: Dead or Incapacitated.
consumableType: poison
Food type: 
Uses: 1
Max uses: 1
Destroy on empty: true
Magical: false
Consumption magical: false
Activity type: Damage
Activity name: Use
formula: 7d6
Activity effect type: damage
Activity effect die: d6
Activity effect bonus: 0
Damage type: poison
```

---

## Summary

| Category | Count |
|----------|-------|
| Gatherable Plants & Fungi | 39 |
| Inorganic Materials | 2 |
| Harvestable Creature Parts | 23 |
| **Total** | **64** |

**Note:** Charcoal, Flask of Oil, Ink, Sugar, and "finely ground iron" appear in recipes as mundane/supply ingredients (assumed included with tools) and are not listed as gatherable ingredients in the source document. Willowshade Oil is a crafted product from Willowshade Fruit.
