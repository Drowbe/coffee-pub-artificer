# Performance & Memory Review

This document summarizes potential memory leak and performance risks found during a codebase scan of `coffee-pub-artificer`, focusing on:

- Timer/interval cleanup (timeouts, intervals)
- Document-level event listeners / delegation patterns
- Long-lived Maps/Sets that must be cleared
- Blacksmith API integration correctness, especially HookManager and Sockets (per `documentation/blacksmith-apis.md`)

## High-priority memory leak risks

### 1) `CraftingWindow` timers may continue after window close

File: `scripts/window-crafting.js`

Findings:

- The window uses `_searchDebounceTimer` (via `setTimeout`) and `_craftCountdownInterval` (via `setInterval`).
- `_preClose()` deletes the window reference from `_craftingWindowRefs` and saves bounds, but it does not clear either timer.
- If the user closes the window during the 150ms debounce or during an active countdown, the callbacks may still fire and call `this.render()` / continue countdown logic after the window is no longer visible. This keeps the window instance reachable longer than necessary and can cause repeated renders.

Recommendation:

- In `CraftingWindow._preClose()`, clear and nullify:
  - `this._searchDebounceTimer`
  - `this._craftCountdownInterval`
  - also reset `_craftingCountdownRemaining` / `_craftPending` if you want to hard-stop the flow.
- As a belt-and-suspenders measure, inside timer callbacks guard with a “still open” check (e.g., `if (this.element == null) return;`) before calling `render()`.

### 2) `GatherWindow` / `SkillsWindow` keep stale window references via global delegation

Files:

- `scripts/window-gather.js`
- `scripts/window-skills.js`

Findings:

- Both windows attach document-level click delegation once (`document.addEventListener('click', ...)`) and rely on module-level “current window” variables:
  - `window-gather.js`: `_currentGatherWindowRef`
  - `window-skills.js`: `_currentSkillsWindowRef`
- Those variables are set in render lifecycle methods (e.g., `_attachDelegationOnce()` / `_onFirstRender()`), but `_preClose()` does not clear them.
- Because the document handler reads those variables, the last opened window instance can remain strongly referenced even after the window closes, preventing garbage collection of DOM/state attached to the window.

Recommendation:

- Set `_currentGatherWindowRef = null` in `GatherWindow._preClose()`.
- Set `_currentSkillsWindowRef = null` in `SkillsWindow._preClose()`.
- If you want to be extra safe, also ensure any per-window listeners (if added elsewhere) are removed in `_preClose()`.

## Medium-priority runtime overhead / “leak-like” behavior

### 3) Crafting click delegation scans all known windows on every click

File: `scripts/window-crafting.js`

Findings:

- A global document click handler runs for every click and attempts to find the correct window by scanning `_craftingWindowRefs.values()` (reverse order) and checking `root.contains(e.target)`.
- `_craftingWindowRefs` is cleaned up via `_preClose()` (good), but this still creates overhead on every click proportional to the number of open crafting windows.

Recommendation:

- If you ever expect multiple crafting windows to be open concurrently, consider tracking a single “current crafting window” reference (similar to the gather/skills approach) and use it instead of scanning the whole map.
- Keep the map-based guard if needed for correctness, but short-circuit earlier (e.g., check the last-used window first).

## Blacksmith API usage: potential misuse/incomplete use

### 4) `manager-gather.js` registers a raw `Hooks.on` instead of using Blacksmith HookManager

File: `scripts/manager-gather.js`

Findings:

- `initializeGatherSockets()` currently just ensures a global listener is registered via:
  - `Hooks.on('blacksmith.requestRollComplete', ...)`
- The project does use Blacksmith HookManager in other managers (`manager-scene.js`, `manager-pins.js`) via `BlacksmithAPI.getHookManager()` and `registerHook(...)`.
- The helper doc `documentation/blacksmith-apis.md` explicitly recommends using HookManager for registration/unregistration.

Recommendation:

- Update `manager-gather.js` to use `BlacksmithAPI.getHookManager()` and `hookManager.registerHook(...)` for `blacksmith.requestRollComplete` instead of calling `Hooks.on(...)` directly.
- This makes lifecycle/unregistration more consistent and reduces the risk of duplicate listeners if initialization occurs more than once (e.g., dev hot reload).

### 5) Sockets vs hooks: ensure the chosen mechanism matches the intent

Files:

