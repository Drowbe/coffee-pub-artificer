/**
 * Artificer: Apply Potion Brewing Data (GM Binder PDF)
 *
 * Crawls recipe journal pages in the configured recipe journal folder and updates them with:
 * - RARITY (from Potion Brewing and Ingredient Gathering for DnD 5e PDF: Alchemist's Supplies, Herbalism Kit, Poisoner's Kit)
 * - SKILLLEVEL (derived from RARITY: common→1, uncommon→6, rare→12, very rare→17, legendary→20)
 * - SUCCESSDC (derived from SKILLLEVEL: 0-3→4, 4-9→8, 10-14→12, 15-19→16, 20→18)
 * - Skill (Alchemy, Herbalism, Poisoncraft) when present in the PDF data
 *
 * Only pages whose recipe/result name matches the PDF data are updated. Others are counted as "not in data".
 *
 * 1. Back up your world before running.
 * 2. Ensure the Artificer module has a Recipe Journal and Recipe Journal Folder set in module settings.
 * 3. Create a new Macro (Script), name e.g. "Artificer: Apply Potion Brewing Data".
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
        if (m?.active && m?.api?.recipes?.applyPotionBrewingData) return m.api;
        await new Promise(r => setTimeout(r, step));
        elapsed += step;
    }
    return game.modules.get(MODULE_ID)?.api ?? null;
}

(async () => {
    const dryRun = false; // Set to true to only report, no writes

    if (!game.user?.isGM) {
        ui.notifications.warn('Only a GM can run the Apply Potion Brewing Data macro.');
        return;
    }

    const mod = game.modules.get(MODULE_ID);
    if (!mod?.active) {
        ui.notifications.error('Artificer is not enabled. Enable the module and try again.');
        return;
    }

    const api = await getArtificerAPI();
    if (!api?.recipes?.applyPotionBrewingData) {
        ui.notifications.error(
            'Artificer API not ready. Reload the world and run the macro again. If it still fails, check the console (F12) for module errors.'
        );
        return;
    }

    const label = dryRun ? 'Dry run (no changes)' : 'Apply';
    ui.notifications.info(`Artificer: ${label} Potion Brewing data to recipe pages…`);

    const result = await api.recipes.applyPotionBrewingData({ dryRun });

    const msg = dryRun
        ? `Would update ${result.updated} page(s), ${result.skipped} skipped, ${result.notInData} not in PDF data, ${result.errors.length} error(s).`
        : `Updated ${result.updated} page(s), ${result.skipped} skipped, ${result.notInData} not in PDF data, ${result.errors.length} error(s).`;
    ui.notifications.info(msg);

    if (result.errors.length > 0) {
        console.warn(`${MODULE_ID} Apply Potion Brewing errors:`, result.errors);
        result.errors.forEach(({ name, error }) => {
            console.warn(`  - ${name}: ${error}`);
        });
    }
})();
