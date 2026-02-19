// ================================================================== 
// ===== GENERAL UTILITIES ==========================================
// ================================================================== 

/**
 * Log debug/warn via Blacksmith API (only when debug enabled). Do not use console.warn.
 * @param {string} moduleName - Module name (e.g. MODULE.NAME)
 * @param {string} message - Log message
 * @param {string|null} [detail] - Optional detail
 */
export function postDebug(moduleName, message, detail = null) {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(moduleName, message, detail, true, false);
    }
}

/**
 * Log error via Blacksmith API.
 * @param {string} moduleName - Module name
 * @param {string} message - Log message
 * @param {string|null} [detail] - Optional detail
 * @param {boolean} [showNotification=false] - Show UI notification
 */
export function postError(moduleName, message, detail = null, showNotification = false) {
    if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
        BlacksmithUtils.postConsoleAndNotification(moduleName, message, detail, true, showNotification);
    }
}

/**
 * Get or create a journal entry
 * @param {string} name - Journal name
 * @param {Object} options - Options
 * @returns {Promise<JournalEntry>} Journal entry
 */
export async function getOrCreateJournal(name, options = {}) {
    // Check if journal exists
    let journal = game.journal?.find(j => j.name === name);
    
    if (!journal) {
        // Create new journal
        journal = await JournalEntry.create({
            name: name,
            ...options
        });
    }
    
    return journal;
}

/**
 * Copy text to clipboard with multiple fallback methods
 * @param {string} text - The text to copy
 * @param {Object} options - Options
 * @param {string} options.fallbackTitle - Title for manual-copy dialog (default: 'Copy to Clipboard')
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export async function copyToClipboard(text, options = {}) {
    const { fallbackTitle = 'Copy to Clipboard' } = options;

    if (!text || typeof text !== 'string') {
        ui.notifications?.warn('No text to copy.');
        return false;
    }

    // Method 1: Modern clipboard API
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            ui.notifications?.info('Copied to clipboard!');
            return true;
        } catch (error) {
            if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
                BlacksmithUtils.postConsoleAndNotification('Artificer', 'Clipboard API failed', error?.message ?? String(error), true, false);
            }
        }
    }

    // Method 2: Legacy execCommand approach
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, text.length);
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (ok) {
            ui.notifications?.info('Copied to clipboard!');
            return true;
        }
    } catch (error) {
        if (typeof BlacksmithUtils !== 'undefined' && BlacksmithUtils.postConsoleAndNotification) {
            BlacksmithUtils.postConsoleAndNotification('Artificer', 'execCommand copy failed', error?.message ?? String(error), true, false);
        }
    }

    // Method 3: Show dialog with text for manual copying
    const dialog = new Dialog({
        title: fallbackTitle,
        content: `
            <p>Clipboard access failed. Select and copy the text below:</p>
            <textarea readonly style="width:100%;height:300px;font-family:monospace;font-size:12px;margin-top:8px;" id="artificer-copy-fallback"></textarea>
        `,
        buttons: {
            copy: {
                icon: '<i class="fas fa-copy"></i>',
                label: 'Select All',
                callback: (html) => {
                    const ta = html.querySelector('#artificer-copy-fallback');
                    if (ta) {
                        ta.focus();
                        ta.select();
                        ta.setSelectionRange(0, ta.value.length);
                        ui.notifications?.info('Text selected — press Ctrl+C (Cmd+C) to copy.');
                    }
                }
            },
            close: {
                icon: '<i class="fas fa-times"></i>',
                label: 'Close'
            }
        },
        default: 'copy'
    }, { width: 560 });
    dialog.render(true).then(() => {
        const ta = dialog.element?.querySelector('#artificer-copy-fallback');
        if (ta) ta.value = text;
    });
    return false;
}

/**
 * Generate hash-based number from UUID (for recipe/blueprint numbering)
 * @param {string} uuid - UUID string
 * @param {string} prefix - Prefix (e.g., "R" for recipes, "B" for blueprints)
 * @returns {string} Numbered reference (e.g., "R1", "R2", "B1")
 */
export function hashString(uuid, prefix = '') {
    if (!uuid) return '';
    
    let hash = 0;
    for (let i = 0; i < uuid.length; i++) {
        hash = ((hash << 5) - hash) + uuid.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
    }
    const number = Math.abs(hash) % 1000 + 1; // Numbers 1-1000
    return prefix ? `${prefix}${number}` : number.toString();
}
