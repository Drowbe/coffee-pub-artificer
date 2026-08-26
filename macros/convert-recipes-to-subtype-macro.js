/**
 * Artificer: Convert legacy `text` recipe pages to the `coffee-pub-artificer.recipe` subtype.
 *
 * WHY A DELETE AND RECREATE. A page's `type` cannot be changed by update, so each
 * page must be removed and rebuilt. It is recreated with `keepId: true` so its
 * UUID survives -- every `@UUID` link a GM wrote to a recipe would otherwise break
 * silently. `sort` and `ownership` are carried over for the same reason: a hidden
 * recipe must not become visible, and a mixed journal must not reorder.
 *
 * DRY RUN IS THE DEFAULT. Nothing is written until you set APPLY to true. Run it
 * once as-is, read the report, then run it again with APPLY on.
 *
 * A BACKUP FILE IS WRITTEN BEFORE ANY DELETION when APPLY is true. The failure this
 * insures against includes "the world will not load", so it is a file you keep, not
 * a setting inside the world.
 *
 * UNDER-CONVERTS ON PURPOSE. A page converts only if RecipeParser can read it AND
 * the result validates. A Cover Page, a note, a half-written draft: all fail that
 * and are left exactly as they are. A missed recipe still works through the legacy
 * reader; a wrongly converted Cover Page is destroyed. Those are not symmetrical.
 *
 * Run as GM, on a world you have backed up.
 */

const MODULE_ID = 'coffee-pub-artificer';

/** Set to true to actually convert. Leave false to see what would happen. */
const APPLY = false;

/** Limit to journals whose name matches, or leave blank for every journal. */
const JOURNAL_NAME_FILTER = '';

/**
 * Credit to use when a page never had a `Source:` line.
 *
 * The old parser seeded `source` with the parent JOURNAL'S UUID and only replaced
 * it if the page carried a Source label -- so one field meant "sourcebook credit"
 * on some pages and "which journal am I in" on others. The recipe sheet prints it
 * as the Source credit, so those pages would display a raw id.
 *
 * Set to '' to leave such pages blank instead of crediting them.
 */
const DEFAULT_SOURCE = 'Artificer - Potion Brewing and Ingredient Gathering';

const { RecipeParser } = await import(`/modules/${MODULE_ID}/scripts/parsers/parser-recipe.js`);
const { RECIPE_PAGE_TYPE } = await import(`/modules/${MODULE_ID}/scripts/data/models/model-recipe-page.js`);

