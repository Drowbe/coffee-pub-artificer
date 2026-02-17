# Baseline Ingredients Checklist

Items to create for a minimal Artificer baseline. Use the Create Item form or Import Items with JSON derived from these specs.

**Format:** Each block lists the variables needed. For ingredients: use Family. For components: use Component type (replaces Family).

---
NEEDED INGREDIENTS and COMPONENTS

## Experimental Results (Crafted Items)

These items are produced by the experimentation engine when crafting. **They must exist as Items in the world.** The module uses only world items—no hardcoded templates. See `documentation/core-items-required.md` for full item definitions.

| Item Name | Tag Combo | Type | Notes |
|-----------|-----------|------|-------|
| Healing Tonic | Herb + Medicinal + Life | consumable (potion) | Restorative potion |
| Basic Remedy | Herb + Medicinal (no essence) | consumable | Simple herbal remedy |
| Crude Metal Shard | Metal + Ore | loot | Rough metal from smelting |
| Minor Arcane Dust | Crystal + Arcane + (Life/Heat/Cold/Shadow/Light/Electric) | consumable | Faintly glowing arcane dust |
| Experimenter's Sludge | * (fallback) | consumable | Failed experiment; any invalid combo |

## Containers (Crafting Tools)

Items used as the container slot (beaker, mortar, etc.). Must have `flags.artificer.type = "container"`.

| Item Name | Notes |
|-----------|-------|
| Beaker | Glass vessel for liquid mixtures |
| Vial | Small vessel for concentrates and essences |
| Mortar and Pestle | For grinding and blending solids |
| Crucible | Heat-resistant container for metal/alchemy |
| Mixing Bowl | General-purpose container |
| Herb Bag | Cloth pouch for steeping and cold infusions |

---
COMPLETE INGREDIENTS

## Plants & Herbs
1. Lavender
2. Sage
3. Acid Dew
4. Angel's Trumpet
5. Ashblossom
6. Bane Berry
7. Black Thistle
8. Cat's Tongue
9. Death Cap
10. Dreamlily
11. Everfrost Berries
12. Fairy Stool
13. Fire Peas
14. Flame Lily
15. Frost Lichen
16. Gillyweed
17. Hagfinger
18. Idle Claws

## Mushrooms & Fungi
19. Black Cup Mushroom

## Processed / Concentrated
20. Black Sap
21. Blight Spores

## Components
22. Iron Ingot
23. Herbal Extract

## Creature Parts
24. Bone Shard

## Gems
25. Ruby Dust

---

## Summary: What Each Item Enables

| Item | Enables |
|------|---------|
| Lavender | Healing Tonic (with Life Essence), Basic Remedy |
| Sage | Healing Tonic (with Life Essence), Basic Remedy |
| Iron Ingot | Component for future recipes; Metal + Refined |
| Herbal Extract | Component for future recipes; Medicinal base |
| Bone Shard | CreatureParts for future recipes |
| Ruby Dust | Minor Arcane Dust (with essence); alternate to Quartz |

**You already have:** Essences, plants, Spring Water, Quartz, Iron Ore, Spider Venom.  
**Baseline fill-ins:** Lavender or Sage (Herb+Medicinal), Iron Ingot, Herbal Extract.  
**Nice-to-have:** Bone Shard, Ruby Dust.
