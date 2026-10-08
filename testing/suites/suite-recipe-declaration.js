// ==================================================================
// ===== SUITE: RECIPE DECLARATION ===================================
// ==================================================================
// Asserts the recipe declaration registered, and -- the part that cannot be
// known by reading docs -- surfaces exactly what `buildDocumentData` returns
// for a JournalEntryPage profile, since neither side has read that code path.
//
// WHY THE SECOND CHECK IS EXPLORATORY, NOT A PASS/FAIL ASSERTION. We do not
// yet know the expected shape -- whether it includes a `type`, whether it
// nests under `system`, whether a container/destination field shows up
// unprompted. Asserting a specific shape before seeing one real result would
// be guessing dressed as a test. The full returned object is put into the
// PASS/FAIL table's own `actual` value (via `expect`, not `log`) specifically
// so it is visible from BOTH harness runners -- `run-headless.js` silences
// `log`, the dialog runner does not, and this must be readable from either.
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
            note: 'Track A only -- this declaration builds system data for us; it does not hand destination or window ownership to Blacksmith.',
            run: async ({ expect }) => {
                const importer = blacksmithApi()?.importer;
                expect.ok('Blacksmith importer API is present', Boolean(importer));
                expect.ok('declarationFromModel exists', typeof importer?.declarationFromModel === 'function');
                expect.ok('registerDeclaration exists', typeof importer?.registerDeclaration === 'function');
                const declaration = importer?.getDeclaration?.(PROFILE_KIND, PROFILE_ID);
                expect.ok('a declaration is registered for kind/id journal/recipe', Boolean(declaration));
                expect('document name', declaration?.document?.documentName, 'JournalEntryPage');
                expect('document type', declaration?.document?.type, 'coffee-pub-artificer.recipe');
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
            group: 'Exploratory -- unread code path on both sides',
            note: 'Neither we nor Blacksmith have read this path for a JournalEntryPage profile specifically. The full returned object is in the row below -- copy it into the report back to Blacksmith rather than summarising it.',
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

                // THE ACTUAL FINDING. `expect` rather than `log` so it survives both
                // runners. "wanted" is deliberately not a real expectation -- there is
                // nothing to compare against yet -- it is a label telling the reader
                // what they are looking at.
                expect('RETURNED SHAPE (copy this to Blacksmith)', result, '(no prior expectation -- this IS the result to read)');
                expect.ok('has a system object', result && typeof result.system === 'object');
                expect.ok('has NO top-level "name" (page name is outside system; not handled by this declaration yet)', !('name' in (result ?? {})));
                expect.ok('has NO container/destination key at the top level (would mean buildDocumentData assumes a destination we have not declared)',
                    !('container' in (result ?? {})) && !('containerName' in (result ?? {})) && !('folder' in (result ?? {})));
            }
        }
    ]
};
