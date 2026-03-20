# Gathering Flow Design (Discovery + Harvest)

> **Purpose:** Define the cohesive gathering experience and data model for scene-based gathering spots, discovery, and harvesting.

## 1. Design Intent

Gathering should have two distinct moments:

1. **Discovery:** players explore and may or may not find gathering opportunities.
2. **Harvest:** players interact with discovered spots and may or may not extract components.

This replaces a flat "always-present spots" feel with a stronger gameplay loop.

## 2. Core Principle: Item-Level Difficulty

Difficulty and rarity should be driven by the **component item**, not by broad family defaults.

Why:
- Two items in the same family can have very different find/harvest difficulty.
- Example: `Dreamlily` (Common, Skill 1) vs `Fairy Stool` (Rare, Skill 12), both `Plant`.

Therefore:
- **Find difficulty/scarcity** should come from item-level rarity/scarcity signals.
- **Harvest difficulty/gating** should come from item-level `artificerSkillLevel` and perk-based access.

## 3. Two-Phase Loop

### Phase A: Discovery (Find Roll)

Inputs:
- Scene: habitats, component types, default DC, gather spot cap
- Actor: enabled harvesting skills, learned perks
- Item pool: component type + biome eligible records

Outputs:
- 0..N discovered gathering spots
- each spot has metadata (family/source pool/tier band/uses)
- N is capped by scene `gatherSpots`

### Phase B: Harvest (Per Spot)

Inputs:
- Spot metadata
- Scene default DC
- Actor skill/perk context

Outputs:
- success/failure/no-pool/consolation
- granted items (if any)
- spot consumed/depleted according to rules

## 4. Rarity-Band Discovery Model

Use a single Find roll to determine maximum rarity discoverable this attempt.

Conceptual bands:
- Very high result -> can discover `Very Rare` and below
- High result -> `Rare` and below
- Mid result -> `Uncommon` and below
- Low success -> `Common` only
- Failure -> no spots (or optionally 1 weak spot)

Then:
1. filter component records by scene habitats + component types
2. filter to rarity <= discovered band
3. sample records (weighted) to generate spot candidates
4. spawn spots up to cap

## 5. Harvest Resolution Model

For each harvested spot:
1. Verify enabled harvesting skill context for actor.
2. Apply perk roll bonuses.
3. Compare to harvest DC.
4. Enforce `componentSkillAccess` vs item `artificerSkillLevel`.
5. On success:
   - grant item(s)
   - apply `gatheringYieldMultiplier`
   - consume/deplete spot
6. On failure:
   - no yield unless `componentAutoGather` applies
   - spot behavior (remain/degrade/consume) is tunable

## 6. Data Inventory

### Scene-level (already present)
- `enabled`
- `habitats`
- `componentTypes`
- `harvestingSkills`
- `defaultDC`
- `gatherSpots`

### Item-level (already present)
- `artificerType` (must be `Component`)
- `artificerFamily`
- `artificerBiomes`
- `artificerSkillLevel`
- item rarity (system field)

### Skill/perk-level (already present)
- `gatheringRollBonus`
- `gatheringYieldMultiplier`
- `componentSkillAccess`
- `componentAutoGather`

### Spot-level (recommended metadata)
- `sourceBiome`
- `sourceFamily`
- `sourceRarityBand`
- `sourcePoolRef` or item UUID list
- `remainingUses` (default `1` for MVP)

## 7. Recommended MVP Rules

1. Keep current scene configuration model.
2. Add explicit **Find** action that spawns spots (instead of always pre-populating).
3. Use rarity-band discovery to build spot candidates.
4. Keep current harvest resolution and perk interactions.
5. Set spot uses to `1` initially.

## 8. Notes

- Family-level global modifiers are intentionally avoided; they flatten item identity.
- This model preserves meaningful differences across components within the same family.
- Visual mapping (default `resources/gathering-mapping.json`; world setting **Gathering Ruleset JSON**) remains orthogonal and drives spot appearance by biome/state/family.

