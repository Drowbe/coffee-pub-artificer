# ApplicationV2 Form Best Practices (Foundry VTT v13)

These notes capture the working pattern we used to get the Artificer item form stable in v13. Reuse this template for other modules to avoid refresh loops and dead buttons.

## Core pattern
- Set `tag: 'form'` in `DEFAULT_OPTIONS` so ApplicationV2 renders the root as the form.
- Provide a `form` config with a static handler:
  - `handler: MyApp.handleForm`
  - `submitOnChange: false` (unless you need live updates)
  - `closeOnSubmit: false` (set true only if you want the window to auto-close)
- In the template, do **not** add another `<form>`; the ApplicationV2 wrapper is the only form element. Use a container `<div>` for layout.
- Use a normal submit button (`<button type="submit">`) for primary action.
- Mark secondary buttons (Cancel, etc.) as `type="button"` to avoid accidental submit.
- In the handler, use the provided `FormDataExtended` and avoid re-querying the DOM unless necessary.

## Minimal skeleton
```js
export class MyApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    id: 'my-app',
    title: 'My App',
    tag: 'form',
    form: {
      handler: MyApp.handleForm,
      submitOnChange: false,
      closeOnSubmit: false
    }
  });

  static PARTS = {
    body: { template: 'modules/my-module/templates/my-form.hbs' }
  };

  activateListeners(html) {
    super.activateListeners(html);
    const form = html.tagName === 'FORM' ? html : html.querySelector('form');
    const cancel = form?.querySelector('[data-action="cancel"]');
    cancel?.addEventListener('click', (event) => {
      event.preventDefault();
      this.close();
    });
  }

  static async handleForm(event, form, formData) {
    event.preventDefault();
    if (!(this instanceof MyApp)) return;
    return this._handleSubmit(formData);
  }

  async _handleSubmit(formData) {
    const values = Object.fromEntries(formData.entries());
    // ...validate and act...
  }
}
```

## Template checklist
- No wrapping `<form>`; only a `<div>` root with your content.
- Primary button: `<button type="submit">Save</button>`
- Cancel button: `<button type="button" data-action="cancel">Cancel</button>`
- If you need selects/inputs, ensure their `name` attributes match what you expect in `FormData`.

## Common pitfalls
- Nested forms (wrapper tag + inner `<form>`) cause native submission and page refresh.
- Missing `handler` in `DEFAULT_OPTIONS.form` means your submit code never runs.
- Cancel buttons without `type="button"` can trigger submit unintentionally.
- Relying on Shadow DOM: ApplicationV2 renders a light DOM form by default.

## Debug tips
- Add a temporary `console.log('submit', formData);` in `handleForm` to confirm it fires.
- If the page refreshes, check for an inner `<form>` or a missing `event.preventDefault()` in the handler.
- Use `ui.notifications.error(...)` in `catch` blocks to surface validation errors instead of silent failures.
