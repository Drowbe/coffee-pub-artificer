# Experimental Results — Import Spec

Full field specs for each crafted item produced by the experimentation engine. Use for Create Item form or Import. These are **standard D&D 5e items** (not artificer ingredients); Artificer fields are N/A.

---

## 1. Healing Tonic



**img:** `icons/consumables/potions/bottle-round-corked-red.webp`

---

## 2. Basic Remedy


**img:** `icons/consumables/potions/bottle-round-corked-green.webp`

---

## 3. Crude Metal Shard

| Field | Value |
|-------|-------|
| Name | Crude Metal Shard |
| Type | loot |
| Source | Artificer |
| License | |
| Artificer type | *(N/A — crafted result)* |
| Family | |
| Primary tag | |
| Secondary tags | |
| Tier | |
| Rarity | Common |
| Quirk | |
| Biomes | |
| Weight | 1 |
| Price | 5 |
| Description | A rough shard of metal from experimentation. |
| consumableType | *(N/A — loot)* |
| Food type | |
| Uses | |
| Max uses | |
| Destroy on empty | |
| Magical | false |
| Consumption magical | |
| Activity type | |
| Activity name | |
| formula | |
| Activity effect type | |
| Activity effect die | |
| Activity effect bonus | |
| Damage type | |

**img:** `icons/skills/melee/weapons-crossed-swords-yellow.webp`

---

## 4. Minor Arcane Dust

| Field | Value |
|-------|-------|
| Name | Minor Arcane Dust |
| Type | consumable |
| Source | Artificer |
| License | |
| Artificer type | *(N/A — crafted result)* |
| Family | |
| Primary tag | |
| Secondary tags | |
| Tier | |
| Rarity | Uncommon |
| Quirk | |
| Biomes | |
| Weight | 0.1 |
| Price | 25 |
| Description | Faintly glowing dust with arcane properties. |
| consumableType | other |
| Food type | |
| Uses | 1 |
| Max uses | 1 |
| Destroy on empty | true |
| Magical | true |
| Consumption magical | true |
| Activity type | use |
| Activity name | Use |
| formula | |
| Activity effect type | |
| Activity effect die | |
| Activity effect bonus | |
| Damage type | |

**img:** `icons/magic/symbols/runes-carved-stone-blue.webp`

---

## 5. Experimenter's Sludge

| Field | Value |
|-------|-------|
| Name | Experimenter's Sludge |
| Type | consumable |
| Source | Artificer |
| License | |
| Artificer type | *(N/A — crafted result)* |
| Family | |
| Primary tag | |
| Secondary tags | |
| Tier | |
| Rarity | Common |
| Quirk | |
| Biomes | |
| Weight | 0.5 |
| Price | 1 |
| Description | A failed experiment. Perhaps the combination was wrong, or more practice is needed. |
| consumableType | other |
| Food type | |
| Uses | 1 |
| Max uses | 1 |
| Destroy on empty | true |
| Magical | false |
| Consumption magical | false |
| Activity type | |
| Activity name | |
| formula | |
| Activity effect type | |
| Activity effect die | |
| Activity effect bonus | |
| Damage type | |

**img:** `icons/consumables/potions/bottle-round-corked.webp`

---

## Notes

- These items are **standard D&D 5e items**, not Artificer ingredients. Create them via the normal Item creation flow or a general item import (not the Artificer ingredient import).
- Healing Tonic and Basic Remedy need a Use activity with healing effect if you want them to function in combat. Adjust formula and effect as needed for your system.
- Place in world or compendium; the experimentation engine will look them up by name when crafting.
