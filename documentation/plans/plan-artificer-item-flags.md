# Artificer item flags, for Blacksmith's importer declarations

**Audience:** us, while the work is in flight

**Status: raw input for Blacksmith, not an Artificer plan.** Sent for step 5, which is
where Blacksmith's hosted copies of our prompt text stop being read. Delete when the
declaration exists upstream and `prompt-item-partial-artificer.txt` /
`prompt-item-profile-artificer.txt` are gone from Blacksmith's repo.

Format is friendly field to target path, matching Librarian's
`declaration-field-mappings.md`. "Required" is what `validateArtificerData`
(`scripts/utility-artificer-item.js:359`) actually throws on today.

---

## The shape problem, before the fields

**Our flag block is not a profile. It is an overlay on all eight of them.**

`registerDeclaration` is keyed `(kind, id)` and rejects a duplicate
(`registry-declarations.js:321-325`). Every declaration is a whole profile. But Artificer
items are not a ninth item type — an Artificer item *is* a loot, or a consumable, or a
tool, with our flag block added. That is exactly how it works today: `includeArtificer`
is a checkbox that layers one field group onto whichever of the eight profiles the author
picked (`registry-json-import-items.js:261-270, 418-441`).

So there is no `id` we can register under. Declaring `item/artificer` would create a
profile competing with the eight rather than composing with them, and declaring the block
eight times duplicates it and still cannot be opted into per import.

**What we think the model needs:** a way for a module to contribute a named, option-gated
*field group* to profiles of a kind, rather than a whole profile. `requiresOption` already
exists at field level (`manager-declarations.js:46`) and is most of the mechanism — the
missing half is a registration path that attaches a group to profiles it does not own.

Roughly:

```javascript
api.importer.registerFieldGroup({
  kind: 'item',
  id: 'artificer',
  module: 'coffee-pub-artificer',
  appliesTo: '*',                 // or an explicit profile id list
  option: { id: 'artificerItem', label: 'Artificer Item', default: false },
  fields: [ /* the table below */ ]
});
```

We are not attached to that spelling. We are flagging it now because you asked to hear it
before five more profiles are declared against the current shape, and because the answer
changes whether step 5 can drop our prompt files at all.

