// ==================================================================
// ===== SUITE: RECIPE DECLARATION ===================================
// ==================================================================
// Asserts the recipe declaration registered (Track B: construction AND
// destination, no Artificer-owned import window), and surfaces exactly what
// `buildDocumentData` returns for this profile, so a shape change is visible
// here rather than only in a live import.
//
// The `build-document-data-shape` check's expectations WERE "no name, no
// container key" under Track A, when neither was declared. Track B declares
// both (`title` -> path:'name', `book` -> role:'input' feeding
// containerNameFrom), so the expectations flipped to match -- getting this
// wrong here would mean the suite asserts a contract the declaration no
// longer has, which is worse than no suite at all.
// ==================================================================

import { blacksmithApi, settingRow } from '../harness-lib.js';

const PROFILE_KIND = 'journal';
const PROFILE_ID = 'recipe';

/** The example payload from the declaration itself, so this suite cannot drift
 *  from what the declaration actually offers an author. */
function sampleEntry() {
    const group = blacksmithApi()?.importer?.getDeclaration?.(PROFILE_KIND, PROFILE_ID);
    return group?.fields?.reduce((entry, field) => {
        if (field.example !== undefined) entry[field.name] = field.example;
        return entry;
    }, {}) ?? null;
}

export default {
    id: 'recipe-declaration',
    label: 'Recipe Declaration',
    icon: 'fa-solid fa-scroll',

    settings: () => {
        const importer = blacksmithApi()?.importer;
        const declaration = importer?.getDeclaration?.(PROFILE_KIND, PROFILE_ID) ?? null;
        return [
            settingRow('declarationFromModel', typeof importer?.declarationFromModel === 'function' ? 'available' : 'ABSENT'),
            settingRow('registerDeclaration', typeof importer?.registerDeclaration === 'function' ? 'available' : 'ABSENT'),
            settingRow('buildDocumentData', typeof importer?.buildDocumentData === 'function' ? 'available' : 'ABSENT'),
            settingRow('Recipe declaration', declaration ? `registered (${declaration.fields?.length ?? 0} fields)` : 'NOT REGISTERED')
        ];
    },

    checks: [
        {
            id: 'registered',
            label: 'The recipe declaration is registered',
            tier: 'headless',
            group: 'Registration',
            note: 'Track B -- Blacksmith\'s Unified Import window is the only recipe import path; this declaration covers both construction (system fields) and destination (book/folder).',
            run: async ({ expect }) => {
                const importer = blacksmithApi()?.importer;
                expect.ok('Blacksmith importer API is present', Boolean(importer));
                expect.ok('declarationFromModel exists', typeof importer?.declarationFromModel === 'function');
                expect.ok('registerDeclaration exists', typeof importer?.registerDeclaration === 'function');
                const declaration = importer?.getDeclaration?.(PROFILE_KIND, PROFILE_ID);
                expect.ok('a declaration is registered for kind/id journal/recipe', Boolean(declaration));
                expect('document name', declaration?.document?.documentName, 'JournalEntryPage');
                expect('document type', declaration?.document?.type, 'coffee-pub-artificer.recipe');
                expect('document.containerNameFrom', declaration?.document?.containerNameFrom, 'book');
                expect('document.folderNameFrom', declaration?.document?.folderNameFrom, 'skill');
                expect.ok('document has NO containerName constant (containerNameFrom is the real mechanism now, not a placeholder)',
                    !('containerName' in (declaration?.document ?? {})));
                expect.ok('preamble is a non-empty string', typeof declaration?.preamble === 'string' && declaration.preamble.length > 0);
                // Named catalogs only -- 'actors'/'items' select Blacksmith's EXISTING Area-style
                // catalog UI. The object form ({id, label, type, includeWorld}) is REJECTED at
                // registration; an earlier draft used it and the author caught it before it shipped.
                expect('promptCatalogs', declaration?.promptCatalogs, ['items']);
                const field = (name) => declaration?.fields?.find(f => f.name === name);
                expect('journaltype selector role', field('journaltype')?.role, 'selector');
                expect('journaltype selector values', field('journaltype')?.values, ['recipe']);
                expect('title path', field('title')?.path, 'name');
                expect('description path', field('description')?.path, 'text.content');
                expect('book role', field('book')?.role, 'input');
            }
        },
        {
            id: 'values-correct-for-dynamic-fields',
            label: 'processType and skill carry no fixed values list',
            tier: 'headless',
            group: 'Registration',
            note: 'Both vocabularies are runtime-configurable. A values list here would reject legitimate recipes in a world whose processes or skills differ from ours -- confirm declarationFromModel did not invent one from somewhere.',
            run: async ({ expect }) => {
                const importer = blacksmithApi()?.importer;
                const declaration = importer?.getDeclaration?.(PROFILE_KIND, PROFILE_ID);
                const field = (name) => declaration?.fields?.find(f => f.name === name);
                expect.ok('processType has no values list', !field('processType')?.values);
                expect.ok('skill has no values list', !field('skill')?.values);
                expect.ok('type DOES have a values list (it is genuinely static)', Array.isArray(field('type')?.values) && field('type').values.length > 0);
                expect.ok('rarity DOES have a values list', Array.isArray(field('rarity')?.values) && field('rarity').values.length > 0);
            }
        },
        {
            id: 'build-document-data-shape',
            label: 'What buildDocumentData actually returns for a JournalEntryPage profile',
            tier: 'headless',
            group: 'Construction',
            note: 'Confirmed live through the Unified Import window (four cases: new book, existing book, second skill folder, re-import-updates-in-place), 2026-10-08. This check guards the shape so a later declaration change surfaces here before it surfaces as a broken import.',
            run: async ({ expect }) => {
                const importer = blacksmithApi()?.importer;
                expect.ok('buildDocumentData is available', typeof importer?.buildDocumentData === 'function');
                if (typeof importer?.buildDocumentData !== 'function') return;

                const entry = sampleEntry();
                expect.ok('a sample entry could be built from the declaration\'s own examples', Boolean(entry));
                if (!entry) return;

                let result;
                let threw = null;
                try {
                    result = await importer.buildDocumentData(PROFILE_KIND, PROFILE_ID, entry);
                } catch (error) {
                    threw = error;
                }
                expect.ok('buildDocumentData did not throw', !threw);
                if (threw) {
                    // The error itself is the finding -- surface it the same way.
                    expect('the error, verbatim', String(threw?.message ?? threw), '(see this value)');
                    return;
                }

                // THE ACTUAL FINDING, surfaced for a human either way, since the shape is
                // worth a look even when the assertions below pass.
                expect('RETURNED SHAPE', result, '(no prior expectation -- read this row)');
                expect.ok('has a system object', result && typeof result.system === 'object');
                expect('has the page name at the top level (from title -> path:\'name\')', result?.name, entry?.title);
                expect.ok('has text.content at the top level (from description -> path:\'text.content\')',
                    typeof result?.text?.content === 'string' && result.text.content.length > 0);
                expect.ok('has NO container/destination key at the top level (destination is resolved outside assemble(), from the raw entry, not written into the built document)',
                    !('container' in (result ?? {})) && !('containerName' in (result ?? {})) && !('folder' in (result ?? {})) && !('book' in (result ?? {})));
            }
        }
    ]
};
