# Core Items Required

The experimentation engine uses **only** world items. It never creates items from hardcoded templates. You must create these items in the Items directory before tag-based crafting can succeed.

**Exact name required.** The engine looks up items by name; spelling and punctuation must match exactly.

---

## Experimentation Results (Tag-Based Crafting)

| Item Name | Tag Combo | Type | Notes |
|-----------|-----------|------|-------|
| Healing Tonic | Herb + Medicinal + Life | consumable (potion) | Restorative potion |
| Basic Remedy | Herb + Medicinal (no essence) | consumable | Simple herbal remedy |
| Crude Metal Shard | Metal + Ore | loot | Rough metal from smelting |
| Minor Arcane Dust | Crystal + Arcane + (Life/Heat/Cold/Shadow/Light/Electric) | consumable | Faintly glowing arcane dust |
| Experimenter's Sludge | * (fallback) | consumable | Failed experiment; any invalid combo |

---

## Item Definitions

Create these in the Items directory (right-click Items sidebar → Create Item). The file `example-core-items.json` contains reference JSON for use with a macro or import module (e.g. `Item.createDocuments(data)`).

### 1. Healing Tonic

- **Name:** Healing Tonic
- **Type:** Consumable
- **Subtype:** potion
- **Image:** `icons/consumables/potions/bottle-round-corked-red.webp`
- **Weight:** 0.5
- **Price:** 50 gp
- **Rarity:** Common
- **Description:** A restorative potion created through experimentation.
- **Consumable Type:** potion
- **Uses:** 1 of 1, per charges
- **Optional:** Add a Use activity with healing formula (e.g. 2d4+2 HP) if you want combat use.

---

### 2. Basic Remedy

- **Name:** Basic Remedy
- **Type:** Consumable
- **Subtype:** other
- **Image:** `icons/consumables/potions/bottle-round-corked-green.webp`
- **Weight:** 0.25
- **Price:** 10 gp
- **Rarity:** Common
- **Description:** A simple herbal remedy.
- **Consumable Type:** other
- **Uses:** 1 of 1, per charges

---

### 3. Crude Metal Shard

- **Name:** Crude Metal Shard
- **Type:** Loot
- **Image:** `icons/skills/melee/weapons-crossed-swords-yellow.webp`
- **Weight:** 1
- **Price:** 5 gp
- **Rarity:** Common
- **Description:** A rough shard of metal from experimentation.

---

### 4. Minor Arcane Dust

- **Name:** Minor Arcane Dust
- **Type:** Consumable
- **Subtype:** other
- **Image:** `icons/magic/symbols/runes-carved-stone-blue.webp`
- **Weight:** 0.1
- **Price:** 25 gp
- **Rarity:** Uncommon
- **Description:** Faintly glowing dust with arcane properties.
- **Consumable Type:** other
- **Uses:** 1 of 1, per charges

---

### 5. Experimenter's Sludge

- **Name:** Experimenter's Sludge
- **Type:** Consumable
- **Subtype:** other
- **Image:** `icons/consumables/potions/bottle-round-corked.webp`
- **Weight:** 0.5
- **Price:** 1 gp
- **Rarity:** Common
- **Description:** A failed experiment. Perhaps the combination was wrong, or more practice is needed.
- **Consumable Type:** other
- **Uses:** 1 of 1, per charges

---

## Notes

- These are **standard D&D 5e items**, not Artificer ingredients. Do not add Artificer flags.
- If a world item is missing when crafting would produce it, the engine returns an error directing you to this document.
- You can place items in folders (e.g. Crafted Potions, Crafted Objects) and still use them—the engine searches `game.items` by name.
