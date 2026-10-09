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
                // promptFields: every id must match a declared field name (so it becomes a
                // constraint) EXCEPT 'specificInstructions', which deliberately names nothing --
                // that is how it stays free-author-text rather than a fixed value.
                const promptFields = declaration?.promptFields ?? [];
                expect.ok('promptFields is a non-empty array', Array.isArray(promptFields) && promptFields.length > 0);
                const promptFieldIds = promptFields.map(f => f.id);
                for (const id of promptFieldIds) {
                    if (id === 'specificInstructions') continue;
                    expect.ok(`promptFields "${id}" matches a declared field name`, Boolean(field(id)));
                }
                // The five item-valued fields must use Blacksmith's drag-and-drop input types
                // ('item' for one, 'items' for a list), never plain text -- a free-text guess at
                // an item name is exactly what the catalog/drag-and-drop exist to prevent.
                const promptField = (id) => promptFields.find(f => f.id === id);
                for (const id of ['resultItemName', 'apparatusName', 'containerName', 'processType']) {
                    expect(`promptFields "${id}" inputType`, promptField(id)?.inputType, 'item');
                }
                expect('promptFields "ingredients" inputType', promptField('ingredients')?.inputType, 'items');
                // skill/skillKit are world-configurable vocabularies with no vocabulary fixed at
                // declaration time -- dynamicOptions, never a static select (which would have to
                // carry `options`) and never plain text (a real downgrade from the sheet's own
                // dropdowns, caught by the author).
                for (const id of ['skill', 'skillKit']) {
                    expect(`promptFields "${id}" inputType`, promptField(id)?.inputType, 'select');
                    expect.ok(`promptFields "${id}" dynamicOptions is true`, promptField(id)?.dynamicOptions === true);
                    expect.ok(`promptFields "${id}" carries no static options`, !('options' in (promptField(id) ?? {})));
                }
                // traits: 'tags' + dynamicOptions, NOT the same contract as skill/skillKit above --
                // a tags field takes the pushed list as suggestions only, never closes to it,
                // matching the sheet's own open-vocabulary picker.
                expect('promptFields "traits" inputType', promptField('traits')?.inputType, 'tags');
                expect.ok('promptFields "traits" dynamicOptions is true', promptField('traits')?.dynamicOptions === true);
                expect('promptFields "traits" group', promptField('traits')?.group, 'Traits');
                // processLevel is always 0-3 regardless of which process is chosen (confirmed
                // earlier against recipeCanCraft/process-definitions.js), so a static select is
                // correct here -- unlike skill/skillKit, this vocabulary never changes.
                // All three numeric-range selects lead with a blank "Not specified" option
                // (2026-10-09, found live): without one, an untouched select's value is the
                // range's own minimum, indistinguishable from the author deliberately choosing
                // it -- confirmed live, every generated recipe got skillLevel 0 / successDC 1
                // regardless of rarity, because the prompt told the generator to honor the
                // author's "selections" exactly and a silent default looked like one.
                expect('promptFields "processLevel" inputType', promptField('processLevel')?.inputType, 'select');
                expect('promptFields "processLevel" options', (promptField('processLevel')?.options ?? []).map(o => o.value), ['', '0', '1', '2', '3']);
                // skillLevel (0-20) and successDC (1-30) are the same fixed-range pattern as
                // processLevel -- a static select, not dynamicOptions, since the legal range
                // never changes (confirmed against SKILL_LEVEL_MIN/MAX and RecipePageModel's
                // successDC bounds directly).
                expect('promptFields "skillLevel" inputType', promptField('skillLevel')?.inputType, 'select');
                expect.ok('promptFields "skillLevel" options span blank + 0-20',
                    (promptField('skillLevel')?.options ?? []).length === 22
                    && promptField('skillLevel').options[0].value === ''
                    && promptField('skillLevel').options[1].value === '0'
                    && promptField('skillLevel').options[21].value === '20');
                expect('promptFields "successDC" inputType', promptField('successDC')?.inputType, 'select');
                expect.ok('promptFields "successDC" options span blank + 1-30',
                    (promptField('successDC')?.options ?? []).length === 31
                    && promptField('successDC').options[0].value === ''
                    && promptField('successDC').options[1].value === '1'
                    && promptField('successDC').options[30].value === '30');
                // type/category/rarity (2026-10-09): added AS promptFields specifically so
                // Blacksmith's `fills` can target them -- `resultItemName` fills them from the
                // dropped item, editable after. Neither is authored from scratch by the
                // generator; both stay plain `text` (no fixed vocabulary for either), rarity
                // stays the one real `select` among the three (it IS a fixed, model-enforced
                // vocabulary, unlike the other two).
                const resultItemFills = promptField('resultItemName')?.fills ?? [];
                expect.ok('promptFields "resultItemName" carries fills', Array.isArray(resultItemFills) && resultItemFills.length > 0);
                const fillTargets = resultItemFills.map(f => f.field);
                for (const id of ['type', 'category', 'rarity', 'traits']) {
                    expect.ok(`resultItemName fills targets "${id}"`, fillTargets.includes(id));
                }
                const fillFor = (id) => resultItemFills.find(f => f.field === id);
                // category: ordered fallback list (Blacksmith added multi-path `from` support
                // 2026-10-09 specifically for this), matching the sheet's own reader exactly.
                expect.ok('fills "category" from is the 3-path fallback list',
                    Array.isArray(fillFor('category')?.from)
                    && fillFor('category').from.join('|') === 'system.type.value|system.type.subtype|system.consumableType');
                // rarity: dnd5e's raw `veryRare` -> our model's `'very rare'` (confirmed against
                // dnd5e 5.3.3 source, not guessed) -- the one fill that needs a map, since rarity
                // is the one of the four still `choices`-constrained on our model.
                expect('fills "rarity" map translates veryRare', fillFor('rarity')?.map?.veryRare, 'very rare');
                expect('promptFields "type" inputType', promptField('type')?.inputType, 'text');
                expect('promptFields "category" inputType', promptField('category')?.inputType, 'text');
                expect('promptFields "rarity" inputType', promptField('rarity')?.inputType, 'select');
                expect.ok('promptFields "rarity" options match RECIPE_RARITIES',
                    (promptField('rarity')?.options ?? []).length === 5);
            }
        },
        {
            id: 'values-correct-for-dynamic-fields',
            label: 'processType, skill, type and category carry no fixed values list; rarity does',
            tier: 'headless',
            group: 'Registration',
            note: 'processType/skill are runtime-configurable; a values list here would reject legitimate recipes in a world whose processes or skills differ from ours. type/category are DERIVED (set from the dropped Result item\'s own dnd5e document type/subtype, never authored) as of 2026-10-09 -- they lost the old ITEM_TYPES-based values list on purpose, not by accident. rarity is still a real, author-filled, genuinely fixed vocabulary.',
            run: async ({ expect }) => {
                const importer = blacksmithApi()?.importer;
                const declaration = importer?.getDeclaration?.(PROFILE_KIND, PROFILE_ID);
                const field = (name) => declaration?.fields?.find(f => f.name === name);
                expect.ok('processType has no values list', !field('processType')?.values);
                expect.ok('skill has no values list', !field('skill')?.values);
                expect.ok('type has no values list (derived, not a vocabulary this module owns)', !field('type')?.values);
                expect.ok('category has no values list (derived, same as type)', !field('category')?.values);
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
