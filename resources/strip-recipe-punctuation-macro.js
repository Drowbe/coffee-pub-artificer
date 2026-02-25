/**
 * Artificer: Strip Typographic Punctuation from Recipe Pages
 *
 * Rewrites recipe journal pages in the configured recipe journal folder so that any
 * curly/smart apostrophes (') and smart quotes (") in the stored HTML are replaced
 * with straight ASCII apostrophe (') and double quote ("). This fixes parsing and
 * matching when content was pasted or generated with typographic punctuation.
 *
 * Uses the same rewrite as "Clean Recipes" (parse → normalize → rebuild HTML → save).
 * Only world journals in the configured Recipe Journal Name and Recipe Journal Folder
 * (including subfolders) are processed.
 *
 * 1. Back up your world before running.
 * 2. Set Artificer Recipe Journal Name and Recipe Journal Folder in module settings.
 * 3. Create a new Macro (Script), name e.g. "Artificer: Strip Recipe Punctuation".
 * 4. Paste this script and run as GM.
 *
 * Set dryRun: true to preview how many pages would be updated (no writes).
 */

const MODULE_ID = "coffee-pub-artificer";

async function getArtificerAPI(maxWaitMs = 5000) {
    const step = 200;
    let elapsed = 0;
    while (elapsed < maxWaitMs) {
        const m = game.modules.get(MODULE_ID);
        if (m?.active && m?.api?.recipes?.cleanRecipeJournalPages) return m.api;
        await new Promise((r) => setTimeout(r, step));
        elapsed += step;
    }
    return game.modules.get(MODULE_ID)?.api ?? null;
}

(async () => {
    const dryRun = false; // Set to true to only report, no writes

    if (!game.user?.isGM) {
        ui.notifications.warn("Only a GM can run this macro.");
        return;
    }

    const mod = game.modules.get(MODULE_ID);
    if (!mod?.active) {
        ui.notifications.error("Artificer is not enabled. Enable the module and try again.");
        return;
    }

    const api = await getArtificerAPI();
    if (!api?.recipes?.cleanRecipeJournalPages) {
        ui.notifications.error(
            "Artificer API not ready. Reload the world and run the macro again. If it still fails, check the console (F12) for module errors."
        );
        return;
    }

    const label = dryRun ? "Dry run (no changes)" : "Strip typographic punctuation";
    ui.notifications.info(`Artificer: ${label} from recipe pages…`);

    const result = await api.recipes.cleanRecipeJournalPages({ dryRun });

    const msg = dryRun
        ? `Would update ${result.updated} recipe page(s), ${result.skipped} skipped, ${result.errors.length} error(s).`
        : `Updated ${result.updated} recipe page(s), ${result.skipped} skipped, ${result.errors.length} error(s).`;
    ui.notifications.info(msg);

    if (result.errors.length > 0) {
        console.warn(`${MODULE_ID} Strip Recipe Punctuation errors:`, result.errors);
        result.errors.forEach(({ name, error }) => {
            console.warn(`  - ${name}: ${error}`);
        });
    }
})();
