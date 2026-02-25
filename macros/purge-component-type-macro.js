/**
 * Artificer: Purge componentType from World Items
 *
 * Removes the deprecated `componentType` flag from all world items that have it.
 * Component Type has been removed from the system; Family + Traits handle classification.
 *
 * 1. Back up your world before running.
 * 2. Create a new Macro in Foundry (Script type), name e.g. "Artificer: Purge Component Type".
 * 3. Paste this script and run as GM.
 *
 * World items only. Run separately on compendium packs if needed.
 */

const MODULE_ID = 'coffee-pub-artificer';

let purged = 0;
let skipped = 0;
const errors = [];

for (const item of game.items) {
    const flags = item.flags?.[MODULE_ID] ?? item.flags?.artificer;
    if (!flags || !('componentType' in flags)) {
        skipped++;
        continue;
    }
    try {
        const flagPath = item.flags[MODULE_ID] ? `${MODULE_ID}` : 'artificer';
        await item.update({
            [`flags.${flagPath}.-=componentType`]: null
        });
        purged++;
    } catch (e) {
        errors.push(`${item.name} (${item.uuid}): ${e.message}`);
    }
}

const msg = `Purge complete: ${purged} items purged of componentType, ${skipped} skipped.`;
ui.notifications.info(msg);
if (errors.length) {
    console.warn(`${MODULE_ID} purge errors:`, errors);
    ui.notifications.warn(`${errors.length} errors (see console).`);
}
console.log(`${MODULE_ID} purge report:`, { purged, skipped, errors });
