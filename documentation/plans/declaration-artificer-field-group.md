# Artificer item field group — the list to build against

**Status: raw input for Blacksmith, for step 5.** This is the concrete field list requested
after they accepted `registerFieldGroup`. It supersedes the table in
[`declaration-artificer-item-flags.md`](declaration-artificer-item-flags.md), which stays
as the reasoning and the vocabulary sources. Delete both when the group exists upstream.

Every `guidance` string below is written to be the **only** authoring text for its field —
it replaces the corresponding lines in `prompt-item-partial-artificer.txt`. What could not
be reduced to a field is in `preamble`, and that is the whole of what remains of
`prompt-item-profile-artificer.txt`. Between them the two prompt files are fully accounted
for; nothing needs hosting.

---

## `appliesTo`

**All eight.** `loot`, `consumable`, `weapon`, `equipment`, `tool`, `container`, `feature`,
`spell`.

Not a hedge — the flags are orthogonal to the D&D type by design, which is the whole reason
this is a group rather than a profile. In practice authors reach for `loot` and `consumable`
constantly and `tool`/`container` regularly, but a flagged `weapon` is a legitimate crafted
result and we would rather not have the model tell an author otherwise. If you would prefer
an explicit list over `'*'` for safety, the eight above *are* the explicit list.

## `option`

```javascript
option: { id: 'includeArtificer', label: 'Artificer Item', default: false }
```

Matches today's checkbox (`registry-json-import-items.js:419`), which is
`{ id: 'artificerItem', label: 'Artificer Item', checked: false }`. Your sketch renamed it
to `includeArtificer`, which is the internal name today (`:427`). **Either is fine, but the
rename is a payload-visible change** if the option id ever appears in a saved import
config — check that before taking it. We have no attachment to the old spelling.

## `preamble`

> An item may be both a crafting material and a usable D&D 5e item. Many are: a healing
> herb can be chewed for minor healing, a natural poison can be applied, a magical crystal
> may have a Use activity. Do not reduce these to trinkets — if the item has a healing,
> poison, or magical use effect, give it the item type and activities that effect needs.
> Raw ores and pure reagents with no use effect are correctly plain loot.
>
> Artificer classification lives only in `flags["coffee-pub-artificer"]`. Never put
> `Component`, `Creation`, or `Tool` in the item type — those are the D&D 5e types, and
> the two vocabularies are unrelated.

Two paragraphs, and the second is the mistake authors actually make.

---

## `fields`

```javascript
fields: [
  {
    name: 'artificerType',
    path: 'flags.coffee-pub-artificer.artificerType',
    type: 'string',
    required: true,
    values: ['Component', 'Creation', 'Tool'],
    acceptsKeys: ['type'],          // legacy, read-only — see note 1
    example: 'Component',
    guidance: 'The Artificer classification: Component for raw materials found in the world, Creation for crafted results, Tool for the apparatus and containers that process them.'
  },
  {
    name: 'artificerFamily',
    path: 'flags.coffee-pub-artificer.artificerFamily',
    type: 'string',
    required: true,
    // Vocabulary is chosen by artificerType — see rules below. If a rule kind
    // cannot express that, leave `values` off and we keep the check.
    example: 'Plant',
    guidance: 'The family within the Artificer type. Component: CreaturePart, Environmental, Essence, Gem, Mineral, Plant. Creation: Food, Material, Poison, Potion. Tool: Apparatus, Container.'
  },
  {
    name: 'artificerTraits',
    path: 'flags.coffee-pub-artificer.artificerTraits',
    type: 'array',
    required: true,
    example: ['Herb', 'Medicinal'],
    guidance: 'Two to five traits describing what the item is good for. These drive recipe matching, so choose them as data rather than flavour, and do not repeat the type or family here. At most 20.'
  },
  {
    name: 'artificerSkillLevel',
    path: 'flags.coffee-pub-artificer.artificerSkillLevel',
    type: 'integer',
    required: false,
    default: 1,
    example: 1,
    guidance: 'Crafting difficulty, 1 to 20. 1-3 common, 4-9 uncommon, 10-14 rare, 15-19 very rare, 20 legendary.'
  },
  {
    name: 'artificerBiomes',
    path: 'flags.coffee-pub-artificer.artificerBiomes',
    type: 'array',
    required: false,
    default: [],
    example: ['FOREST', 'SWAMP'],
    values: ['MOUNTAIN', 'ARCTIC', 'PLANAR', 'COASTAL', 'SWAMP', 'DESERT',
             'UNDERDARK', 'FOREST', 'UNDERWATER', 'GRASSLAND', 'URBAN', 'HILL'],
    guidance: 'Where a Component naturally occurs. Required for Components, empty for everything else.'
  },
  {
    name: 'artificerQuirk',
    path: 'flags.coffee-pub-artificer.artificerQuirk',
    type: 'string',
    required: false,
    default: '',
    example: '',
    guidance: 'An optional note on a Component that changes how it is found or kept, such as "Degrades in sunlight". Usually blank.'
  },
  {
    name: 'artificerAffinity',
    path: 'flags.coffee-pub-artificer.artificerAffinity',
    type: 'string',
    required: false,
    default: '',
    example: '',
    values: ['Heat', 'Cold', 'Electric', 'Light', 'Shadow', 'Time', 'Mind', 'Life', 'Death'],
    guidance: 'The elemental affinity of an Essence. Required when the family is Essence, blank otherwise.'
  }
]
```

