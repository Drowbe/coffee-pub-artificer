// ==================================================================
// ===== SHARED TRAIT PICKER ========================================
// ==================================================================
// One implementation of "type a trait, see suggestions, pick or invent one",
// used by both the Artificer Item window and the recipe page sheet.
//
// WHY SHARED. The two had drifted into different controls for the same concept:
// the item form had this dropdown, the recipe sheet had a plain `+ Existing
// trait...` select. Two controls for one idea is how a third consumer -- the
// Process item, next -- ends up inventing a fourth.
//
// This owns the INPUT and the SUGGESTIONS only. Each consumer keeps its own
// pill rendering, because their state models genuinely differ: the item form
// holds traits in a hidden field until submit, while the recipe sheet stages a
// document update and re-renders. Forcing one pill implementation onto both
// would mean forcing one state model, which is a bigger lie than two renderers.
// ==================================================================

/**
 * Wire an input and its suggestion list.
 *
 * @param {object} config
 * @param {HTMLInputElement} config.input        The text field.
 * @param {HTMLElement} config.suggestionsEl     Container for the dropdown.
 * @param {HTMLElement} [config.clearButton]     Optional clear button.
 * @param {() => string[]} config.candidates     All known traits, evaluated per open.
 * @param {() => string[]} config.selected       Traits already chosen, filtered out.
 * @param {(trait: string) => void} config.onAdd Called with the trait to add.
 * @returns {void}
 */
export function bindTraitPicker({ input, suggestionsEl, clearButton, candidates, selected, onAdd }) {
    if (!input || !suggestionsEl) return;
    if (input.dataset.traitPickerBound) return;
    input.dataset.traitPickerBound = 'true';

    const render = () => {
        const filter = (input.value ?? '').toLowerCase().trim();
        const chosen = new Set(selected());
        const available = candidates()
            .filter(c => !chosen.has(c))
            .filter(c => !filter || c.toLowerCase().includes(filter));

        suggestionsEl.innerHTML = '';
        if (!available.length) {
            suggestionsEl.classList.remove('visible');
            return;
        }
        for (const trait of available) {
            const option = document.createElement('div');
            option.className = 'artificer-tag-suggestion';
            option.setAttribute('data-tag', trait);
            option.setAttribute('role', 'option');
            option.textContent = trait;
            suggestionsEl.appendChild(option);
        }
        suggestionsEl.classList.add('visible');
    };

    const commit = (trait) => {
        const value = (trait ?? '').trim();
        if (!value) return;
        input.value = '';
        onAdd(value);
        // Keep the list open and refreshed: adding traits is usually a run of two
        // or three, and closing after each one makes the second cost another click.
        // Deferred so the consumer's state update lands before we re-filter.
        setTimeout(render, 0);
    };

    input.addEventListener('focus', render);
    input.addEventListener('input', render);
    // `focus` does NOT re-fire when the input already has focus, which made the
    // list feel like it opened only sometimes -- click into an already-focused
    // box and nothing happened. `click` fires every time.
    input.addEventListener('click', render);
    // Deferred so a click on a suggestion lands before the list is hidden.
    input.addEventListener('blur', () => setTimeout(() => suggestionsEl.classList.remove('visible'), 150));

    input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        const typed = input.value.trim();
        if (!typed) return;
        // Prefer an existing trait with different casing, so "herb" and "Herb" do
        // not become two traits that never match each other. Otherwise take the
        // typed value verbatim -- inventing a NEW trait has to work, and the item
        // form used to silently drop anything not already in the list.
        const match = candidates().find(c => c.toLowerCase() === typed.toLowerCase());
        commit(match ?? typed);
    });

    // mousedown fires before blur; preventing it keeps the input focused so the
    // click that follows still has a live list to hit.
    suggestionsEl.addEventListener('mousedown', (event) => event.preventDefault());
    suggestionsEl.addEventListener('click', (event) => {
        event.preventDefault();
        const trait = event.target?.closest('[data-tag]')?.getAttribute('data-tag');
        if (trait) commit(trait);
    });

    clearButton?.addEventListener('click', () => {
        input.value = '';
        input.focus();
        render();
    });
}
