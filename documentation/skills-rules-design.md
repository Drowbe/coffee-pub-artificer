# Skills Rules Design — Crafting Window Integration

**Purpose:** Define how `resources/skills-rules.json` (and per-skill/per-perk rules) drive the crafting experience so the window can adapt visibility, DC, and outcomes from learned perks. **No code in this document; design only.**

---

## 1. Review of Herbalism skill JSON (skills-details.json)

- **Structure:** One skill object with `id`, `name`, `perks[]`. Each perk has `perkID`, `name`, `description`, `requirement`, `cost`, `icon`, `perkLearnedBackgroundColor`. Good for UI and prerequisite resolution.
- **Recipe-tier language:** Perk descriptions use “recipes 0–1”, “0–7”, “8–14”, “15–20”. These align with recipe `skillLevel` (0–20): Field Forager → 0–1; Initiate of the Green Archive → 0–7; Keeper of Hidden Remedies → 8–14; Archdruid of the Verdant Codex → 15–20.
- **Minor:** One perk has `"icon": "mortar-pestle"`; Font Awesome usually expects `fa-mortar-pestle` or `fa-solid fa-mortar-pestle` for consistent rendering. Worth normalizing in data or in the code that builds `iconClass`.

The prose in `description` is perfect for the Details pane; for the **crafting engine** we need machine-readable rules that the window can look up by `skill` + learned perks.

---

## 2. Goals for rules

- **Recipe visibility:** If the actor does not have a perk that grants access to the recipe’s tier (by `skillLevel` or explicit range), show `?` instead of the recipe image and in details show: “You do not have the perk required to view this recipe.”
- **DC roll after process:** After the recipe process runs, roll vs recipe `successDC`. Perks can modify the DC or add a bonus to the roll (e.g. Conservator −1 DC when within tier; Experimental Botanist +3 DC when attempting above tier).
- **Ingredient consumption on success/failure:** e.g. “on failure lose only half (round up)” → after the DC roll, if failed, consume only half the ingredients (randomly keep half). Other perks might “on success consume half” (randomly keep some).
- **Extensibility:** One rules structure that can support Herbalism now and other skills (Alchemy, Poisoncraft, etc.) later, keyed by skill and perk.

---

## 3. Proposed structure for skills-rules.json

**Option A — Single file, keyed by skill then perkID**

- Top level: `{ "schemaVersion": 1, "skills": { "Herbalism": { "perks": { "perkID": { ... rules ... } } } } }`.
- Each perk’s value is an object of **rule blocks** (see below). The crafting window loads the file once, then for a given `skill` and list of `learnedPerkIDs` can merge/apply all rules for that skill whose perkIDs are learned.

**Option B — One file per skill**

- e.g. `resources/skills-rules/herbalism-rules.json` keyed by perkID. Slightly more modular but more files and loader logic; can be introduced later if needed.

**Recommendation:** Start with **Option A** in `resources/skills-rules.json`: one JSON with a `skills` map, each skill containing a `perks` map from `perkID` to a rules object. Easy to load next to `skills-details.json` and keeps one place to look per skill.

---

## 4. Rule blocks per perk (machine-readable)

Each perk in the rules file should describe **what** the perk does in terms the crafting window can execute, not replace the prose in `skills-details.json` (that stays for the Skills UI Details pane).

Suggested rule categories:

| Rule key | Meaning | Example (Herbalism) |
|----------|---------|---------------------|
| `recipeTierAccess` | Min/max recipe `skillLevel` (inclusive) this perk unlocks for **viewing** and **attempting** (unless overridden by experimental). | Field Forager: `[0, 1]`; Initiate: `[0, 7]`; Keeper: `[8, 14]`; Archdruid: `[15, 20]`. |
| `craftingDCModifier` | Additive modifier to the recipe’s `successDC` when this perk applies (e.g. only when within tier). | Conservator: `-1` when within tier. |
| `craftingRollBonus` | Bonus added to the player’s roll vs DC (stack with DC modifier as needed). | Could be used for future perks or other skills. |
| `ingredientLossOnFail` | On a failed DC roll, how many ingredients to consume. | Conservator: `"half"` (round up lost); default (no rule): lose all. |
| `ingredientKeptOnSuccess` | On success, optionally consume less than full (e.g. “keep half”). | Could be `"half"` or `{ "keep": 2 }` for “randomly keep 2”. |
| `experimentalCrafting` | Allow attempting recipes outside tier with special rules. | Experimental Botanist: `{ "allowed": true, "dcModifier": 3, "hiddenWrongIngredient": true }` (implementation detail: GM picks one wrong ingredient, etc.). |

