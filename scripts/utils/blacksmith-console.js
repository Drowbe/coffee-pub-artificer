// ==================================================================
// Safe Blacksmith logging (module.api.utils first; avoids null window globals during ready/init)
// ==================================================================

const BLACKSMITH_MODULE_ID = 'coffee-pub-blacksmith';

/**
 * @returns {object|null}
 */
export function getBlacksmithApi() {
    return game?.modules?.get(BLACKSMITH_MODULE_ID)?.api ?? null;
}

/**
 * Is Blacksmith's global debug mode on?
 *
 * `postConsoleAndNotification(..., blnDebug: true, ...)` already suppresses debug
 * lines when this is off, so callers only need this to skip BUILDING a diagnostic
 * that costs something to produce.
 * @returns {boolean}
 */
export function isBlacksmithDebugOn() {
    try {
        return !!game?.settings?.get(BLACKSMITH_MODULE_ID, 'globalDebugMode');
    } catch {
        // Setting not registered yet (early init) or Blacksmith absent.
        return false;
    }
}

/**
 * @param {string} moduleShortName
 * @param {string} message
 * @param {unknown} [result]
 * @param {boolean} debug
 * @param {boolean} notification
 */
export function postBlacksmithConsole(moduleShortName, message, result, debug, notification) {
    const utils = getBlacksmithApi()?.utils;
    if (utils?.postConsoleAndNotification) {
        utils.postConsoleAndNotification(moduleShortName, message, result, debug, notification);
        return;
    }
    globalThis.BlacksmithUtils?.postConsoleAndNotification?.(moduleShortName, message, result, debug, notification);
}
