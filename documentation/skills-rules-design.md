# Skills Rules Design — Crafting & Gathering Integration

**Purpose:** Define how `resources/skills-rules.json` drives the crafting window and gathering logic. This doc describes the **actual implementation**: structure, rule keys, aggregation, and how the window/gather use them.

---

## 1. Relationship to skills-details.json

- **skills-details.json:** One skill object with `id`, `name`, `perks[]`. Each perk has `perkID`, `name`, `description`, `requirement`, `cost`, `icon`. Used for Skills UI (names, prerequisites, icons) and for human-readable perk names in messages.
- **skills-rules.json:** Machine-readable rules keyed by skill and perk. Each perk entry has a **title** and a **benefits** array; each benefit has **title**, **description**, and **rule**. The **description** is shown in the Skills window benefits list; the **rule** object is what the crafting and gathering code consumes. So one file drives both UI copy and engine behavior.

---

## 2. Goals for rules

- **Recipe visibility:** If the actor has no perk granting access to the recipe’s tier (by `skillLevel`), show `?` and “You do not have the perk required to view this recipe.” Experimental perks can allow attempting any recipe with extra rules.
- **DC and roll:** Recipe `successDC` plus summed `craftingDCModifier` (within tier); when attempting above tier (experimental), add `experimentalCraftingDCModifier` to the **roll** as a bonus.
- **Ingredient consumption:** On success/failure, apply `ingredientLossOnFail` (e.g. `"half"`) and optionally `ingredientKeptOnSuccess`.
- **Gathering:** Roll bonus (summed), yield multiplier (max), component tier ranges (union), and on failed gather optionally grant a fixed component via `componentAutoGather`.
- **Extensibility:** Same structure supports multiple skills (Herbalism, Alchemy, etc.) and multiple benefits per perk.

---

## 3. Actual structure of skills-rules.json

We use **Option A — single file**, keyed by skill then perkID:

```json
{
  "schemaVersion": 1,
  "skills": {
    "Herbalism": {
      "perks": {
        "herbalism-field-forager": {
          "title": "Field Forager",
          "benefits": [
            { "title": "Recipe access", "description": "...", "rule": { "recipeTierAccess": [0, 1] } },
            { "title": "Common Components", "description": "...", "rule": { "componentSkillAccess": [0, 3] } }
          ]
        }
      }
    }
  }
}
```

- **Top level:** `schemaVersion`, `skills`.
- **Per skill:** `skills[skillId]` is an object with a **perks** map: `perks[perkID]` → `{ title, benefits[] }`.
- **Per perk:** `title` (display name for this perk in rules-derived UI). `benefits` is an array of `{ title, description, rule }`. Each **rule** is a plain object; one benefit can contribute one or more logical effects via a single rule object (e.g. `recipeTierAccess` only, or `experimentalCrafting` + separate benefits for wildcard and DC bonus).
- **Loader behavior:** The code loads the file once, then for a given `skillId` and list of `learnedPerkIds` for that skill, iterates over **all benefits** of those perks and collects every **rule** object. Aggregation is done over that stream of rule objects (see §5).

So we do **not** use a single flat rule block per perk; we use **multiple benefits per perk**, each with its own rule. That allows one perk to contribute e.g. recipe access, component access, and gathering bonus in separate, mergeable rules.

---

## 4. Rule keys (implementation)

What the crafting window and gather logic actually read. Each rule object may contain any of these keys; the loader aggregates across all rules from learned perks (see §5).

### 4.1 Crafting (recipe visibility, DC, ingredients)

| Rule key | Meaning | Value | Example |
|----------|---------|--------|---------|
| `recipeTierAccess` | Recipe `skillLevel` range (inclusive) this benefit unlocks for viewing and attempting. | `[min, max]` | `[0, 7]` |
| `craftingDCModifier` | Additive modifier to recipe DC when crafting **within** tier. | number | `-1`, `1` |
| `ingredientLossOnFail` | On failed DC roll, how much to consume. | `"all"` (default) or `"half"` | `"half"` |
| `ingredientKeptOnSuccess` | On success, optionally keep some ingredients. | `"half"` or undefined | `"half"` |
| `experimentalCrafting` | Allows attempting recipes **above** tier with extra rules. | `{ "allowed": true, "craftingType"?: "herbalism" }` | See §6.2 |
| `experimentalCraftingRandomComponents` | Number of **wrong** components to add to the recipe; slots randomized. | number | `1` |
| `experimentalCraftingDCModifier` | Bonus added to the **crafting roll** when attempting experimentally. | number | `3` |

