/**
 * Artificer: Migrate WORLD ITEMS (TYPE > FAMILY > TRAITS)
 *
 * World items are what feed the compendium packs. Run this on world items first;
 * then export/update your compendia from the migrated world items as needed.
 *
 * 1. Back up your world (or run on a copy) before running.
 * 2. Create a new Macro in Foundry (Script type), name e.g. "Artificer: Migrate World Items".
 * 3. Paste this script and run as GM.
 *
 * Migrates world items only from legacy flags (primaryTag, secondaryTags, quirk)
 * to the new model (type, family, traits). Idempotent: safe to run multiple times.
 */

const MODULE_ID = 'coffee-pub-artificer';
const api = game.modules.get(MODULE_ID)?.api;

if (!api?.runMigration) {
    ui.notifications.error('Artificer API not available. Is the module enabled?');
} else {
    // World items only (no compendia) — these feed the compendium packs
    const options = {};

    const report = await api.runMigration(options);
    const msg = `Migration complete: ${report.migrated} items migrated, ${report.skipped} skipped.`;
    ui.notifications.info(msg);
    if (report.errors?.length) {
        console.warn(`${MODULE_ID} migration errors:`, report.errors);
        ui.notifications.warn(`${report.errors.length} errors (see console).`);
    }
    console.log(`${MODULE_ID} migration report:`, report);
}
