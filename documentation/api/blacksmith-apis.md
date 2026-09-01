Here are the important Blacksmith APIs other Coffee Pub modules should consider using if appropriate:

Blacksmith Wiki: https://github.com/Drowbe/coffee-pub-blacksmith/wiki (entry point)

API Core: https://github.com/Drowbe/coffee-pub-blacksmith/wiki/api-core (utilities + console/notification helpers)

API Toolbar: https://github.com/Drowbe/coffee-pub-blacksmith/wiki/api-toolbar (register toolbar tools/UI)
    
API Menubar: https://github.com/Drowbe/coffee-pub-blacksmith/wiki/api-menubar (register menubar tools/layout)

API Canvas: https://github.com/Drowbe/coffee-pub-blacksmith/wiki/api-canvas (canvas layer helpers)

API Hook Manager: https://github.com/Drowbe/coffee-pub-blacksmith/wiki/api-hookmanager (register/unregister hooks)

API Sockets: https://github.com/Drowbe/coffee-pub-blacksmith/wiki/api-sockets (emit/register for cross-client sync)

API Stats: https://github.com/Drowbe/coffee-pub-blacksmith/wiki/api-stats (combat/player statistics)

API Pins: https://github.com/Drowbe/coffee-pub-blacksmith/wiki/api-pins (canvas pins system)

API Chat Cards: https://github.com/Drowbe/coffee-pub-blacksmith/wiki/api-chatcards (chat card themes/helpers)

API Window: https://github.com/Drowbe/coffee-pub-blacksmith/wiki/api-window (Window API V2 registry)

API Request Roll: https://github.com/Drowbe/coffee-pub-blacksmith/wiki/api-requestroll (open roll dialog)

API Campaign: https://github.com/Drowbe/coffee-pub-blacksmith/wiki/api-campaign (normalized campaign context)

API OpenAI: no wiki page. The page was deleted with no replacement (confirmed 2026-08-31); the surface is provided by `coffee-pub-regent` when installed and Blacksmith core does not ship one.

API Supplement: no wiki page. Deleted with no replacement (confirmed 2026-08-31).   

## Quick How-To (for other Coffee Pub modules)

1. Get the API safely:
   `const api = game.modules.get('coffee-pub-blacksmith')?.api; if (!api) return;`

2. `postConsoleAndNotification` (debug + console + optional UI toast):
   use `api.utils.postConsoleAndNotification(moduleId, message, data?, blnDebug, blnNotification)`
   - `blnDebug=true` logs only when Blacksmith debug is enabled (keeps noise down for normal users).
   - `blnNotification=true` shows a user-facing notification (use for actionable errors/warnings).

3. Windows: always use the Window API registry for Application V2 windows (register/open via `api.registerWindow` / `api.openWindow`), rather than ad-hoc window wiring.

4. Sockets: use `api.sockets` for sync instead of custom socket globals:
   `api.sockets?.register(eventName, handler)` and `api.sockets?.emit(eventName, data)` (optionally `executeAsGM` for GM-only actions).

5. Prefer API surfaces over direct imports:
   use `api.registerToolbarTool`, `api.registerSecondaryBarItem` / `api.registerMenubarTool`, and existing APIs (roll/dialog, pins, chat cards).

6. Shared roll flow + context reuse:
   `api.openRequestRollDialog({ silent, initialType, initialValue, dc, actors, onRollComplete })` and read normalized prompt input from `api.campaign` (read-only contract).