- **experimentalCrafting.craftingType:** Identifies which crafting type(s) this experimental permission applies to (e.g. `"herbalism"`). Used to allow experimental attempts only for that type; other types still require normal tier access.
- **experimentalCraftingRandomComponents:** When the user attempts a recipe above tier (experimental), we add this many extra components to the recipe. Each extra is a “wrong” ingredient; the player must figure out which to remove. **Slot placement:** we randomize which slots the extras go into (e.g. if the recipe has 3 components, we insert 1 extra into one of the 4 possible positions, not always at the end).
- **experimentalCraftingDCModifier:** Because of the risk (wrong ingredients), we give a roll bonus when the attempt is experimental. This is added to the **roll**, not subtracted from the DC.

### 4.2 Gathering (roll, yield, components, fail consolation)

| Rule key | Meaning | Value | Example |
|----------|---------|--------|---------|
| `gatheringRollBonus` | Bonus added to the gathering roll. | number | `2`, `4` |
| `gatheringYieldMultiplier` | On success, multiply bundles by this (take **max** if multiple perks). | number | `2` |
| `componentSkillAccess` | Skill-level range for components that can drop from this gather. | `[min, max]` | `[0, 3]`, `[4, 9]` |
| `componentAutoGather` | When gathering **fails**, still grant this fixed component (e.g. one bundle). | string (component name) | `"Herb Bundle"` |

- **componentAutoGather:** “You waste nothing. When gathering fails, you always get an Herb Bundle.” The gather logic, on a failed roll, should grant the specified component (e.g. one Herb Bundle) in addition to or instead of nothing.

### 4.3 Reserved / future

| Rule key | Meaning | Notes |
|----------|---------|--------|
| `craftingRollBonus` | Bonus to the crafting **roll** (within tier). | Design supports it; can be wired when needed. |

---

## 5. Aggregation (what we actually do)

For a given **skill** and **learned perk IDs** for that skill, the loader:

1. Collects every **rule** from every **benefit** of those perks (no deduplication by perk).
2. **Recipe tier access:** Union of all `recipeTierAccess` ranges. A recipe with `skillLevel` in any range (or allowed by experimental) is viewable/attemptable.
3. **Crafting DC (within tier):** Sum of all `craftingDCModifier` values.
4. **Experimental:** If any rule has `experimentalCrafting.allowed === true` and (if present) `craftingType` matches the recipe’s skill/type, the actor can attempt above-tier recipes. For that attempt:
   - **Random wrong components:** Max of all `experimentalCraftingRandomComponents` (e.g. 1) — that many extra components are inserted into the recipe; **slot positions are randomized** (not just appended at the end).
   - **Roll bonus:** Sum of all `experimentalCraftingDCModifier` values (e.g. +3) added to the crafting roll.
5. **Ingredient loss on fail:** If any rule has `ingredientLossOnFail: "half"`, use “half”; else “all”.
6. **Ingredient kept on success:** If any rule has `ingredientKeptOnSuccess: "half"`, use “half”; else consume all.
7. **Gathering roll bonus:** Sum of all `gatheringRollBonus`.
8. **Gathering yield multiplier:** Max of all `gatheringYieldMultiplier`.
9. **Component skill access (gathering):** Union of all `componentSkillAccess` ranges for which components can drop.
10. **Component auto-gather on fail:** If any rule has `componentAutoGather`, the gather logic uses it (e.g. grant one “Herb Bundle” on failed gather). If multiple perks grant different values, implementation may pick one (e.g. first or a designated priority).

---

## 6. New rules in detail

### 6.1 componentAutoGather (gathering fail consolation)

- **Intent:** When a gathering roll **fails**, the actor still receives a fixed component (e.g. one Herb Bundle) so they “waste nothing.”
- **Value:** String naming the component to grant (e.g. `"Herb Bundle"`). The gather module must resolve this to the actual item/compendium entry and grant one unit on failed gather.
- **Example:** Gentle Hand of the Grove: `{ "componentAutoGather": "Herb Bundle" }`.

