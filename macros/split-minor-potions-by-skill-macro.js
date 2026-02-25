/**
 * Artificer: Split Minor Potions by Skill
 *
 * WORLD JOURNALS ONLY. Never reads or writes compendiums.
 * ONLY processes the world journal named exactly "Minor Potions".
 * Splits its pages into two new world journals:
 * - Pages with Skill: Alchemy  → "Minor Alchemy Potions" (alphabetical)
 * - Pages with Skill: Herbalism → "Minor Herbal Potions" (alphabetical)
 *
 * Pages that match neither skill are skipped (reported in console).
 * Source pages are moved (removed from "Minor Potions") after copy.
 *
 * 1. Back up your world before running.
 * 2. Create a Macro (Script), paste this script, run as GM.
 *
 * Set dryRun: true to preview without moving or creating anything.
 */

const MODULE_ID = 'coffee-pub-artificer';
const SOURCE_JOURNAL_NAME = 'Minor Potions';
const TARGET_ALCHEMY = 'Minor Alchemy Potions';
const TARGET_HERBALISM = 'Minor Herbal Potions';

/** Set true to preview without moving or creating anything. */
const dryRun = false;

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

/** Strip HTML tags and normalize whitespace for text search. */
function getSearchableText(page) {
    const content = page.text?.content ?? page.text?.markdown ?? '';
    if (!content) return '';
    const stripped = String(content)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    return stripped;
}

/** Determine skill for a page: use recipe API if available, else scan page text for Skill: Alchemy / Skill: Herbalism (handles HTML). */
function getSkillForPage(page, recipeByUuid) {
    const recipe = recipeByUuid?.get(page.uuid) ?? null;
    if (recipe?.skill) {
        const s = String(recipe.skill).trim();
        if (s.toLowerCase() === 'alchemy') return 'Alchemy';
        if (s.toLowerCase() === 'herbalism') return 'Herbalism';
    }
    const raw = getSearchableText(page);
    if (!raw) return null;
    // Match "skill" followed by optional colon/whitespace and then "alchemy" or "herbalism"
    if (/\bskill\s*:?\s*alchemy\b/.test(raw)) return 'Alchemy';
    if (/\bskill\s*:?\s*herbalism\b/.test(raw)) return 'Herbalism';
    return null;
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

/** Sort pages in a journal by name (alphabetically) via sort field. */
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
    if (!game.user?.isGM) {
        ui.notifications.warn('Only a GM can run the Split Minor Potions macro.');
        return;
    }

    const mod = game.modules.get(MODULE_ID);
    if (!mod?.active) {
        ui.notifications.error('Artificer is not enabled.');
        return;
    }

    const sourceJournal = game.journal?.find((j) => (j.name || '').trim() === SOURCE_JOURNAL_NAME);
    if (!sourceJournal) {
        ui.notifications.warn(`No world journal named "${SOURCE_JOURNAL_NAME}" found.`);
        return;
    }

    const api = await getArtificerAPI();
    if (api?.recipes?.refresh) await api.recipes.refresh();
    const recipes = api?.recipes?.getAll() ?? [];
    const recipeByUuid = new Map();
    for (const r of recipes) {
        if (r?.id) recipeByUuid.set(r.id, r);
    }

    const pages = sourceJournal.pages?.contents ?? [];
    if (!pages.length) {
        ui.notifications.info(`"${SOURCE_JOURNAL_NAME}" has no pages.`);
        return;
    }

    const toAlchemy = [];
    const toHerbalism = [];
    const skipped = [];

    for (const page of pages) {
        if (page.type !== 'text') {
            skipped.push({ name: page.name || page.id, reason: 'not text page' });
            continue;
        }
        const skill = getSkillForPage(page, recipeByUuid);
        if (skill === 'Alchemy') toAlchemy.push(page);
        else if (skill === 'Herbalism') toHerbalism.push(page);
        else skipped.push({ name: page.name || page.id, reason: 'no Skill: Alchemy or Skill: Herbalism' });
    }

    if (!toAlchemy.length && !toHerbalism.length) {
        ui.notifications.warn(`No pages with Skill: Alchemy or Skill: Herbalism found in "${SOURCE_JOURNAL_NAME}".`);
        if (skipped.length) console.log(`${MODULE_ID} Split Minor Potions skipped:`, skipped);
        return;
    }

    if (dryRun) {
        const msg = `Dry run: would move ${toAlchemy.length} page(s) → "${TARGET_ALCHEMY}", ${toHerbalism.length} page(s) → "${TARGET_HERBALISM}".`;
        console.log(`${MODULE_ID} Split Minor Potions (dry run):`, {
            alchemy: toAlchemy.map((p) => p.name),
            herbalism: toHerbalism.map((p) => p.name),
            skipped
        });
        ui.notifications.info(msg);
        return;
    }

    const folderId = (typeof sourceJournal.folder === 'string' ? sourceJournal.folder : sourceJournal.folder?.id) || (game.settings.get(MODULE_ID, 'recipeJournalFolder') ?? '').trim();
    const errors = [];

    for (const [targetName, pageList] of [[TARGET_ALCHEMY, toAlchemy], [TARGET_HERBALISM, toHerbalism]]) {
        if (!pageList.length) continue;
        try {
            const targetJournal = await getOrCreateWorldJournal(targetName, folderId);
            for (const page of pageList) {
                try {
                    const content = page.text?.content ?? page.text?.markdown ?? '';
                    await targetJournal.createEmbeddedDocuments('JournalEntryPage', [
                        { name: page.name || 'Untitled', type: 'text', text: { content: content || '' } }
                    ]);
                } catch (e) {
                    errors.push({ page: page.name ?? page.id, error: e?.message ?? String(e) });
                }
            }
            await sortJournalPagesByName(targetJournal);
        } catch (e) {
            errors.push({ journal: targetName, error: e?.message ?? String(e) });
        }
    }

    let deleted = 0;
    for (const page of [...toAlchemy, ...toHerbalism]) {
        try {
            await sourceJournal.deleteEmbeddedDocuments('JournalEntryPage', [page.id]);
            deleted++;
        } catch (e) {
            errors.push({ name: page.name, error: `Delete from source: ${e?.message ?? e}` });
        }
    }

    if (api?.recipes?.refresh) await api.recipes.refresh();

    ui.notifications.info(
        `Split "${SOURCE_JOURNAL_NAME}": ${toAlchemy.length} → "${TARGET_ALCHEMY}", ${toHerbalism.length} → "${TARGET_HERBALISM}". ` +
        `Removed ${deleted} from source.` +
        (errors.length ? ` ${errors.length} error(s) — see console.` : '')
    );
    if (skipped.length) console.log(`${MODULE_ID} Split Minor Potions skipped:`, skipped);
    if (errors.length) console.warn(`${MODULE_ID} Split Minor Potions errors:`, errors);
})();