if (!game.user.isGM) {
    ui.notifications.warn('Only a GM can convert recipe pages.');
} else {

    /** A UUID that leaked into `source`, rather than an authored credit. */
    const isUuidLike = (value) => /^(Compendium\.)?[A-Za-z]+\.[A-Za-z0-9]{16}/.test(String(value ?? '').trim());

    /** Map a parsed recipe onto the subtype page's system fields. */
    const toSystem = (recipe) => ({
        resultItemName: recipe.resultItemName ?? '',
        traits: Array.from(recipe.traits ?? []),
        ingredients: Array.from(recipe.ingredients ?? []).map(i => ({
            type: i.type ?? 'Component',
            family: i.family ?? '',
            name: i.name ?? '',
            quantity: i.quantity ?? 1
        })),
        processType: recipe.processType ?? 'heat',
        processLevel: recipe.processLevel ?? 0,
        time: recipe.time ?? null,
        apparatusName: recipe.apparatusName ?? '',
        containerName: recipe.containerName ?? '',
        goldCost: recipe.goldCost ?? null,
        workHours: recipe.workHours ?? null,
        successDC: recipe.successDC ?? null,
        type: recipe.type ?? 'Consumable',
        category: recipe.category ?? '',
        rarity: recipe.rarity ?? '',
        skill: recipe.skill ?? '',
        skillLevel: recipe.skillLevel ?? 1,
        skillKit: recipe.skillKit ?? '',
        source: isUuidLike(recipe.source) || !String(recipe.source ?? '').trim()
            ? DEFAULT_SOURCE
            : recipe.source,
        license: recipe.license ?? ''
    });

    /**
     * Does this page LOOK like a recipe, regardless of whether it parsed?
     *
     * The parser returns null both for a cover page and for a recipe it could not
     * read, which makes "skipped" a bucket with two very different meanings in it.
     * A page carrying recipe labels that still failed to parse is the dangerous
     * case: it is content we are about to leave behind without noticing.
     */
    const looksLikeRecipe = (html) => {
        const text = String(html ?? '');
        const markers = [/<strong>\s*Result\s*:/i, /<strong>\s*Ingredients\s*:/i, /<strong>\s*Skill\s*:/i];
        return markers.filter(m => m.test(text)).length >= 2;
    };

    const report = {
        converted: [],
        // Pages with no recipe markers at all. Cover pages, prose, notes.
        skippedNotRecipes: [],
        skippedAlreadyConverted: [],
        // REVIEW THESE. Recipe-shaped, but the parser could not read them.
        skippedLooksLikeRecipe: [],
        // Pages whose Source was a journal UUID or empty, credited to DEFAULT_SOURCE.
        sourceDefaulted: [],
        failed: [],
        byJournal: {},
        journals: 0
    };
    const backup = [];

    let journals = game.journal.contents;
    if (JOURNAL_NAME_FILTER.trim()) {
        journals = journals.filter(j => (j.name || '').trim() === JOURNAL_NAME_FILTER.trim());
    }

    for (const journal of journals) {
        const candidates = [];

        for (const page of journal.pages?.contents ?? []) {
            if (page.type === RECIPE_PAGE_TYPE) {
                report.skippedAlreadyConverted.push(`${journal.name} / ${page.name}`);
                continue;
            }
            if (page.type !== 'text') continue;

            const raw = page.text?.content ?? page.text?.markdown ?? '';
            let recipe = null;
            try {
                recipe = await RecipeParser.parseSinglePage(page, raw, journal);
            } catch (error) {
                report.failed.push(`${journal.name} / ${page.name} (parser threw: ${error?.message ?? error})`);
                continue;
            }
            if (!recipe) {
                const label = `${journal.name} / ${page.name}`;
                if (looksLikeRecipe(raw)) report.skippedLooksLikeRecipe.push(label);
                else report.skippedNotRecipes.push(label);
                continue;
            }

            if (isUuidLike(recipe.source) || !String(recipe.source ?? '').trim()) {
                report.sourceDefaulted.push(`${journal.name} / ${page.name}`);
            }
            candidates.push({ page, recipe });
        }

        if (!candidates.length) continue;
        report.journals++;
        report.byJournal[journal.name] = candidates.length;

        for (const { page, recipe } of candidates) {
            const label = `${journal.name} / ${page.name}`;
            if (!APPLY) {
                report.converted.push(label);
                continue;
            }

            // Full source of the page, before anything is destroyed.
            backup.push({ journal: journal.name, journalId: journal.id, page: page.toObject() });

            const rebuilt = {
                _id: page.id,
                name: page.name,
                type: RECIPE_PAGE_TYPE,
                sort: page.sort,
                ownership: foundry.utils.deepClone(page.ownership ?? {}),
                title: foundry.utils.deepClone(page.title ?? {}),
                text: { content: recipe.description ?? '' },
                system: toSystem(recipe)
            };

            try {
                await journal.deleteEmbeddedDocuments('JournalEntryPage', [page.id]);
                const [created] = await journal.createEmbeddedDocuments('JournalEntryPage', [rebuilt], { keepId: true });
                if (!created) throw new Error('page was not recreated');

                // Verify before moving on. A converter getting one page wrong is
                // probably getting others wrong, so a mismatch stops this journal.
                const check = created.system;
                if ((check.resultItemName ?? '') !== (recipe.resultItemName ?? '')
                    || (check.ingredients ?? []).length !== (recipe.ingredients ?? []).length) {
                    throw new Error('round-trip mismatch after recreate');
                }
                report.converted.push(label);
            } catch (error) {
                report.failed.push(`${label} (${error?.message ?? error})`);
                ui.notifications.error(`Artificer: conversion stopped in "${journal.name}". See console.`);
                break;
            }
        }
    }

    if (APPLY && backup.length) {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        // Namespaced: the bare global is deprecated in v13.
        foundry.utils.saveDataToFile(JSON.stringify(backup, null, 2), 'text/json', `artificer-recipe-backup-${stamp}.json`);
    }

    const mode = APPLY ? 'CONVERTED' : 'DRY RUN — nothing was written';
    console.log(`${MODULE_ID} | Recipe conversion (${mode})`, report);
    if (report.skippedLooksLikeRecipe.length) {
        console.warn(`${MODULE_ID} | REVIEW: recipe-shaped pages that did NOT parse and will be left behind:`,
            report.skippedLooksLikeRecipe);
    }
    ui.notifications.info(
        `Artificer recipes — ${mode}. `
        + `${report.converted.length} to convert, `
        + `${report.skippedLooksLikeRecipe.length} need review, `
        + `${report.skippedNotRecipes.length} not recipes, `
        + `${report.sourceDefaulted.length} credited to the default source, `
        + `${report.failed.length} failed. Full report in the console.`
    );
}