### 6.2 experimentalCrafting (type-scoped)

- **Intent:** Allow attempting recipes above the actor’s tier for **specific** crafting types (e.g. herbalism only).
- **Value:** `{ "allowed": true, "craftingType": "herbalism" }`. `craftingType` identifies which skill/type this experimental permission applies to.
- **Use:** When deciding if an actor can attempt a recipe above their tier, check that they have a benefit with `experimentalCrafting.allowed === true` and (if `craftingType` is present) that it matches the recipe’s skill/type.

### 6.3 experimentalCraftingRandomComponents (ingredient wildcard)

- **Intent:** When attempting a recipe above tier, add **wrong** components to the recipe so the player must figure out which to remove. The number of extras is from this rule; **which slots they go into is randomized** (not always at the end).
- **Value:** Number (e.g. `1`). Number of extra components to insert. Each extra is a “wildcard” wrong ingredient; slots are randomized among the possible positions (e.g. for 3 real components + 1 wildcard, the wildcard can appear in position 1, 2, 3, or 4).
- **Example:** Experimental Botanist: `{ "experimentalCraftingRandomComponents": 1 }` — “one of the components shouldn’t be there; remove it.”

### 6.4 experimentalCraftingDCModifier (roll bonus for risk)

- **Intent:** Because experimental attempts are riskier (wrong ingredients), give a **bonus to the crafting roll** when the attempt is experimental.
- **Value:** Number (e.g. `3`). Added to the player’s roll when the recipe is being attempted above tier under experimental rules.
- **Example:** Experimental Botanist: `{ "experimentalCraftingDCModifier": 3 }` — “you get a +3 bonus to your crafting roll.”

---

## 7. How the crafting window and gather use the rules (flow)

1. **Load:** On init or when opening the crafting/gather UI, load `skills-rules.json` (and `skills-details.json` for names/icons). Cached for the session.
2. **Actor context:** Get the crafter’s learned perk IDs for the relevant skill (e.g. from SkillManager / actor flags). Filter to that skill via prefix (e.g. `herbalism-*`).
3. **Visibility:** Effective tier access = union of `recipeTierAccess`; if recipe’s `skillLevel` is outside that union and not allowed by `experimentalCrafting` (with matching `craftingType`), show `?` and “You do not have the perk required to view this recipe.”
4. **Before craft (within tier):** DC = recipe `successDC` + sum of `craftingDCModifier`. Roll vs DC; apply `ingredientLossOnFail` / `ingredientKeptOnSuccess` after roll.
5. **Before craft (experimental):** If recipe is above tier and actor has `experimentalCrafting` (and matching `craftingType`): (a) Add `experimentalCraftingRandomComponents` wrong components to the recipe, **randomizing which slots** they occupy; (b) add `experimentalCraftingDCModifier` to the **roll**; then roll vs DC and apply ingredient rules as above.
6. **Gathering:** Roll + sum of `gatheringRollBonus`; on success, yield multiplier = max of `gatheringYieldMultiplier`, and component eligibility = union of `componentSkillAccess`. On **failure**, if any rule has `componentAutoGather`, grant that component (e.g. one Herb Bundle).

---

## 8. Summary

- **skills-details.json:** Unchanged for Skills UI (names, prerequisites, icons). Used alongside rules for human-readable perk names.
- **skills-rules.json:** Actual structure is `skills[skillId].perks[perkID]` → `{ title, benefits: [{ title, description, rule }] }`. Each benefit’s **rule** object can contain any of the keys in §4. The loader iterates all benefits of learned perks and aggregates as in §5.
- **Crafting window:** Uses rules for recipe visibility (tier + experimental with `craftingType`), DC and roll modifiers (within-tier and `experimentalCraftingDCModifier`), random wrong components (`experimentalCraftingRandomComponents`, randomized slots), and ingredient consumption.
- **Gathering:** Uses rules for roll bonus, yield multiplier, component tier ranges, and `componentAutoGather` on failed gather.

This matches the current implementation and the new rules you added: `componentAutoGather`, `experimentalCrafting.craftingType`, `experimentalCraftingRandomComponents` (randomized slot insertion), and `experimentalCraftingDCModifier`.
