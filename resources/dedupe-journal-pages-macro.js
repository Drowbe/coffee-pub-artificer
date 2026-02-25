/**
 * Artificer: Deduplicate Journal Pages (World Only)
 *
 * ONLY touches world journals. Never reads or writes compendiums.
 * For each world journal, finds pages with duplicate names (case-insensitive),
 * keeps the first occurrence, and deletes the rest.
 *
 * 1. Back up your world before running.
 * 2. Create a Macro (Script), paste this script, run as GM.
 *
 * Set dryRun: true to preview without deleting anything.
 */

const MODULE_ID = 'coffee-pub-artificer';

/** Set true to preview without deleting anything. */
const dryRun = false;

(async () => {
    if (!game.user?.isGM) {
        ui.notifications.warn('Only a GM can run the Dedupe Journal Pages macro.');
        return;
    }

    const journals = game.journal?.filter((j) => j.documentName === 'JournalEntry' && j.id) ?? [];
    let totalDeleted = 0;
    const report = [];

    for (const journal of journals) {
        const pages = journal.pages?.contents ?? [];
        if (pages.length <= 1) continue;

        const byName = new Map();
        for (const page of pages) {
            const key = (page.name || '').trim().toLowerCase() || '(unnamed)';
            if (!byName.has(key)) byName.set(key, []);
            byName.get(key).push(page);
        }

        const toDelete = [];
        for (const [, pageList] of byName) {
            if (pageList.length > 1) {
                for (let i = 1; i < pageList.length; i++) toDelete.push(pageList[i]);
            }
        }

        if (toDelete.length === 0) continue;

        report.push({ journal: journal.name, deleted: toDelete.length, names: [...new Set(toDelete.map((p) => p.name || '(unnamed)'))] });

        if (!dryRun) {
            try {
                await journal.deleteEmbeddedDocuments('JournalEntryPage', toDelete.map((p) => p.id));
                totalDeleted += toDelete.length;
            } catch (e) {
                console.error(`${MODULE_ID} Dedupe: failed to delete from "${journal.name}":`, e?.message ?? e);
            }
        } else {
            totalDeleted += toDelete.length;
        }
    }

    if (totalDeleted === 0) {
        ui.notifications.info('No duplicate page names found in world journals.');
        return;
    }

    if (dryRun) {
        console.log(`${MODULE_ID} Dedupe (dry run): would delete ${totalDeleted} duplicate page(s):`, report);
        ui.notifications.info(`Dry run: would delete ${totalDeleted} duplicate page(s) across ${report.length} journal(s). See console for details.`);
    } else {
        console.log(`${MODULE_ID} Dedupe: deleted ${totalDeleted} duplicate page(s):`, report);
        ui.notifications.info(`Deleted ${totalDeleted} duplicate page(s) across ${report.length} journal(s).`);
    }
})();