- `scripts/manager-scene.js` uses `BlacksmithAPI.getSockets()` for `SCENE_SOCKET_EVENT`.
- `scripts/manager-gather.js` does not use Blacksmith Sockets for gather completion; it relies on `blacksmith.requestRollComplete` hook delivery.

This may be correct (the roll-complete event is already delivered via Blacksmith’s hook/event surface), but if you later need explicit cross-client synchronization beyond what `blacksmith.requestRollComplete` provides, prefer `api.sockets` per the helper doc instead of custom socket globals.

Recommendation:

- For any new cross-client sync additions in this module, use `api.sockets.register/emit` and let HookManager manage lifecycle hooks.

## Potential performance issues

### 6) `CraftingWindow.getData()` does heavy item processing on every render

File: `scripts/window-crafting.js`

Findings (high level):

- `getData()` recomputes multiple filtered lists derived from actor items (ingredients, apparatus, containers, tools, plus tag extraction and multiple async resolutions).
- The window re-renders on many interactions, including countdown interval ticks.

Recommendation:

- Cache derived lists for the duration of a “bench state” version (e.g., recompute only when actor items change, when filter inputs change, or when selected recipe/slots change).
- If the UI still needs to refresh each second during countdown, avoid recomputing expensive lists on each tick; isolate the countdown UI state so `render()` is as cheap as possible.

### 7) Repeated skill-rule aggregation and async calls during gather context building

File: `scripts/manager-gather.js`

Findings:

- `_getGatheringSkillContext()` iterates enabled skills and for each skill calls multiple async rule functions:
  - `getEffectiveGatheringRules()`
  - `getEffectiveComponentSkillAccess()`
  - `getAppliedGatheringPerksForDisplay()`
- Each of those iterates benefits from learned perks and aggregates rule keys; if this is called frequently (e.g., multiple rerenders of gather UI or repeated roll previews), it may add noticeable overhead.

Recommendation:

- Memoize results for the tuple `(actorId, enabledSkillIds, learnedPerkIdsForSkill)` for the lifetime of the gather window interaction.
- Consider doing the aggregation once per roll request rather than per render.

## Recommended next steps (quick wins)

1. Add timer cleanup to `CraftingWindow._preClose()` (clear debounce + countdown interval).
2. Clear `_currentGatherWindowRef` and `_currentSkillsWindowRef` in their respective `_preClose()` methods.
3. Switch `manager-gather.js`’s raw `Hooks.on('blacksmith.requestRollComplete', ...)` to Blacksmith HookManager registration.
4. Reduce per-tick `CraftingWindow.render()` work during countdown by isolating the countdown state.

## Quick wins status

Status: Completed

- [x] `scripts/window-crafting.js`
  - Added timer cleanup in `CraftingWindow._preClose()`:
    - clears `_searchDebounceTimer`
    - clears `_craftCountdownInterval`
    - resets `_craftingCountdownRemaining` and `_craftPending`
  - Added a guard in the search debounce callback to skip render if the window has closed.
  - Reduced countdown overhead by updating only timer/container DOM each second instead of full `render()` on each tick.

- [x] `scripts/window-gather.js`
  - `GatherWindow._preClose()` now clears `_currentGatherWindowRef` when closing the active instance.

- [x] `scripts/window-skills.js`
  - `SkillsWindow._preClose()` now clears `_currentSkillsWindowRef` when closing the active instance.

- [x] `scripts/manager-gather.js`
  - Replaced raw `Hooks.on('blacksmith.requestRollComplete', ...)` registration with Blacksmith HookManager:
    - `BlacksmithAPI.getHookManager()`
    - `hookManager.registerHook({ name: 'blacksmith.requestRollComplete', ... })`
  - `initializeGatherSockets()` now awaits async hook registration.

- [x] `scripts/manager-gather.js` — gathering skill context memoization
  - `_getGatheringSkillContext()` caches its result for `(actor.uuid, enabled skills, learned perk IDs)` so back-to-back calls (e.g. situational bonus + roll processing) avoid repeated rule aggregation.

- [x] `scripts/window-crafting.js` — crafting `getData()` inventory path
  - Ingredient / apparatus / container / kit list rows are recomputed only when the actor inventory fingerprint changes (id + per-item id/quantity), not on every filter/search re-render.
  - Document-level click/change/input delegation tries the last-used crafting window first, then falls back to scanning open windows (same behavior, less work when one window is “active”).
  - Per-render “Cover list state” console logging is gated behind `CONFIG.debug.coffeePubArtificer.recipeJournalCovers` (default off).

