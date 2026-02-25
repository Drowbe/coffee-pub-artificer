/**
 * Artificer: Clean and Adjust Recipe Journal Pages
 *
 * Updates recipe journal pages in the configured recipe journal folder to the current schema:
 * - Tool → Skill Kit (field rename)
 * - Workstation removed
 * - Skill Level normalized to 0–20 (old 0–100 values scaled)
 * - Skill must be one of the 13 supported skills (invalid default to Alchemy)
 * - Description and other fields kept; HTML format updated to match import
 *
 * 1. Back up your world before running.
 * 2. Ensure the Artificer module has a Recipe Journal Folder set in module settings.
 * 3. Create a new Macro (Script), name e.g. "Artificer: Clean Recipes".
 * 4. Paste this script and run as GM.
 *
 * Set dryRun: true in the macro to preview how many pages would be updated (no writes).
 */

const MODULE_ID = 'coffee-pub-artificer';

/** Wait for Artificer API to be attached (ready hook can lag). Returns api or null. */
async function getArtificerAPI(maxWaitMs = 5000) {
    const step = 200;
    let elapsed = 0;
    while (elapsed < maxWaitMs) {
        const m = game.modules.get(MODULE_ID);
        if (m?.active && m?.api?.recipes?.cleanRecipeJournalPages) return m.api;
        await new Promise(r => setTimeout(r, step));
        elapsed += step;
    }
    return game.modules.get(MODULE_ID)?.api ?? null;
}

(async () => {
    const dryRun = false; // Set to true to only report, no writes

    if (!game.user?.isGM) {
        ui.notifications.warn('Only a GM can run the Clean Recipes macro.');
        return;
    }

    const mod = game.modules.get(MODULE_ID);
    if (!mod?.active) {
        ui.notifications.error('Artificer is not enabled. Enable the module and try again.');
        return;
    }

    const api = await getArtificerAPI();
    if (!api?.recipes?.cleanRecipeJournalPages) {
        ui.notifications.error(
            'Artificer API not ready. Reload the world and run the macro again. If it still fails, check the console (F12) for module errors.'
        );
        return;
    }

    const label = dryRun ? 'Dry run (no changes)' : 'Clean and update';
    ui.notifications.info(`Artificer: ${label} recipe pages…`);

    const result = await api.recipes.cleanRecipeJournalPages({ dryRun });

    const msg = dryRun
        ? `Would update ${result.updated} recipe page(s), ${result.skipped} skipped, ${result.errors.length} error(s).`
        : `Updated ${result.updated} recipe page(s), ${result.skipped} skipped, ${result.errors.length} error(s).`;
    ui.notifications.info(msg);

    if (result.errors.length > 0) {
        console.warn(`${MODULE_ID} Clean Recipes errors:`, result.errors);
        result.errors.forEach(({ name, error }) => {
            console.warn(`  - ${name}: ${error}`);
        });
    }
})();