## `rules`

`field:value` now matches a scalar equalling the value as well as a list containing it
(Blacksmith, 2026-08-25), so two of our three rules are plain `requires` and need nothing
new:

```javascript
rules: [
  { kind: 'requires', when: 'artificerType:Component', then: ['artificerBiomes'] },
  { kind: 'requires', when: 'artificerFamily:Essence', then: ['artificerAffinity'] }
]
```

**The third rule stays on our side for this landing.** `artificerFamily`'s vocabulary is
chosen by `artificerType`, which is the same problem as `skill` reading valid ids from user
config at runtime: values not fixed at declaration time. Blacksmith is designing one
mechanism against both instances rather than a conditional-values rule that would not cover
the runtime case. Until it lands, `validateArtificerData` keeps that one check and
`artificerFamily` carries no `values` list — the only field in the group validating later
than the rest, and temporarily.

### Listed change: this rejects payloads that import today

Declaring rules 1 and 2 is **new enforcement**. Both are prose in
`prompt-item-partial-artificer.txt` today and unenforced in code, so payloads that currently
import will start failing:

| Payload | Today | After |
|---|---|---|
| `artificerType: 'Component'` with no `artificerBiomes` | imports | `RULE_REQUIRES` on `artificerBiomes` |
| `artificerFamily: 'Essence'` with no `artificerAffinity` | imports | `RULE_REQUIRES` on `artificerAffinity` |

We want this and we will wear it on our own content. Listed here rather than left to
surface in the parity check, because prose in a prompt that nothing enforces is a suggestion
wearing a contract's clothes, and enforcing it is most of the point of declaring.

---

## Notes

1. **`acceptsKeys: ['type']` is read-only.** `getArtificerTypeFromFlags`
   (`utility-artificer-item.js:388`) accepts a bare `type` key inside our namespace and maps
   legacy values through `LEGACY_TYPE_TO_ARTIFICER_TYPE`. Accept it so old payloads import;
   never emit it. Writer retires, reader keeps the fallback.

2. **No field here is `authorable: false`.** All seven are author-supplied; we have nothing
   editor-set or auto-discovered in this namespace, so nothing needs to survive re-import
   untouched.

3. **`example` on every field, `default` on only four.** There is deliberately no default
   for `artificerType`, `artificerFamily` or `artificerTraits` — an item omitting them
   should fail rather than silently become a Plant, which is what your current literal
   implies. The `['Herb', 'Medicinal']` and `'Plant'` examples are carried over from that
   literal because they are good examples; they are just not defaults.

4. **`artificerTraits` must not be absorbed by the `tags` fragment in step 9.** It drives
   ingredient matching — a wrong trait breaks crafting rather than mis-filing an entry.
