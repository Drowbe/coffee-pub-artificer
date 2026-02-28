# Example Application V2 Window (Framework Only)

Minimal window skeleton based on the Artificer Skills window: **header** + **body** (main + details panel) + **action bar**. No domain content—replace placeholders with your own.

## Files

- **example-window.hbs** — Handlebars template (single root, header, body, buttons).
- **example-window.js** — Application V2 class with delegation, scroll save/restore, and static actions.

## How to use

1. Copy both files into your module, e.g.:
   - `templates/your-window.hbs`
   - `scripts/your-window.js`
2. In the JS file:
   - Set `PARTS.body.template` to your template path (e.g. `modules/your-module-id/templates/your-window.hbs`).
   - Replace `ExampleModuleWindow` / `EXAMPLE_APP_ID` / `_exampleWindowRef` / `_exampleDelegationAttached` with your own names.
   - Implement `getData()` and your actions.
3. Add CSS for `.example-window-root`, `.example-window-header`, `.example-window-body`, `.example-window-buttons` (or rename classes). See `guidance-applicationv2.md` §6.3 or `../styles/window-skills.css` in this repo for layout patterns.
4. Open the window from your API or a button, e.g. `new YourWindow().render(true)`.

## Reference

Full guidance: **documentation/guidance-applicationv2.md**.
