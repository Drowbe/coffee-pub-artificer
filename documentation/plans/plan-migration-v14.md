# Foundry v14 migration notes (Coffee Pub Artificer)

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

**Implemented in this module:** `getChatCardPresentationFields()` in `scripts/utils/helpers.js` — spreads into `ChatMessage.create` so v14 uses `{ style }` and v13 uses `{ type }` with the same numeric value (`CHAT_MESSAGE_STYLES.OTHER` or legacy `CHAT_MESSAGE_TYPES.OTHER`). Used by `scripts/manager-gather.js` and `scripts/window-crafting.js`.

**Reference:** [foundryvtt#13436 — Constants / `CHAT_MESSAGE_TYPES`](https://github.com/foundryvtt/foundryvtt/issues/13436).