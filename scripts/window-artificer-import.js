// ==================================================================
// ===== IMPORT ITEMS WINDOW (ApplicationV2) ========================
// ==================================================================

import { MODULE } from './const.js';
import { importFromText, showImportResult } from './utility-artificer-import.js';
import { copyToClipboard, postError } from './utils/helpers.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const PROMPT_URL = 'modules/coffee-pub-artificer/prompts/artificer-ingredient.txt';

/**
 * Import Items Modal - Browse file, paste JSON, or copy prompt template
 */
export class ArtificerImportWindow extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(foundry.utils.mergeObject({}, super.DEFAULT_OPTIONS ?? {}), {
        id: 'artificer-import-window',
        classes: ['window-artificer-import', 'artificer-import-window'],
        position: { width: 560, height: 520 },
        window: { title: 'Import Items from JSON', resizable: true, minimizable: true },
        tag: 'form',
        form: {
            handler: ArtificerImportWindow.handleForm,
            submitOnChange: false,
            closeOnSubmit: false
        }
    });

    static PARTS = {
        body: {
            template: 'modules/coffee-pub-artificer/templates/import-items.hbs'
        }
    };

    constructor(options = {}) {
        const opts = foundry.utils.mergeObject({}, options);
        opts.id = opts.id ?? `${ArtificerImportWindow.DEFAULT_OPTIONS.id}-${foundry.utils.randomID().slice(0, 8)}`;
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

        const fileInput = root?.querySelector?.('#artificer-import-file-input');
        fileInput?.addEventListener('change', (e) => this._onFileSelected(e));
    }

    /**
     * ApplicationV2 form handler (bound to instance when invoked)
     */
    static async handleForm(event, form, formData) {
        event.preventDefault();
        if (!(this instanceof ArtificerImportWindow)) return;
        return this._handleImport(form, formData);
    }

    async _handleImport(form, formData) {
        const textarea = form?.querySelector?.('#artificer-import-json');
        const jsonText = (textarea?.value?.trim() ?? formData?.get?.('jsonContent') ?? '').trim();

        if (!jsonText) {
            ui.notifications?.warn('Please paste JSON or select a file.');
            return;
        }

        try {
            const result = await importFromText(jsonText, {
                createInWorld: true,
                actor: null
            });
            showImportResult(result, MODULE.NAME);
            if (result.errorCount === 0 && result.successCount > 0) {
                this.close();
            }
        } catch (error) {
            const msg = error.message || String(error);
            ui.notifications?.error(`Import failed: ${msg}`);
            postError(MODULE.NAME, 'Import error', error?.message ?? String(error));
        }
    }

    async _copyPromptToClipboard() {
        try {
            const response = await fetch(PROMPT_URL);
            if (!response.ok) throw new Error(`Failed to load prompt: ${response.status}`);
            const text = await response.text();
            await copyToClipboard(text, { fallbackTitle: 'Artificer Ingredient Prompt' });
        } catch (error) {
            ui.notifications?.error(`Could not load prompt: ${error.message}`);
            postError(MODULE.NAME, 'Copy prompt error', error?.message ?? String(error));
        }
    }

    _triggerFileSelect() {
        const fileInput = this.element?.querySelector('#artificer-import-file-input');
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
            const textarea = this.element?.querySelector('#artificer-import-json');
            if (textarea) {
                textarea.value = text;
                ui.notifications?.info(`Loaded ${file.name}`);
            }
        } catch (error) {
            ui.notifications?.error(`Could not read file: ${error.message}`);
        }
    }
}
