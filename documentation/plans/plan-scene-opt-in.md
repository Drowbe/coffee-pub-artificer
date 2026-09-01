# Plan: every scene gathers, and the default profile becomes real

**Audience:** us, while the work is in flight

Artificer currently asks a GM to opt each scene in. This removes that question. Installing the module is
already the opt-in; a per-scene `enabled` flag asks it a second time, and a fourth time counting the two
list fields that gate on being non-empty.

Work that can proceed while Blacksmith builds scene geography. It touches the same surface, so the two
have to be sequenced against each other -- see "Interaction with the geography migration".

## Why this is smaller than it sounds

Three things are true in the code today that the UI does not suggest.

**`enabled` does not gate gathering.** Nothing in Artificer fires on its own. `manager-pins.js:158-161`
renders discovery nodes that already exist in the scene flag, and those exist only because a GM ran a
gather. So `enabled` gates a scene-directory badge (`manager-scene.js:499`) and whether already-discovered
pins are drawn. It never prevented an action, because there is no unprompted action to prevent.

**The real gate was never `enabled`.** `_hasGatheringConfigured` (`manager-scene.js:474-486`) requires
`enabled && gatherSpots > 0 && habitats.length > 0 && componentTypes.length > 0`. Of those, `gatherSpots`
already defaults to 1, and `habitats` is the field moving to Blacksmith. What actually stops an
unconfigured scene from gathering is the two list fields being empty.

**Most of the default profile already exists.** `_getSceneGatherSettings` (`manager-gather.js:603-631`)
already falls back for harvesting skills, discovery DC and harvest DC, and `resolveGatherDefaults`
(`skills-rules.js:79`) derives those from the GM-selected ruleset JSON. The defaults are real, tested and
in use. They are simply spread across two files and an inline `?? 5`, and are not thought of as a profile.

So the feature is mostly consolidation plus closing one gap.

## The gap

`componentTypes` has a default in the form and not in the gather path.

`manager-scene.js:193-195` displays all component families when the flag is empty, so an unconfigured
scene *looks* like every family is selected. `_getSceneGatherSettings:611` reads the same flag with no
fallback, so the gather path sees an empty list and yields nothing. The form says "all", the engine says
"none", and nothing reports the disagreement.

That inconsistency is the whole of what "generic profile" has to fix for component types. The fallback the
form already applies is the right default; it belongs in one place both callers read.

`profile` itself is a dead field. `manager-scene.js:277` writes a free-text box with a "Default"
placeholder and **nothing reads it** -- zero callers in the module. It is not a profile system that needs
extending; it is a text input that goes nowhere. Either give the name meaning or delete it, but do not
leave a control that implies a feature.

## What changes

**One resolver owns the defaults.** A single function returns the effective gather settings for a scene:
stored value where the GM set one, default where they did not. Both the form and the gather path read it,
so what a GM sees configured is what runs. The existing fallbacks move into it rather than being
rewritten -- they are correct, they are just in the wrong place.

**`enabled` is deleted, not defaulted true.** A flag that is always true is a field everyone has to keep
reading. Remove the checkbox, remove the reads at `manager-scene.js:188`, `:482` and
`manager-pins.js:158`.

**`_hasGatheringConfigured` changes meaning.** It stops answering "may this scene gather" -- every scene
may -- and becomes "has a GM tuned this scene", which is what the scene-directory badge should have shown
all along. A GM wants to see at a glance which scenes they have touched, not which ones are switched on.

**The environment requirement survives, and is the only real precondition.** A scene with no environment
cannot gather, because there is nothing to decide what grows there. After the migration that is Blacksmith's
answer, not a flag of ours, and it is a question the GM answers for the suite rather than for Artificer.

## What existing worlds see

**Scenes with `enabled: false` will show their discovery pins again.** Today the flag suppresses rendering
of nodes that were legitimately discovered, which is strange behaviour on its own -- the discovery
happened, and hiding it does not undo it. Removing the flag restores them. This is a visible change on
upgrade and belongs in the CHANGELOG as a change rather than arriving as a silent side effect.

**Scenes with an environment but no component types will begin yielding components.** That is the fix, and
it is the point, but it means a world that looked inert becomes active. Worth saying plainly in the release
notes, because a GM who never configured a scene will notice the difference.

No migration is required. Deleting a flag that is only ever read as a boolean needs no data pass; stale
`enabled` keys can stay on the documents harmlessly, or be swept later.

## Interaction with the geography migration

`habitats` leaves and the other twelve keys stay. Two orderings matter:

- **The default resolver can be built now.** It concerns component types, skills and DCs -- none of which
  are moving. Building it first means the geography migration lands into a surface that already has
  coherent defaults.
- **Deleting `enabled` should follow the migration**, because `_hasGatheringConfigured` reads both flags
  and changing both at once makes a post-migration failure ambiguous. Blacksmith's own warning applies: if
  habitats do not carry across, gather silently stops. Keeping `enabled` until then leaves one variable
  changing at a time.

The window-versus-tab decision in `TODO.md` also lands here. Once every scene gathers, the surface is no
longer "enable and configure this scene" but "tune this scene's harvest", which is a better fit for a
window the GM opens deliberately than for a tab that must be scrolled past on every scene.

## How this gets verified

Nothing here reports failure on its own, which is the usual hazard in this module -- an empty component
list yields no components and looks exactly like a scene with nothing to find.

- A scene with an environment and no other configuration yields components of every family, and the
  families it yields match what the form displays as selected. This is the gap closing, and it is the check
  that would have caught it.
- A scene with component types explicitly set yields only those, unchanged from today.
- A scene that previously had `enabled: false` shows its existing discovery pins after upgrade.
- The scene-directory badge appears for tuned scenes and not for untouched ones.

The first two belong in a harness suite alongside `suite-biome-normalization.js`, since both are
assertions about what a resolver returns rather than about what a window looks like.

## Open questions

- Does `profile` become a real named-preset system, or is the field deleted? Nothing reads it today, so
  either is honest and leaving it as-is is not.
- Should the default component families be all of them, or a narrower set? The form's current display
  implies all, which is the least surprising answer, but it is a design choice rather than a derivation.
- `_getSceneGatherSettings:622` reads `flags.defaultDC`, which no form field writes -- the form writes
  `discoveryBaseDC`. Confirm whether `defaultDC` is a legacy key with live data behind it before the
  resolver decides whether to keep accepting it.
