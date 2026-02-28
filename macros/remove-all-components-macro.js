/**
 * Artificer: Remove all artificer components from the selected token(s) inventory.
 *
 * Deletes every item on the actor that has Artificer type "Component".
 * Run as GM. Select one or more tokens, then run.
 */

const MODULE_ID = 'coffee-pub-artificer';

function isArtificerComponent(item) {
    if (!item) return false;
    const f = item.flags?.[MODULE_ID] ?? item.flags?.artificer;
    const t = f?.artificerType ?? f?.type;
    return t === 'Component' || t === 'component';
}

const tokens = canvas?.tokens?.controlled ?? [];
if (!tokens.length) {
    ui.notifications.warn('No token selected. Select one or more tokens and run again.');
} else {
    const actors = tokens.map((t) => t.actor).filter(Boolean);
    if (!actors.length) {
        ui.notifications.warn('Selected token(s) have no actor.');
    } else {
        let removed = 0;
        const errors = [];
        for (const actor of actors) {
            const toDelete = actor.items.filter(isArtificerComponent);
            if (toDelete.length) {
                try {
                    await actor.deleteEmbeddedDocuments('Item', toDelete.map((i) => i.id));
                    removed += toDelete.length;
                } catch (e) {
                    errors.push(`${actor.name}: ${e.message}`);
                }
            }
        }
        const msg = removed
            ? `Removed ${removed} artificer component(s) from ${actors.length} actor(s).`
            : `No artificer components found on selected actor(s).`;
        ui.notifications.info(msg);
        if (errors.length) {
            console.warn(`${MODULE_ID} remove-components macro errors:`, errors);
            ui.notifications.warn(`${errors.length} errors (see console).`);
        }
    }
}
