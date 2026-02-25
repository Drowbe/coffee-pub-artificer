/**
 * Artificer: Migrate Recipes by Rarity
 *
 * Migrates recipe pages from the three skill journals into new journals by rarity:
 * - Herbalist Recipes  → Herbalist Recipes - Common, Herbalist Recipes - Uncommon, etc.
 * - Alchemist Recipes → Alchemist Recipes - Common, Alchemist Recipes - Uncommon, etc.
 * - Poisoncraft Recipes → Poisoncraft Recipes - Common, Poisoncraft Recipes - Uncommon, etc.
 *
 * Only processes journals that are in the module's recipe source (world journal folder
 * or configured compendiums). Target journals are created in the world. Pages from
 * world journals are moved (removed from source); pages from compendiums are copied
 * (compendium unchanged). Pages are then sorted alphabetically by name in each target.
 *
 * 1. Back up your world before running.
 * 2. Ensure Artificer has Recipe Journal / Recipe Journal Folder (or compendiums) set.
 * 3. Create a Macro (Script), paste this script, run as GM.
 *
 * Set dryRun: true to preview without moving or deleting anything.
 */

const MODULE_ID = 'coffee-pub-artificer';

/** Artificer recipe journal base names we migrate (exact match). */
const SOURCE_JOURNAL_NAMES = ['Herbalist Recipes', 'Alchemist Recipes', 'Poisoncraft Recipes'];

/** Rarity display for journal name (order preserved). */
const RARITIES = ['common', 'uncommon', 'rare', 'very rare', 'legendary'];

function capitalizeRarity(r) {
    if (!r || r === 'very rare') return r === 'very rare' ? 'Very Rare' : 'Common';
    return r.charAt(0).toUpperCase() + r.slice(1);
}

/** Wait for Artificer API. */
async function getArtificerAPI(maxWaitMs = 5000) {
    let elapsed = 0;
    const step = 200;
    while (elapsed < maxWaitMs) {
        const m = game.modules.get(MODULE_ID);
        if (m?.active && m?.api?.recipes?.refresh) return m.api;
        await new Promise((r) => setTimeout(r, step));
        elapsed += step;
    }
    return game.modules.get(MODULE_ID)?.api ?? null;
}

/** Collect Artificer recipe source journals (world + compendiums) whose name is in SOURCE_JOURNAL_NAMES. */
async function getSourceJournals() {
    const source = game.settings.get(MODULE_ID, 'recipeStorageSource') ?? 'compendia-then-world';
    const loadWorld = ['world-only', 'compendia-then-world', 'world-then-compendia'].includes(source);
    const loadCompendia = ['compendia-only', 'compendia-then-world', 'world-then-compendia'].includes(source);
    const nameSet = new Set(SOURCE_JOURNAL_NAMES);
    const list = [];

    if (loadWorld && game.journal) {
        const folderId = game.settings.get(MODULE_ID, 'recipeJournalFolder') ?? '';
        let journals;
        if (folderId && game.folders) {
            const allowed = new Set([folderId]);
            const folders = game.folders.filter((f) => f.type === 'JournalEntry');
            let added;
            do {
                added = 0;
                for (const f of folders) {
                    if (f.folder?.id && allowed.has(f.folder.id) && !allowed.has(f.id)) {
                        allowed.add(f.id);
                        added++;
                    }
                }
            } while (added > 0);
            journals = game.journal.filter(
                (j) => j.documentName === 'JournalEntry' && j.uuid && j.folder?.id && allowed.has(j.folder.id)
            );
        } else {
            journals = game.journal.filter((j) => j.documentName === 'JournalEntry' && j.uuid);
        }
        for (const j of journals) {
            const name = (j.name || '').trim();
            if (nameSet.has(name)) list.push({ uuid: j.uuid, name, isWorld: true, journal: j });
        }
    }

    if (loadCompendia) {
        const num = Math.max(0, Math.min(10, parseInt(game.settings.get(MODULE_ID, 'numRecipeCompendiums'), 10) || 0));
        for (let i = 1; i <= num; i++) {
            const cid = game.settings.get(MODULE_ID, `recipeCompendium${i}`) ?? 'none';
            if (!cid || cid === 'none') continue;
            const pack = game.packs.get(cid);
            if (!pack || pack.documentName !== 'JournalEntry') continue;
            const docs = await pack.getDocuments();
            for (const doc of docs) {
                if (!doc?.uuid) continue;
                const name = (doc.name || '').trim();
                if (nameSet.has(name)) list.push({ uuid: doc.uuid, name, isWorld: false, journal: doc });
            }
        }
    }

    return list;
}

/** Get or create a world journal by name (optionally in folder). */
async function getOrCreateWorldJournal(name, folderId = '') {
    let journal = game.journal?.find((j) => (j.name || '').trim() === name);
    if (!journal) {
        const data = { name };
        if (folderId) data.folder = folderId;
        journal = await JournalEntry.create(data);
    }
    return journal;
}

