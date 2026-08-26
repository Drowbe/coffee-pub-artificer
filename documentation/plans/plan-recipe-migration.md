# Plan: migrating production recipes to the page subtype

Step 4 of [`plan-recipe-data-model.md`](plan-recipe-data-model.md), split out because it is
the only step that touches live worlds and the only one that cannot be undone by editing a
file.

---

## The split that makes this tractable

**There are two populations and they are not the same problem.**

| | Shipped compendium content | User-authored world recipes |
|---|---|---|
| Where | `packs/recipes-blueprints` and `packs/recipies` | journals in each GM's world |
| Volume | ~161 recipe pages across ~9 journals | unknown, per world |
| Owner | us | them |
| Mechanism | **authoring round trip** — import keeping ids, convert, export keeping ids | **in-world migration** |
| Risk | none to anyone else's world | irreversible |
| Reversible | yes — don't ship the pack | only from a backup |

**The shipped content is converted through the normal authoring round trip.** Import the
recipe journals to the world keeping ids, run the converter, export back keeping ids. It can
be redone from the compendium as often as needed, and nothing reaches a GM until the pack
ships.

Do this one first. It converts the largest body of content, and it is the best possible test
of the converter — 161 real recipes written over months, including whatever malformed ones
accumulated. Any defect the converter has surfaces here, against our own content, before it
meets anyone else's.

---

## The in-world migration

### Non-negotiables

1. **Dry run first, and it is the default.** Report what would convert, what would not parse,
   and what would be skipped. Writes nothing. A GM should be able to run this and learn the
   shape of their own data before deciding.

2. **Backup before any write.** Dump the complete source of every affected page to a JSON file
   the GM keeps. Not a setting, not a flag — a file, because the failure mode we are insuring
   against includes "the world will not load".

3. **Under-convert rather than over-convert.** A page converts only if `RecipeParser` returns a
   recipe **and** that recipe validates. A Cover Page, a prose page, a half-written note: all
   fail that test and are left exactly as they are. The cost of a missed recipe is a page that
   still works through the old reader. The cost of a wrongly converted Cover Page is a
   destroyed page. These are not symmetrical.

4. **Verify before deleting.** Create the subtype page, read it back, compare field-by-field
   against the parsed source. Delete the original only when they match. A mismatch aborts that
   page and reports it, leaving both.

5. **Idempotent and resumable.** Already-converted pages are skipped, not duplicated. A run
   interrupted halfway can be re-run.

6. **Preserve `sort` and `ownership`.** Mixed journals must not reorder, and a hidden recipe
   must not become visible. This is Librarian's `onReplace: { preserve: [...] }` case, and we
   hit it first — whatever this needs to hold is what we send Blacksmith.

### Decided: UUIDs survive, and the pack conversion happens in-world

**The pack is converted through the normal authoring round trip**, not offline: import
the recipe journals to the world keeping ids, run the converter, export back keeping ids.
An earlier draft of this plan called for an offline build step, which had a hole — the
packs are LevelDB and building valid subtype pages needs Foundry's registered data model.
The round trip keeps it all inside Foundry where validation actually runs, and still
exercises the converter against ~161 real recipes before it meets anyone's own content.

**Pages are recreated with `keepId: true`.** A page's `type` cannot be changed by update,
so conversion deletes and recreates. Without `keepId` every `@UUID` link a GM wrote to a
recipe page breaks silently. `sort` and `ownership` come across for the same reason: a
hidden recipe must not become visible, and a mixed journal must not reorder.

Implemented in [`macros/convert-recipes-to-subtype-macro.js`](../../macros/convert-recipes-to-subtype-macro.js).

### Why, in full

A page's `type` cannot be changed by update, so the page must be recreated. Two orders:

**Create then delete.** Safe — worst case is a duplicate, which a GM can remove by hand.
But the new page has a **new UUID**, so every `@UUID[...]` link to that recipe breaks, and our
own `journalPageId` references need rewriting.

**Delete then create with `keepId`.** UUIDs survive, links keep working. But there is a window
where the page exists only in memory, and a crash inside that window loses it — recoverable
only from the backup.

**Settled on `keepId`, given non-negotiable 2.** Link preservation is a certain, universal
benefit; the crash window is a narrow, unlikely one the backup already covers. Silently
breaking every link a GM wrote is worse than a recoverable crash.

### Order of operations, per journal

```
for each journal in the world:
    for each page, in sort order:
        skip if already the recipe subtype          (idempotent)
        skip if type is not 'text'                  (images, PDFs, video)
        recipe = RecipeParser.parse(page)
        skip and REPORT if recipe is null or invalid  (Cover Page lands here)
        record { id, name, sort, ownership, title, full source } to the backup
        delete page  →  create subtype page with same id, sort, ownership, title
        read back, compare against `recipe` field by field
        REPORT mismatch and stop touching this journal
```

Stopping the whole journal on the first mismatch is deliberate. A converter that is getting
one page wrong is probably getting others wrong, and continuing turns one bad page into
thirty.

### What still needs deciding

- **Locked compendia.** A GM's own recipe compendium cannot be written while locked. Report
  and require an explicit unlock rather than unlocking it for them — silently unlocking
  someone's pack is the kind of thing that should never be automatic.
- **Description.** The old format's description is HTML inside `div.recipe-description`; the
  new one is the page's `text.content`. Straight move, but it should carry the
  Description/Preparation/Notes outline structure where the source has none, so converted
  recipes and new ones read alike.
- **Where the old `heat` value goes.** Legacy pages carry `Heat:` with no `processType`. The
  parser already maps it; confirm the converter records `processType: 'heat'` explicitly
  rather than leaving it null and relying on the default.

---

## Sequence

1. ~~Build the converter.~~ **DONE** —
   [`macros/convert-recipes-to-subtype-macro.js`](../../macros/convert-recipes-to-subtype-macro.js).
   Dry run by default, backup before any write, verify after each recreate, stop the journal on
   the first mismatch.
2. Import the shipped recipe journals to a world keeping ids. Dry-run the converter and read
   the report: what converts, what is skipped and why, what fails.
3. Convert with `APPLY = true`. Spot-check pages, especially ones the report called unusual.
4. Export back to the compendium keeping ids. Ship it.
5. Only then point it at a GM's own world, on a copy first.
6. Send Blacksmith what `onReplace: { preserve: [...] }` actually needed to hold — currently
   `_id`, `sort`, `ownership` and `title`.
