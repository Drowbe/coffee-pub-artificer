# Coffee Pub Artificer  
### Crafting & Gathering System Design Document

---

## 1. Design Goals
- Create a fun, tactile, exploration-driven crafting loop.  
- Support gathering, salvaging, refining, experimenting, recipe-based crafting, and blueprint-driven aspirational items.  
- Keep the system simple enough to learn, but expandable enough to grow with the world.  
- Use tags to make combinations intuitive without requiring external tables or spreadsheets.  
- Make gathering feel playful, not like rolling dice.  
- Enable community contribution by establishing clear rules and conventions.

---

## 2. Core System Loop

### 2.1 Gathering
Players collect Raw Materials from:
- map interactables  
- gathering mini-games  
- biome or seasonal events  
- creature drops  
- environmental effects  

### 2.2 Refining & Salvage
Players break down:
- weapons  
- armor  
- junk  
- monster parts  

This produces Components used in advanced crafting.

### 2.3 Experimentation
Players combine up to three ingredients (raw, refined, essence) to create new items.  
Outcomes are based on tags rather than explicit recipes.  
Experimentation:
- always creates something  
- encourages discovery  
- reveals tags gradually  

### 2.4 Crafting (Recipes & Blueprints)
Recipes ensure predictable crafting.  
Blueprints represent multi-stage, aspirational crafting tied to narrative arcs.

---

## 3. Ingredient Taxonomy

### 3.1 Raw Materials  
Gathered directly from the world. They support exploration, ecology, and travel.

**Families**
- Herbs & Plants  
- Minerals & Ores  
- Gems & Crystals  
- Creature Parts  
- Environmental Materials  

**Tag Examples**
- Herb, Floral, Medicinal, Toxic  
- Metal, Ore, Alloy-Friendly  
- Crystal, Resonant, Arcane  
- MonsterBits, Bone, Venom  
- Water, Fire, Earth, Air, Corrupted  
- Biome: Alpine, Swamp, Cavern, Desert  

**Rules**
- 1 primary tag  
- 1–2 secondary tags  
- Optional quirk (rare, volatile, soothing)

---

### 3.2 Components (Refined Materials)  
Predictable intermediate items used for structured crafting.

**Types**
- Metals: Ingots, Plates, Wires  
- Alchemical Components: Extracts, Oils, Powders  
- Monster Components: Hardened Bone Shard, Spirit Ash  
- Arcane Components: Mana Thread, Runic Ink  
- Structural Components: Haft Cores, Leather Straps  

**Tags**
Refined, Alloy, Stabilized, Binding, Reactive, Haft, Plate

---

### 3.3 Essences & Affinities  
Magical or conceptual energies that determine item behavior.

**Examples**
- Essence of Heat  
- Essence of Frost  
- Storm Affinity  
- Shadow Affinity  
- Life Essence  
- Decay Essence  

**Tags**
Heat, Cold, Electric, Light, Shadow, Time, Mind, Life, Death

---

### 3.4 Finished Items
Crafted from:
- Components  
- Essences  
- Optional catalysts  
- Player skill  
- Workstation modifiers  

Categories include weapons, armor, consumables, tools, gadgets, trinkets, and arcane devices.

---

## 4. Tags & Tag Logic

### 4.1 Tag Rules
- Every ingredient has 2–5 tags.  
- Tags define category, effect, or behavior.  
- Tags are nouns/adjectives, not verbs.  
- Tags create predictable item families.  
- Tags never determine power level (that comes from tier, skill, station, etc.).  
- Tags reveal gradually:
  - first use: primary tag  
  - 3 uses: secondary tag  
  - 5 uses: quirk

### 4.2 Combination Rules
Crafts use up to three ingredients:
- Base Material (raw or component)  
- Essence/Affinity (optional but influential)  
- Structural component (optional but enhances quality)  

Tags determine:
- item category  
- essence/element  
- behavior  
- variant patterns  

Recipes and blueprints override or refine these outcomes.

---

## 5. Gathering System

### 5.1 Interactive Gathering
Gathering is interactive and playful.

Possible interactions:
- Sparkle/Wiggle nodes to click  
- Hot/Cold proximity indicators  
- Mini-games:
  - timing bar  
  - radial spinner  
  - quick-match icons  

These scale with biome, rarity, player skill, weather, and time of day.

### 5.2 Seasonal & Regional Logic
Materials may only appear:
- in specific biomes  
- during certain seasons  
- under special weather  
- at particular times of day  
- in clusters or zones  

Example: Frostcap Bloom grows only in alpine regions during early morning.

---

## 6. Salvage & Breakdown System

### 6.1 Salvage Rules
Salvaging yields predictable quantities of:
- structural components  
- metal or wood equivalents  
- monster components  
- essences (rare)  

### 6.2 Example: Goblin Spear
Salvage yields:
- Common Metal Scraps (Metal, Refined)  
- Crude Binding (Binding)  
- Grease Residue (MonsterBits)

---

## 7. Crafting System

### 7.1 Experimentation
Players freely combine ingredients.  
The system always produces:
- a valid item  
- a variant  
- or low-value sludge (never nothing)

### 7.2 Recipes
Recipes provide:
- predictable outcomes  
- reduced material cost  
- quality improvements  
- guaranteed variant unlocks  

Sources include books, NPCs, scrolls, dungeons, and discoveries.

### 7.3 Blueprints
Blueprints are multi-step, narrative-driven crafting requirements.

Blueprints require:
- multiple components  
- rare essences  
- special workstations  
- sufficient skill  
- staged assembly  

Example: The Arcanic Wayfinder.

---

## 8. Skill System

Lightweight skill categories:
- Herbalism  
- Metallurgy  
- Artifice  
- Alchemy  
- Monster Handling  

Skills increase through:
- successful crafting  
- quality results  
- tag discoveries  
- gathering mini-game success  
- salvaging rare items  

Skill levels gate advanced recipes and blueprints.

---

## 9. Workstations

Workstations influence:
- crafting quality  
- stability  
- recipe unlock chance  
- essence synergy  

Examples:
- Smithy Forge  
- Alchemist Table  
- Arcane Workbench  
- Cookfire Kit  
- Monster Research Bench  

Blueprints may require specific workstations.

---

## 10. Expansion & Community Guidelines

Creators must follow:
- one primary tag per ingredient  
- consistent family placement  
- no complicated quirks  
- 2–5 tags per ingredient  
- consistent naming conventions  
- refined components must remain standardized  
- blueprints must contain a narrative hook  

This preserves system stability.

---

## 11. JSON Structures (High-Level)
Future schemas will define:
- Ingredients  
- Components  
- Essences  
- Recipes  
- Blueprints  
- Items  
- Skills  
- Stations  

Expected fields include:
`name`, `type`, `tags`, `tier`, `rarity`, `source`, `effects`, `yield`, `quirk`.

---

## 12. System Capabilities
This crafting system supports:
- intuitive experimentation  
- narrative-driven rare-item creation  
- biome-based gathering  
- seasonal events  
- meaningful recipes  
- adaptive expansion  
- community-driven contributions  
- salvage loops that make every drop useful  
- exploration that rewards curiosity  

---