/** Sort pages in a journal by name (alphabetically) via sort field if supported. */
async function sortJournalPagesByName(journal) {
    const pages = journal.pages?.contents ?? [];
    if (pages.length <= 1) return;
    const sorted = [...pages].sort((a, b) => {
        const na = (a.name || '').toLowerCase();
        const nb = (b.name || '').toLowerCase();
        return na.localeCompare(nb, undefined, { sensitivity: 'base' });
    });
    const updates = sorted.map((p, i) => ({ _id: p.id, sort: i }));
    if (updates.length) await journal.updateEmbeddedDocuments('JournalEntryPage', updates);
}

(async () => {
    const dryRun = false; // Set true to preview only

    if (!game.user?.isGM) {
        ui.notifications.warn('Only a GM can run the Migrate Recipes by Rarity macro.');
        return;
    }

    const mod = game.modules.get(MODULE_ID);
    if (!mod?.active) {
        ui.notifications.error('Artificer is not enabled.');
        return;
    }

    const api = await getArtificerAPI();
    if (!api?.recipes?.refresh) {
        ui.notifications.error('Artificer API not ready. Reload the world and try again.');
        return;
    }

    await api.recipes.refresh();
    const recipes = api.recipes.getAll();
    const recipeByUuid = new Map();
    for (const r of recipes) {
        if (r?.id) recipeByUuid.set(r.id, r);
    }

    const sourceJournals = await getSourceJournals();
    if (!sourceJournals.length) {
        ui.notifications.warn(
            'No Artificer recipe journals found with names: ' + SOURCE_JOURNAL_NAMES.join(', ') +
            '. Check module settings (Recipe Journal Folder or Recipe Compendiums).'
        );
        return;
    }

    const folderId = (game.settings.get(MODULE_ID, 'recipeJournalFolder') ?? '').trim();
    const toMove = []; // { sourceJournal, page, recipe, targetJournalName, isWorld }

    for (const { uuid, name, isWorld, journal } of sourceJournals) {
        const journalDoc = journal ?? (await fromUuid(uuid));
        if (!journalDoc || journalDoc.documentName !== 'JournalEntry') continue;
        const pages = journalDoc.pages?.contents ?? [];
        for (const page of pages) {
            if (page.type !== 'text') continue;
            const recipe = recipeByUuid.get(page.uuid) ?? null;
            const rarity = recipe?.rarity
                ? (String(recipe.rarity).toLowerCase().trim() || 'common')
                : 'common';
            const safeRarity = RARITIES.includes(rarity) ? rarity : 'common';
            const targetName = `${name} - ${capitalizeRarity(safeRarity)}`;
            toMove.push({
                sourceJournal: journalDoc,
                page,
                recipe,
                targetJournalName: targetName,
                isWorld
            });
        }
    }

    if (!toMove.length) {
        ui.notifications.info('No recipe pages found in the source journals.');
        return;
    }

    if (dryRun) {
        const byTarget = new Map();
        for (const { targetJournalName, page } of toMove) {
            if (!byTarget.has(targetJournalName)) byTarget.set(targetJournalName, []);
            byTarget.get(targetJournalName).push(page.name || page.id);
        }
        const msg = `Dry run: would move ${toMove.length} page(s) into ${byTarget.size} journal(s).`;
        console.log(`${MODULE_ID} Migrate by Rarity (dry run):`, byTarget);
        ui.notifications.info(msg);
        return;
    }

    // Create target journals and move pages
    let created = 0;
    let deleted = 0;
    const errors = [];

    for (const { sourceJournal, page, targetJournalName, isWorld } of toMove) {
        try {
            const targetJournal = await getOrCreateWorldJournal(targetJournalName, folderId);
            const content = page.text?.content ?? page.text?.markdown ?? '';
            await targetJournal.createEmbeddedDocuments('JournalEntryPage', [
                {
                    name: page.name || 'Untitled',
                    type: 'text',
                    text: { content: content || '' }
                }
            ]);
            created++;
            if (isWorld && sourceJournal.id) {
                try {
                    await sourceJournal.deleteEmbeddedDocuments('JournalEntryPage', [page.id]);
                    deleted++;
                } catch (e) {
                    errors.push({ name: page.name, error: `Delete from source: ${e?.message ?? e}` });
                }
            }
        } catch (e) {
            errors.push({ name: page.name ?? page.id, error: e?.message ?? String(e) });
        }
    }

    // Sort each target journal by page name
    const targetNames = [...new Set(toMove.map((m) => m.targetJournalName))];
    for (const targetName of targetNames) {
        const journal = game.journal?.find((j) => (j.name || '').trim() === targetName);
        if (journal) {
            try {
                await sortJournalPagesByName(journal);
            } catch (e) {
                console.warn(`${MODULE_ID} Sort "${targetName}":`, e?.message ?? e);
            }
        }
    }

    if (api.recipes.refresh) await api.recipes.refresh();

    ui.notifications.info(
        `Migrated ${created} recipe(s) into ${targetNames.length} journal(s). ` +
        (deleted > 0 ? `Removed ${deleted} from source. ` : '') +
        (errors.length ? `${errors.length} error(s) — see console.` : '')
    );
    if (errors.length) {
        console.warn(`${MODULE_ID} Migrate by Rarity errors:`, errors);
    }
})();