**Aggregation:** For a given actor and skill, collect all learned perkIDs for that skill, then for each perkID look up its rules and **merge** (e.g. take max tier range that covers a level, sum DC modifiers and roll bonuses, and pick the most favorable ingredient-loss rule if multiple apply). So “effective recipe tier access” = union of all `recipeTierAccess` ranges; “effective DC modifier” = sum of applicable `craftingDCModifier`; etc.

---

## 5. Herbalism example rules (to put in skills-rules.json)

Conceptually, something like:

- **herbalism-field-forager:** `recipeTierAccess: [0, 1]`.
- **herbalism-green-archive-initiate:** `recipeTierAccess: [0, 7]` (replaces/extends 0–1).
- **herbalism-keeper-hidden-remedies:** `recipeTierAccess: [8, 14]`.
- **herbalism-archdruid-verdant-codex:** `recipeTierAccess: [15, 20]`.
- **herbalism-conservator-green-codex:** `craftingDCModifier: -1` (when recipe within actor’s tier access), `ingredientLossOnFail: "half"`, plus optional “salvage one once per session” (could be a separate rule or tracked in actor flags).
- **herbalism-experimental-botanist:** `experimentalCrafting: { "allowed": true, "dcModifier": 3 }` (and narrative/hidden ingredient handled in flow; critical success “learn recipe” can be a flag or GM discretion).

Gathering-only perks (Wildharvester, Verdant Master, Seasoned Pathfinder, Gentle Hand) don’t need crafting-window rules in this file unless we later add gathering UI that consumes the same rules.

---

## 6. How the crafting window would use the rules (flow)

1. **Load:** On init or when opening the crafting window, load `skills-details.json` (for display names / prerequisites) and `skills-rules.json` (for rule blocks).
2. **Actor context:** Get the current crafter’s learned perks (e.g. from SkillManager / actor flags) for the skill(s) relevant to the recipe journal (e.g. Herbalism).
3. **Visibility:** For each recipe (skill + skillLevel):
   - Compute effective tier access from rules: union of `recipeTierAccess` for all learned perks (and optionally Experimental Botanist “can attempt any”).
   - If recipe’s `skillLevel` is outside that range and no “experimental” bypass: show `?` for image and in details show “You do not have the perk required to view this recipe.” (Optionally still show name/tier so they know something is there.)
4. **Before craft:** When the user selects a recipe and starts the process, resolve DC: base = recipe `successDC`; add all applicable `craftingDCModifier` and (if implemented) `craftingRollBonus` for the roll. If Experimental and above tier, add +3 (or the value from rules).
5. **After process / DC roll:** Roll vs the resolved DC. On **success:** apply `ingredientKeptOnSuccess` if present (e.g. randomly keep half). On **failure:** apply `ingredientLossOnFail` (e.g. “half” = consume half, randomly keep the rest). Default: success = consume all listed; failure = consume all listed (or as you decide).
6. **Experimental / hidden ingredient:** If the attempt is experimental (above tier), the flow can inject “one hidden wrong ingredient” (GM choice or random) and adjust DC; critical success can set a flag so that recipe counts as “learned” for future sessions (GM discretion).

No code change in this doc — the above is the intended contract between `skills-rules.json` and the crafting window logic.

---

## 7. Summary

- **skills-details.json:** Stays as-is for Skills UI (names, descriptions, prerequisites, icons). Optional: normalize `icon` to `fa-*` where needed.
- **skills-rules.json:** New structure: `skills[skillId].perks[perkID]` → rule blocks (`recipeTierAccess`, `craftingDCModifier`, `craftingRollBonus`, `ingredientLossOnFail`, `ingredientKeptOnSuccess`, `experimentalCrafting`). Herbalism perks mapped as above.
- **Crafting window:** Uses rules to (1) show `?` and “no perk to view” when recipe tier not unlocked, (2) resolve DC and roll bonus after recipe process, (3) roll DC after process, (4) apply ingredient consumption on success/fail from rules. Experimental and “salvage one” can be implemented in the same flow with flags/session state.

This gives you a single place to define and extend crafting behavior per perk while keeping the narrative text in skills-details and the existing recipe schema (`skillLevel`, `successDC`) unchanged.
