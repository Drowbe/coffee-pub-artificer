/**
 * Artificer: Repair the Source credit on already-converted recipe pages.
 *
 * WHY THIS EXISTS. The old HTML parser used one field for two things: it seeded
 * `source` with the parent JOURNAL'S UUID and only replaced it if the page carried
 * a `Source:` label. So a page without that label ended up with `source` holding
 * something like `JournalEntry.LvdqYMPzjjQSUb4O`. The recipe sheet prints `source`
 * as the Source credit, so those pages display a raw id where a sourcebook belongs.
 *
 * The conversion macro carried that through faithfully. This fixes it afterwards.
 *
 * A PLAIN UPDATE, not a delete-and-recreate: the page type is not changing, so ids,
 * ownership and sort are untouched by definition.
 *
 * ONLY TOUCHES PAGES THAT NEED IT. A page with a real credit is left exactly as it
 * is -- this must not overwrite an author's own attribution with a default.
 *
 * DRY RUN IS THE DEFAULT. Set APPLY to true once the report looks right.
 *
 * Run as GM.
 */

const MODULE_ID = 'coffee-pub-artificer';

/** Set to true to actually write. Leave false to see what would change. */
const APPLY = false;

/** The credit to apply where one is missing. */
const DEFAULT_SOURCE = 'Artificer - Potion Brewing and Ingredient Gathering';

/** Limit to journals whose name matches, or leave blank for every journal. */
const JOURNAL_NAME_FILTER = '';

const { RECIPE_PAGE_TYPE } = await import(`/modules/${MODULE_ID}/scripts/data/models/model-recipe-page.js`);

if (!game.user.isGM) {
    ui.notifications.warn('Only a GM can repair recipe pages.');
} else {

    /** A document id that leaked into `source`, rather than an authored credit. */
    const isUuidLike = (value) => /^(Compendium\.)?[A-Za-z]+\.[A-Za-z0-9]{16}/.test(String(value ?? '').trim());

    const report = { repaired: [], alreadyCredited: [], failed: [] };

    let journals = game.journal.contents;
    if (JOURNAL_NAME_FILTER.trim()) {
        journals = journals.filter(j => (j.name || '').trim() === JOURNAL_NAME_FILTER.trim());
    }

    for (const journal of journals) {
        const updates = [];

        for (const page of journal.pages?.contents ?? []) {
            if (page.type !== RECIPE_PAGE_TYPE) continue;

            const current = String(page.system?.source ?? '').trim();
            const label = `${journal.name} / ${page.name}`;

            if (current && !isUuidLike(current)) {
                report.alreadyCredited.push(`${label} — "${current}"`);
                continue;
            }

            report.repaired.push(`${label}${current ? ` (was "${current}")` : ' (was empty)'}`);
            if (APPLY) updates.push({ _id: page.id, 'system.source': DEFAULT_SOURCE });
        }

        if (APPLY && updates.length) {
            try {
                await journal.updateEmbeddedDocuments('JournalEntryPage', updates);
            } catch (error) {
                report.failed.push(`${journal.name} (${error?.message ?? error})`);
            }
        }
    }

    const mode = APPLY ? 'REPAIRED' : 'DRY RUN — nothing was written';
    console.log(`${MODULE_ID} | Recipe source repair (${mode})`, report);
    ui.notifications.info(
        `Artificer recipe sources — ${mode}. `
        + `${report.repaired.length} to fix, `
        + `${report.alreadyCredited.length} already credited, `
        + `${report.failed.length} failed. Full report in the console.`
    );
}