**Related, smaller:** `fetchPromptText` prefixes `modules/coffee-pub-blacksmith/prompts/`
(`utility-json-import-prompts.js:7`), so it cannot fetch from our module even once we host
the files. We would rather it never had to — a field group carries `guidance` per field,
which is where nearly all of our prompt text belongs. What does not decompose into
per-field guidance is the two paragraphs under "Specifics" and "Custom instructions" (the
material-versus-usable-item argument, and the "do not put Component/Creation/Tool in
itemType" warning). If a group can carry a `preamble` string alongside its fields, no
prompt file needs hosting anywhere and the hardcoded literal at
`registry-json-import-items.js:261` goes away with it. **We have copied both files into
our `prompts/` so you can delete yours whenever you like; we would rather they die than
move.**

---

## Fields — `flags["coffee-pub-artificer"]`

Vocabularies from [`scripts/schema-artificer-item.js`](../../scripts/schema-artificer-item.js);
biomes from [`scripts/schema-ingredients.js:36`](../../scripts/schema-ingredients.js#L36);
affinities from [`scripts/schema-essences.js:23`](../../scripts/schema-essences.js#L23).

| Friendly field | Target path | Type | Req | Allowed / notes |
|---|---|---|---|---|
| `artificerType` | `flags.coffee-pub-artificer.artificerType` | string | **yes** | `Component` \| `Creation` \| `Tool`. Selector for the family vocabulary below. **Never goes in `itemType`.** Read side also accepts a legacy bare `type` flag key — `acceptsKeys: ['type']` — see note 1. |
| `artificerFamily` | `...artificerFamily` | string | **yes** | Vocabulary depends on `artificerType`. Component: `CreaturePart`, `Environmental`, `Essence`, `Gem`, `Mineral`, `Plant`. Creation: `Food`, `Material`, `Poison`, `Potion`. Tool: `Apparatus`, `Container`. A family from the wrong type throws. |
| `artificerTraits[]` | `...artificerTraits[]` | array of string | **yes** | Non-empty in practice; free text, no fixed vocabulary. **Max 20** (`validateArtificerData:375`). Drives recipe matching, so these are data rather than flavour. Do not repeat type or family here. |
| `artificerSkillLevel` | `...artificerSkillLevel` | integer | no | **Minimum 1**, default 1. See note 2 — our shipped prompt is wrong about this. |
| `artificerBiomes[]` | `...artificerBiomes[]` | array of string | no† | `MOUNTAIN`, `ARCTIC`, `PLANAR`, `COASTAL`, `SWAMP`, `DESERT`, `UNDERDARK`, `FOREST`, `UNDERWATER`, `GRASSLAND`, `URBAN`, `HILL`. †Required in practice when `artificerType` is `Component`; unknown values are silently dropped, not rejected. `[]` for non-Components. |
| `artificerQuirk` | `...artificerQuirk` | string | no | Components only. Free text (`"Degrades in sunlight"`). Written only when non-empty — an empty string is not stored. |
| `artificerAffinity` | `...artificerAffinity` | string | no† | `Heat`, `Cold`, `Electric`, `Light`, `Shadow`, `Time`, `Mind`, `Life`, `Death`. †Required when `artificerFamily` is `Essence`. |

**Cross-field rules, currently enforced in code and better declared:**

1. `artificerFamily` is a member of `FAMILIES_BY_TYPE[artificerType]` — a closed
   vocabulary whose allowed set is chosen by another field. This is the one rule we cannot
   express with a flat `values` list.
2. `artificerType === 'Component'` implies `artificerBiomes` non-empty.
3. `artificerFamily === 'Essence'` implies `artificerAffinity` required.

Rules 2 and 3 are prose in the prompt and unenforced in code. We would rather they became
declared and enforced than stay advisory, but that is a behaviour change on our side and
we are not asking you to make it for us.

---

## Notes

1. **`type` as a flag key is a read-only legacy.** `getArtificerTypeFromFlags`
   (`utility-artificer-item.js:388`) falls back to a bare `type` key inside our namespace,
   and maps legacy values through `LEGACY_TYPE_TO_ARTIFICER_TYPE`. By the rule we settled
   in August — the writer retires a legacy field, the reader keeps its fallback — nothing
   should *write* it, so declare `artificerType` with `acceptsKeys: ['type']` if you want
   old payloads to keep importing, and never emit it.

2. **Our shipped prompt is wrong about `artificerSkillLevel` and should not be
   transcribed.** `prompt-item-partial-artificer.txt` documents a `0-3` band for common
   materials, but `validateArtificerData:380` throws on anything below 1. Recipes
   separately allow 0 (`SKILL_LEVEL_MIN = 0`, `schema-recipes.js`), which is where the 0
   came from. **The declared minimum is 1.** Flagging it because a straight port of the
   prompt text would encode a value the item path rejects — the same "encode a known bug
   into a declaration where it reads as deliberate" problem as the consumable activity
   type.

3. **The hardcoded literal's values are examples, not defaults, and one of them is
   wrong.** `registry-json-import-items.js:261-270` shows `artificerBiomes: []` alongside
   `artificerType: 'Component'`, which is the one combination rule 2 forbids. In
   declaration terms every one of those seven values is `example`, not `default`; there is
   no sensible default for `artificerType` or `artificerFamily`, and an item that omits
   them should fail rather than silently become a Plant.

4. **Nothing here is `authorable: false`.** All seven fields are author-supplied. We have
   no editor-set or auto-discovered flags in this namespace, so unlike codex there is
   nothing that must survive re-import untouched.

5. **`artificerTraits` is ours, not the shared `tags` fragment.** It drives recipe
   ingredient matching — a wrong trait breaks crafting rather than mis-filing an entry.
   When the `tags` fragment lands (step 9), it should not absorb this field.
