# Skills Rules Design — Crafting & Gathering Integration

**Purpose:** Define how perk rules drive the crafting window and gathering logic. Rules are stored in the **skills ruleset JSON** (default `resources/skills-mapping.json`; world setting **Skills Ruleset JSON**) under each perk’s optional `rules.benefits` array. This doc describes the **actual implementation**: structure, rule keys, aggregation, and how the window/gather use them.

---

## 1. Relationship to the skills ruleset JSON

- **skills-mapping.json** (or the file chosen in module settings) is the single source of truth. Each skill has `id`, `name`, `perks[]`. Each perk has `perkID`, `name`, `description`, `requirement`, `cost`, `icon`, and optionally **rules** with a **benefits** array.
- **rules.benefits:** Optional. Each entry has **title**, **description**, and **rule**. The **description** is shown in the Skills window benefits list; the **rule** object is what the crafting and gathering code consumes.
- **scripts/skills-rules.js** loads that JSON and derives a rules lookup (by skill and perkID) from each perk’s `rules.benefits` for use by the crafting window and gather logic.
- **Strict loading:** If the file is missing, empty, invalid JSON, not an object, or missing a `skills` array, the loader notifies the GM and **throws** (no silent empty fallback). Cache clears on failure so fixing the file or setting retries.
- **Enabled skills:** Any skill with `skillEnabled === false` is excluded from “enabled” lists (gather UI checkboxes, scene harvesting defaults, recipe skill validation when the registry is loaded).
- **`skillKit` (per skill):** Display name of the D&D-style tool or kit tied to that skill (e.g. `"Herbalism Kit"`). The crafting window treats items whose **name** matches any enabled skill’s `skillKit` (or `extraKitNames`) as **tool** rows for the bench, in addition to name/type heuristics (e.g. name ending in `Kit`, `tool` + toolType).
- **`extraKitNames` (optional array of strings, per skill):** Extra item display names that should count as that skill’s kit in the crafting inventory list (e.g. a compendium that names the kit differently).
- **Optional `gatherDefaults` (root object):** Drives gather UI and scene fallbacks when flags/settings are unset:
  - `singleSkillIds` — default when a gather API needs exactly one skill list (e.g. internal normalization); if omitted, first enabled skill id.
  - `gatherWindowSkillIds` — default selected harvesting skills for Roll for Components when saved settings have no `skillIds`; if omitted, up to the first two enabled skills.
  - `dc` — default gather DC (1–30) when saved `dc` is unset/invalid; default 10 if omitted.
  - `harvestingSkillIds` — default scene “Harvesting skills” checkboxes when the scene has none saved; if omitted, **all** enabled skill ids.

---

## 2. Goals for rules

- **Recipe visibility:** If the actor has no perk granting access to the recipe’s tier (by `skillLevel`), show `?` and “You do not have the perk required to view this recipe.” Experimental perks can allow attempting any recipe with extra rules.
- **DC and roll:** Recipe `successDC` plus summed `craftingDCModifier` (within tier); when attempting above tier (experimental), add `experimentalCraftingDCModifier` to the **roll** as a bonus.
- **Ingredient consumption:** On success/failure, apply `ingredientLossOnFail` (e.g. `"half"`) and optionally `ingredientKeptOnSuccess`.
- **Gathering:** Roll bonus (summed), yield multiplier (max), component tier ranges (union), and on failed gather optionally grant a fixed component via `componentAutoGather`.
- **Extensibility:** Same structure supports multiple skills (Herbalism, Alchemy, etc.) and multiple benefits per perk.

---

## 3. Where rules live: skills ruleset JSON (perk.rules.benefits)

Rules are defined **per perk** in the configured skills JSON (default `resources/skills-mapping.json`). Each perk may include an optional `rules` object with a `benefits` array:

```json
{
  "perkID": "herbalism-field-forager",
  "name": "Field Forager",
  "description": "...",
  "requirement": "Herbalism Kit",
  "cost": 1,
  "icon": "fa-leaf",
  "rules": {
    "benefits": [
      { "title": "Recipe access", "description": "Unlocks recipe tiers 0 to 1.", "rule": { "recipeTierAccess": [0, 1] } },
      { "title": "Common Components", "description": "Unlocks components with skill requirements 0 to 3.", "rule": { "componentSkillAccess": [0, 3] } }
    ]
  }
}
```

- **Per perk:** `rules.benefits` is an array of `{ title, description, rule }`. Each **rule** is a plain object; one benefit can contribute one or more logical effects via a single rule object.
- **Loader behavior:** `skills-rules.js` loads the skills ruleset JSON once (cached; invalidated when the **Skills Ruleset JSON** setting changes), builds an in-memory map `skills[skillId].perks[perkID]` → `{ title, benefits }` from each perk’s `rules.benefits`, then for a given `skillId` and list of `learnedPerkIds` iterates over all benefits of those perks and collects every **rule** object. Aggregation is done over that stream of rule objects (see §5).

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

1. **Load:** On init or when opening the crafting/gather UI, load the skills ruleset JSON. `skills-rules.js` derives the rules lookup from each perk’s `rules.benefits`. Cached until the setting changes or cache is invalidated.
2. **Actor context:** Get the crafter’s learned perk IDs for the relevant skill (e.g. from SkillManager / actor flags). Filter to that skill via prefix (e.g. `herbalism-*`).
3. **Visibility:** Effective tier access = union of `recipeTierAccess`; if recipe’s `skillLevel` is outside that union and not allowed by `experimentalCrafting` (with matching `craftingType`), show `?` and “You do not have the perk required to view this recipe.”
4. **Before craft (within tier):** DC = recipe `successDC` + sum of `craftingDCModifier`. Roll vs DC; apply `ingredientLossOnFail` / `ingredientKeptOnSuccess` after roll.
5. **Before craft (experimental):** If recipe is above tier and actor has `experimentalCrafting` (and matching `craftingType`): (a) Add `experimentalCraftingRandomComponents` wrong components to the recipe, **randomizing which slots** they occupy; (b) add `experimentalCraftingDCModifier` to the **roll**; then roll vs DC and apply ingredient rules as above.
6. **Gathering:** Roll + sum of `gatheringRollBonus`; on success, yield multiplier = max of `gatheringYieldMultiplier`, and component eligibility = union of `componentSkillAccess`. On **failure**, if any rule has `componentAutoGather`, grant that component (e.g. one Herb Bundle).

---

## 8. Summary

- **Skills ruleset JSON:** Single source (default `skills-mapping.json`). Skills UI uses names, prerequisites, icons; perks may define `rules.benefits` for crafting/gathering. The loader builds an in-memory map `skills[skillId].perks[perkID]` → `{ title, benefits }` from those entries.
- **Rule keys:** Each benefit’s **rule** object can contain any of the keys in §4. The loader iterates all benefits of learned perks and aggregates as in §5.
- **Crafting window:** Uses rules for recipe visibility (tier + experimental with `craftingType`), DC and roll modifiers (within-tier and `experimentalCraftingDCModifier`), random wrong components (`experimentalCraftingRandomComponents`, randomized slots), and ingredient consumption.
- **Gathering:** Uses rules for roll bonus, yield multiplier, component tier ranges, and `componentAutoGather` on failed gather.

This matches the current implementation and the new rules you added: `componentAutoGather`, `experimentalCrafting.craftingType`, `experimentalCraftingRandomComponents` (randomized slot insertion), and `experimentalCraftingDCModifier`.
