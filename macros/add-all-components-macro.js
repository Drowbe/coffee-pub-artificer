/**
 * Artificer: Add 5 of every artificer component to the selected token(s).
 *
 * Uses world items + configured Artificer ingredient compendia. Only items with
 * Artificer type "Component" are added. Run as GM. Select one or more tokens, then run.
 */

const MODULE_ID = 'coffee-pub-artificer';
const QUANTITY = 5;

function isArtificerComponent(item) {
    if (!item) return false;
    const f = item.flags?.[MODULE_ID] ?? item.flags?.artificer;
    const t = f?.artificerType ?? f?.type;
    return t === 'Component' || t === 'component';
}

function getConfiguredCompendiumIds() {
    const ids = [];
    try {
        const num = game.settings.get(MODULE_ID, 'numIngredientCompendiums') ?? 1;
        for (let i = 1; i <= num; i++) {
            const id = game.settings.get(MODULE_ID, `ingredientCompendium${i}`);
            if (id && id !== 'none' && id !== '') ids.push(id);
        }
    } catch (_) {}
    return ids;
}

async function getAllComponentItems() {
    const byKey = new Map();
    const add = (item) => {
        const key = `${(item.name || '').trim()}|${item.type || 'consumable'}`;
        if (!byKey.has(key)) byKey.set(key, item);
    };

    for (const item of game.items) {
        if (isArtificerComponent(item)) add(item);
    }

    for (const packId of getConfiguredCompendiumIds()) {
        const pack = game.packs.get(packId);
        if (!pack || pack.documentName !== 'Item') continue;
        try {
            const index = await pack.getIndex();
            const contents = index?.contents ?? index?.index ?? (Array.isArray(index) ? index : []);
            const entries = Array.isArray(contents) ? contents : [];
            for (const entry of entries) {
                try {
                    const item = await pack.getDocument(entry._id ?? entry.id);
                    if (item && isArtificerComponent(item)) add(item);
                } catch (_) {}
            }
        } catch (_) {}
    }

    return Array.from(byKey.values());
}

const tokens = canvas?.tokens?.controlled ?? [];
if (!tokens.length) {
    ui.notifications.warn('No token selected. Select one or more tokens and run again.');
} else {
    const actors = tokens.map((t) => t.actor).filter(Boolean);
    if (!actors.length) {
        ui.notifications.warn('Selected token(s) have no actor.');
    } else {
        const components = await getAllComponentItems();
        if (!components.length) {
            ui.notifications.warn('No artificer components found in world or configured compendia. Refresh the item cache or add component items.');
        } else {
            let added = 0;
            const errors = [];
            for (const actor of actors) {
                for (const item of components) {
                    try {
                        const data = item.toObject();
                        delete data._id;
                        if (data.id !== undefined) delete data.id;
                        const existing = actor.items.find((i) => (i.name || '').trim() === (data.name || '').trim() && (i.type || '') === (data.type || 'consumable'));
                        if (existing) {
                            const q = existing.system?.quantity ?? 0;
                            await existing.update({ 'system.quantity': q + QUANTITY });
                        } else {
                            if (!data.system) data.system = {};
                            data.system.quantity = QUANTITY;
                            await actor.createEmbeddedDocuments('Item', [data]);
                        }
                        added++;
                    } catch (e) {
                        errors.push(`${actor.name} / ${item.name}: ${e.message}`);
                    }
                }
            }
            const msg = `Added ${QUANTITY} each of ${components.length} component(s) to ${actors.length} actor(s). ${added} item operations.`;
            ui.notifications.info(msg);
            if (errors.length) {
                console.warn(`${MODULE_ID} add-components macro errors:`, errors);
                ui.notifications.warn(`${errors.length} errors (see console).`);
            }
        }
    }
}
