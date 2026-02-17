// ==================================================================
// ===== IMPORT RECIPES WINDOW (ApplicationV2) ======================
// ==================================================================

import { MODULE } from './const.js';
import { importRecipesFromText, showRecipeImportResult } from './utility-artificer-recipe-import.js';
import { copyToClipboard } from './utils/helpers.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const PROMPT_URL = 'modules/coffee-pub-artificer/prompts/artificer-recipe.txt';

/**
 * Import Recipes Modal - Paste JSON or load file
 */
export class ArtificerRecipeImportWindow extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(foundry.utils.mergeObject({}, super.DEFAULT_OPTIONS ?? {}), {
        id: 'artificer-recipe-import-window',
        classes: ['window-artificer-recipe-import', 'artificer-import-window'],
        position: { width: 560, height: 520 },
        window: { title: 'Import Recipes from JSON', resizable: true, minimizable: true },
        tag: 'form',
        form: {
            handler: ArtificerRecipeImportWindow.handleForm,
            submitOnChange: false,
            closeOnSubmit: false
        }
    });

    static PARTS = {
        body: {
            template: 'modules/coffee-pub-artificer/templates/import-recipes.hbs'
        }
    };

    constructor(options = {}) {
        const opts = foundry.utils.mergeObject({}, options);
        opts.id = opts.id ?? `${ArtificerRecipeImportWindow.DEFAULT_OPTIONS.id}-${foundry.utils.randomID().slice(0, 8)}`;
        super(opts);
    }

    activateListeners(html) {
        super.activateListeners(html);
        if (html?.jquery ?? typeof html?.find === 'function') {
            html = html[0] ?? html.get?.(0) ?? html;
        }
        const root = html?.matches?.('.artificer-window') ? html : html?.querySelector?.('.artificer-window') ?? (html?.tagName === 'FORM' ? html : html?.querySelector?.('form') ?? html);

        root?.querySelector?.('[data-action="cancel"]')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.close();
        });

        root?.querySelector?.('[data-action="copy-prompt"]')?.addEventListener('click', (e) => {
            e.preventDefault();
            this._copyPromptToClipboard();
        });

        root?.querySelector?.('[data-action="select-file"]')?.addEventListener('click', (e) => {
            e.preventDefault();
            this._triggerFileSelect();
        });

        const fileInput = root?.querySelector?.('#artificer-recipe-import-file-input');
        fileInput?.addEventListener('change', (e) => this._onFileSelected(e));
    }

    static async handleForm(event, form, formData) {
        event.preventDefault();
        if (!(this instanceof ArtificerRecipeImportWindow)) return;
        return this._handleImport(form, formData);
    }

    async _handleImport(form, formData) {
        const textarea = form?.querySelector?.('#artificer-recipe-import-json');
        const jsonText = (textarea?.value?.trim() ?? formData?.get?.('jsonContent') ?? '').trim();

        if (!jsonText) {
            ui.notifications?.warn('Please paste JSON or select a file.');
            return;
        }

        try {
            const result = await importRecipesFromText(jsonText);
            showRecipeImportResult(result, MODULE.NAME);
            if (result.errorCount === 0 && result.successCount > 0) {
                this.close();
            }
        } catch (error) {
            const msg = error.message || String(error);
            ui.notifications?.error(`Import failed: ${msg}`);
            console.error(`[${MODULE.NAME}] Recipe import error:`, error);
        }
    }

    async _copyPromptToClipboard() {
        try {
            const response = await fetch(PROMPT_URL);
            if (!response.ok) throw new Error(`Failed to load prompt: ${response.status}`);
            const text = await response.text();
            await copyToClipboard(text, { fallbackTitle: 'Artificer Recipe Prompt' });
        } catch (error) {
            ui.notifications?.error(`Could not load prompt: ${error.message}`);
            console.error(`[${MODULE.NAME}] Copy prompt error:`, error);
        }
    }

    _triggerFileSelect() {
        const fileInput = this.element?.querySelector('#artificer-recipe-import-file-input');
        if (fileInput) {
            fileInput.value = '';
            fileInput.click();
        }
    }

    async _onFileSelected(event) {
        const file = event.target?.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const textarea = this.element?.querySelector('#artificer-recipe-import-json');
            if (textarea) {
                textarea.value = text;
                ui.notifications?.info(`Loaded ${file.name}`);
            }
        } catch (error) {
            ui.notifications?.error(`Could not read file: ${error.message}`);
        }
    }
}
