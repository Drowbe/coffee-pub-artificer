# Foundry v14 migration notes (Coffee Pub Artificer)

**Audience:** us, while the work is in flight

## Important resources

- [Foundry API (current)](https://foundryvtt.com/api/) — **reference index**, not a migration narrative. Use it to look up types, classes, and constants (e.g. `ChatMessageData`, `CONST`) once you know what broke.
- [Release 14.359 (V14 Stable announcement)](https://foundryvtt.com/releases/14.359) — **product + user-facing highlights** (Scene Levels, regions vs templates, Active Effects V2, UI/canvas notes) and **links to every v14 development build** (14.349–14.358) where incremental API/user-facing changes are described. The stable page’s own “API Improvements” section is a small slice; most API detail is in those linked releases and in #13436 below.
- [API Migration Guides (index)](https://foundryvtt.com/article/migration/) — hub of official migration articles (mostly older generations); still useful for context and deep dives linked from there.
- [V14 breaking changes (GitHub #13436)](https://github.com/foundryvtt/foundryvtt/issues/13436) — **primary checklist** for removals that were deprecated in v12 and **removed in v14** (constants, canvas, audio, globals, `ApplicationV2` tweaks, etc.). Cross-reference with the v14 release chain when you need rationale or timing.

### How to use these for module work

1. Run on v14 with backups; use `CONFIG.debug.compatibility` if you need louder deprecation/failure behavior.
2. When something throws or warns, look up the symbol in the **API** docs, then check whether it appears as **removed** in **#13436**.
3. Read **14.359** for “what’s new” and follow its links to **14.349–14.358** for build-by-build notes while debugging a subsystem (canvas, documents, apps).
4. Record repeatable fixes in this file (like the chat message section below) so all Coffee Pub modules stay aligned.

---

## Chat messages: `CHAT_MESSAGE_TYPES` removed; use `style` + `CHAT_MESSAGE_STYLES`

**Symptom:** `TypeError: Cannot read properties of undefined (reading 'OTHER')` when calling `ChatMessage.create` (e.g. gather flow → `sendGatherNoPoolCard` in `scripts/manager-gather.js`).

**Cause:** In v14, `CONST.CHAT_MESSAGE_TYPES` is **removed**. Code that does `type: CONST.CHAT_MESSAGE_TYPES.OTHER` throws because `CHAT_MESSAGE_TYPES` is `undefined`.

**Fix direction:**

- Use **`CONST.CHAT_MESSAGE_STYLES`** for presentation. **`OTHER`** (and `OOC`, `IC`, `EMOTE`) still exist there; see [CONST.CHAT_MESSAGE_STYLES](https://foundryvtt.com/api/variables/CONST.CHAT_MESSAGE_STYLES.html).
- Per v14 [`ChatMessageData`](https://foundryvtt.com/api/interfaces/foundry.documents.types.ChatMessageData.html), the field for that enum is **`style`**, not the old overloaded **`type`** usage. Document **`type`** is now a **string** subtype from `BaseChatMessage.metadata.types`, separate from chat “style”.
- **`CONST.CHAT_MESSAGE_STYLES.ROLL`** and **`.WHISPER`** were also removed; infer roll vs whisper from message data (`rolls`, `whisper`) instead.

**NO LONGER IMPLEMENTED HERE, AND NOT NEEDED.** This module once carried
`getChatCardPresentationFields()` in `scripts/utils/helpers.js` to emit `{style}` on v14 and `{type}` on
v13 (commit `783c14f`). Commit `1cc2d4e` then moved Artificer's chat cards onto Blacksmith's Chat Cards
API and removed it. Artificer no longer calls `ChatMessage.create` anywhere, so the constant's removal
cannot reach it -- verified 2026-09-09: zero `CONST.` reads and zero `CHAT_MESSAGE` references in the
whole module.

Kept here because the note above is still correct about v14, and because the sequence is the point: the
fix was real, and then the feature moved and took the problem with it. A migration note describing a fix
that no longer exists will be believed by the next reader.

**Reference:** [foundryvtt#13436 — Constants / `CHAT_MESSAGE_TYPES`](https://github.com/foundryvtt/foundryvtt/issues/13436).

---

## What the 2026-09-09 sweep found

Verified against a live Foundry 14.367 client by the Blacksmith session, which holds it.

**`CONST.CHAT_MESSAGE_TYPES` is absent on 14.367** -- confirmed on the client, not inferred. Stated as
absence rather than removal: there is no v13 install on this machine, so "it used to be there" is history
we did not measure.
`CONST.CHAT_MESSAGE_STYLES` survives with `OTHER/OOC/IC/EMOTE`. Our dual-path fix was a real break rather
than deprecation debt, and Artificer was the only module in the suite that hit it. Note the shape: a
PROPERTY removed from a global that itself still resolves, so a scan for missing globals cannot see it.

**Deprecation debt, not breakage.** All of the following still resolve on 14.367:

| Site | What |
|---|---|
| `scripts/utils/helpers.js:76` | `new Dialog(...)` -- v16 horizon |
| `scripts/window-skills.js:544` | `new Dialog(...)` -- v16 horizon |

Nineteen such `Dialog` sites exist across the suite and none blocked a build. Migrating them to `DialogV2`
is worth doing on its own schedule, not inside this migration.

**Fixed here:** `storage-blueprints.js:73` used the bare global `TextEditor`. Now
`foundry.applications.ux.TextEditor.implementation`, matching `sheet-recipe-page.js:476`. The bare global
still resolves on 14.367, so this was consistency rather than repair.

**Confirmed clean:** `renderTemplate`, `FormApplication`, `extends Application`, `SearchFilter`,
`DragDrop`, `AudioHelper`, `ui.notifications.notify`, `setPosition`, `this._element`, `.data.data`.
`loadTemplates` and every one of thirty `mergeObject` calls are already namespaced.

### The sweep that lied, and how to run it correctly

The first version of this sweep reported CLEAN on three patterns that had live sites. It used
`grep -rlE "<pattern>" 2>/dev/null | wc -l`, and in ERE a bare `(` is an unterminated group: grep exits 2,
prints nothing, and the suppressed stderr made an invalid pattern indistinguishable from a real zero.

**Use `grep -F` for anything containing regex punctuation, and never send stderr to `/dev/null` in a
survey.** A sweep that cannot tell "no matches" from "the pattern was invalid" reports the same number for
both, and the reassuring reading is the default one.

### The risk static analysis cannot reach

A hook registered under a renamed class name registers successfully and never fires. This caught three
modules in the suite on migration day -- Squire's `renderActorSheet5e`, six dead journal registrations in
Blacksmith, Monarch's `renderDialog`. Nothing in the code looks wrong; the symptom is absence.

Artificer registers: `renderSceneConfig`, `renderApplicationV2`, `renderSceneDirectory`, `updateScene`,
`canvasReady` through Blacksmith's HookManager, and `preCreateJournalEntryPage`, `renderDocumentSheetV2`,
`renderItemSheet`, `init`, `ready` directly.

`renderItemSheet` is the likeliest to be dead -- it is the dnd5e-side name, and dnd5e renames are what
killed Squire's. `renderDocumentSheetV2` is the second candidate. Blacksmith 14.1.0 ships
`blacksmithSilentHooks()`, which lists registered hook names that have not fired; run it after exercising
every window and treat anything of ours in that list as a break rather than debt.

### Pre-existing, surfaced by the same sweep

Five files define `activateListeners(html)` and call `super.activateListeners(html)`:
`panel-crafting-experiment.js`, `window-artificer-recipe-import.js`, `window-crafting.js`,
`window-gather.js`, `window-skills.js`. ApplicationV2 never calls `activateListeners`, so these are dead
methods -- and `super.activateListeners` likely does not exist, so anything that did call one would throw.
Not a v14 issue. Tracked separately in `TODO.md`.
