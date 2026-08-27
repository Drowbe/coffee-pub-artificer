# Coffee Pub Artificer

Foundry VTT module (`coffee-pub-artificer`) for D&D 5e: gathering components, authoring recipes, and
crafting. A **consumer** of Coffee Pub Blacksmith, not a hub — Blacksmith is a hard dependency and owns
windows, the menubar, chat cards, pins, tags and the JSON importer.

D&D 5e / Foundry v13 (`minimum: 13`, `verified: 13`, `maximum: 14`). Requires `coffee-pub-blacksmith`.

**Before starting: confirm the session's working directory is this module's folder.** Reaching this repo
through an additional working directory works fine, which is what makes a mismatch easy to miss — editing
succeeds, but the session reads and writes the *wrong project's* memory and scratchpad.

## Suite context

Sibling modules live next to this one in `Data/modules/` and are readable: blacksmith, bibliosoph,
cartographer, crier, curator, herald, librarian, minstrel, monarch, regent, scribe, squire, vault.

- `coffee-pub-blacksmith` is the API hub. Its public surface is a contract; we consume it, never edit it.
- `coffee-pub-librarian` owns codex and quests, and declares its own `JournalEntryPage` subtype. We declare
  ours (`coffee-pub-artificer.recipe`). Neither documents the other.
- `coffee-pub-campaigns` is a **backup**, not live code. Never edit it.
- `burden-of-knowledge` is **live campaign data, not ours to touch.**

**Module boundaries.** Artificer's docs describe Artificer only. Showing how we *call* Blacksmith's API is
fine — that documents our usage. Documenting Blacksmith's internals here is not.

**Each module bundles its own compendiums.** Don't rely on cross-module content cohesion.

## No build, no tests

A plain no-build Foundry module — Foundry loads the ES modules directly. There is **no test suite, linter,
or formatter**. Don't go looking for one, and don't add a build step casually.

Because there is no test framework, `node --input-type=module --check` is the cheapest syntax gate — and note
the `--input-type=module` part: a plain `node --check` parses as a script and will miss module-scope errors
like redeclaring a parameter with `const`. It catches *syntax* only. Ordering bugs (temporal dead zone),
wrong lifecycle hooks, and everything visual need a live world.

## The change workflow

The docs are the source of truth; the code is reality. They stay honest only if updating them is *part of
the change*, not a later chore.

Name the outcome first — **bug fix / feature / performance / refactor** — because it sets the bar (a bug fix
skips the plan step; nothing else does).

1. **Orient in the docs.** Read `documentation/architecture-artificer.md` and the relevant `TODO.md` entries
   with the outcome in mind. These are the anti-crawl artifacts — start here, not in the code.
2. **Reality-check against the code.** Grep and read the source before trusting a doc.
3. **Plan — anything larger than a bug fix.** Write it in `documentation/plans/`. Deleted once implemented,
   its content distributed to architecture and the CHANGELOG.
4. **Break the work into `TODO.md` items,** each carrying how it will be verified.
5. **Make the change.**
6. **Test it — and state how.** Every change names its verification: the exact steps in a live world, or the
   console check. If the only check is "client loads with no errors," say exactly that.
7. **Author reviews and commits.** Claude prepares reviewable changes; the author commits.
8. **Update architecture** to describe the new reality.
9. **Update `CHANGELOG.md`** under `## [Unreleased]`, or under the next version if the author has already
   named one. **Never add to a version that has shipped.**
10. **Delete completed TODOs.** They live in the CHANGELOG now. Never keep a done item "for reference."
11. **Version bump + BUILD commit — author.** The author bumps `module.json` and bundles the final docs,
    CHANGELOG and todo deletions with it.

**Never hold TODOs in the architecture doc.** That is how docs drift. Architecture describes what *is* —
including "this is currently broken, and here is the truth" when that is the reality. Anything shaped like
"we should…", "TODO:", or a task list belongs in `TODO.md` and nowhere else.

### Formatting standard for docs

- **No emoji or decorative icons** — not in headings, prose, tables, or example output.
- **No styled callout blocks.** State it as prose.
- **ASCII quotes and apostrophes**, not curly ones.
- **No footers or status-theatre** — no "Last Updated", no "Status: production ready", no "Version History"
  (that is what `CHANGELOG.md` is for).
- **No task lists or checkboxes** outside `TODO.md`.
- **Point at code, don't copy it.** `file.js:line` pointers beat pasted classes and signature tables. Every
  copied block drifts; pointers do not.

### CHANGELOG style

Keep-a-Changelog + SemVer. `### Added` / `### Changed` / `### Fixed`, a bold lead-in, then prose saying
*why* — what was wrong, what it caused, what it is now. **Code changes are the priority.** A reader should
be able to tell whether a fix affects them.

## Conventions

**Blacksmith base classes come in by `import`, never from `game.modules.get()`.** `extends` evaluates when
the module script evaluates, before `game` exists, and ES modules cache a failed evaluation — so reading it
off the api object disables Artificer for the whole session rather than retrying. Import from
`/modules/coffee-pub-blacksmith/api/blacksmith-api.js`.

**ApplicationV2 does not call `activateListeners`.** Use `_onRender`. Several windows here use document-level
click delegation for the same reason; if a control silently does nothing, check which hook wired it.

**Don't register one action twice.** An entry in `DEFAULT_OPTIONS.actions` *and* a branch in the
document-level delegation both fire on one click — that is how a form once created two items per submit.

**A page's `type` cannot be changed by update.** Converting means delete-and-recreate with `keepId: true`,
or every `@UUID` link to it breaks silently. Carry `sort`, `ownership` and `title` across too.

**The item cache is the only synchronous source of item data.** `getAllRecordsFromCache()` returns flattened
records, not documents. A consumer needing a new field must add it to `itemToRecord` *and* rebuild the cache —
a persisted cache restores the old record shape.

**Artificer's CSS fights Blacksmith's.** `shared.css` and the per-window files carry `!important` rules and
fixed heights that beat the shared `blacksmith-*` classes at any specificity. When migrating a window, stand
those down with `:not(.blacksmith-…)` rather than deleting them — other windows still depend on them.

**Animations that move the icon must pre-zoom it.** The moment a gap opens between an image and its frame the
effect reads as a broken layout. See the overscan rule in `styles/process-animations.css`.

## Rules that came out of real bugs

**A default may supply a zero, never an attribution.** A parser filling a blank `source` with `'Artificer'`
writes wrong data into live worlds silently. Blanks stay blank. An authoring window stamping its own
provenance is a fact, not an invention — that one stays.

**The writer of a legacy field retires it; the reader keeps its fallback.** Asking the reader to go first
breaks its handling of documents the writer already created.

**Track presence separately from value.** Testing a parsed value cannot tell you whether the thing was there.
Blank and absent are different, and collapsing them means one silently takes the other's behaviour.

**A conversion inherits every defect of the reader that feeds it.** Fix the reader *before* converting —
otherwise the bug is written into the new schema permanently, where it stops being a parser bug and becomes
data.

**Don't validate against a vocabulary that is not fixed at declaration time.** Crafting skills come from a
user-configurable mapping and processes are items, so a `choices` list rejects legitimate content in any
world that differs from ours.

**Never invent a plausible value for something you cannot resolve.** A fallback is fine for *rendering* —
something must be drawn — but a fallback shown as a label lies. Resolve to null and say so.

## Before you crawl the code — read the architecture doc

`documentation/architecture-artificer.md` is the map. It exists so you do not have to reconstruct the design
by reading every file, and it is wrong more cheaply than the code is.

## Where things live

| | |
|---|---|
| `documentation/TODO.md` | What we will do. Deleted on completion. |
| `documentation/architecture-artificer.md` | How it is built and why. |
| `documentation/plans/` | Scaffolding for work in flight. Deleted when it lands. |
| `CHANGELOG.md` | What we did. |
| `macros/` | GM-run operations: seeding, migration, diagnostics. Dry-run by default where they write. |
| `resources/*.json` | GM-selectable rulesets — skills, gathering, process animations. |

Cross-module work spanning the suite belongs in Blacksmith's `documentation/TODO-GLOBAL.md`, not here.

## Packs

Compendiums are LevelDB under `packs/` and are **committed**. Editing pack content is an in-Foundry round
trip: import to the world keeping ids, edit, export back keeping ids. Because they are tracked, the
pre-edit state is recoverable with `git checkout -- packs/<name>` — commit before exporting so that point
exists.

**Close the world before committing packs, and before any BUILD commit.** LevelDB does not write through
on export. Foundry holds the pack open and compacts lazily, so freshly exported data sits in a `.log` the
process has not flushed — and `git status` reports `packs/` **clean** while it does. The data only
materialises as a new `.ldb` once Foundry compacts or the world closes.

This shipped a broken release once: 13.2.0 was tagged with the pre-conversion packs because the export
looked committed and was not. The new `.ldb` landed three commits later, so the release zip contained the
old compendiums while the dev working tree was correct — which is the confusing part, because everything
looks right locally.

Before a BUILD commit, verify rather than assume:

```
git show <ref>:packs/<name>/<file>.ldb | grep -ac "<some string you just added>"
```

A tag is what production installs. If a release goes out without the packs, fixing it means a **new
version**, not a new commit — moving a tag people may already have pulled is worse.

## Git

The author commits. Claude prepares reviewable changes and says what changed and why.
