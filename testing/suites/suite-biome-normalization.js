// ==================================================================
// ===== SUITE: BIOME NORMALIZATION =================================
// ==================================================================
// Habitat is a JOIN KEY. Scene habitats are matched against item biome flags, and
// the two sides are written by different paths at different times -- so a
// case-sensitive comparison between them is a silent, partial failure rather than
// a loud one.
//
// WHY THIS SUITE EXISTS. Every failure in this area reports nothing. A broken join
// does not throw and does not return empty: an item with no biomes stays eligible
// everywhere, so gather keeps returning a plausible, wrong subset. A broken read on
// the item sheet renders every habitat button off, and only the Component-requires-
// habitat rule turns that into a visible refusal instead of an empty write. None of
// it looks like a bug from the console.
//
// These assertions are what makes the vocabulary safe to move to Blacksmith's
// lowercase constant: they pass identically whichever case the vocabulary uses.
// ==================================================================

import { settingRow } from '../harness-lib.js';

const SCHEMA = '/modules/coffee-pub-artificer/scripts/schema-ingredients.js';
const GATHER = '/modules/coffee-pub-artificer/scripts/manager-gather.js';

/** The vocabulary and its helpers, imported fresh. */
async function schema() {
    return import(SCHEMA);
}

/** A biome that exists, in the vocabulary's own spelling. */
async function sample() {
    const { getBiomeKeys } = await schema();
    return getBiomeKeys()[0] ?? null;
}

/** The same biome with its case inverted -- the shape stored data will be in. */
function flipCase(value) {
    return value === value.toUpperCase() ? value.toLowerCase() : value.toUpperCase();
}

export default {
    id: 'biome-normalization',
    label: 'Biome Normalization',
    icon: 'fa-solid fa-mountain-sun',

    settings: () => {
        const theirs = game.modules.get('coffee-pub-blacksmith')?.api?.geography?.HABITATS;
        const live = Array.isArray(theirs);
        return [
            settingRow('Vocabulary source', live ? 'Blacksmith api.geography.HABITATS' : 'ARTIFICER FALLBACK'),
            settingRow('Entries', live ? theirs.length : 12),
            settingRow('Canonical case', live ? 'lowercase (theirs)' : 'uppercase (fallback)')
        ];
    },

    checks: [
        // ---- The helpers -------------------------------------------------
        {
            id: 'normalize-is-case-insensitive',
            label: 'normalizeBiome accepts any case and returns the canonical spelling',
            tier: 'headless',
            group: 'Helpers',
            note: 'One place decides case. When the vocabulary flips to lowercase, this is the only thing that has to still be true.',
            run: async ({ expect }) => {
                const { getBiomeKeys, normalizeBiome } = await schema();
                for (const biome of getBiomeKeys()) {
                    expect(`${biome} round-trips`, normalizeBiome(biome), biome);
                    expect(`${flipCase(biome)} normalizes to ${biome}`, normalizeBiome(flipCase(biome)), biome);
                }
                const first = getBiomeKeys()[0];
                expect('surrounding whitespace is tolerated', normalizeBiome(`  ${first}  `), first);
            }
        },
        {
            id: 'normalize-rejects-unknown',
            label: 'An unknown biome resolves to null, never to a plausible value',
            tier: 'headless',
            group: 'Helpers',
            note: 'Never invent a value you cannot resolve. A fallback shown as a habitat would be a lie about where something can be found.',
            run: async ({ expect }) => {
                const { normalizeBiome, isOfficialBiome } = await schema();
                for (const bad of ['FEYWILD', '', '   ', null, undefined, 42, {}, []]) {
                    expect(`${JSON.stringify(bad)} -> null`, normalizeBiome(bad), null);
                }
                expect.ok('isOfficialBiome agrees', !isOfficialBiome('FEYWILD'));
            }
        },
        {
            id: 'normalize-list-dedupes',
            label: 'Two spellings of one biome collapse to one entry',
            tier: 'headless',
            group: 'Helpers',
            note: 'Otherwise normalizing turns MOUNTAIN + mountain into a duplicate rather than a single habitat.',
            run: async ({ expect }) => {
                const { normalizeBiomeList } = await schema();
                const one = await sample();
                expect('both spellings collapse', normalizeBiomeList([one, flipCase(one)]), [one]);
                expect('unknowns are dropped', normalizeBiomeList([one, 'FEYWILD']), [one]);
                expect('a non-array is empty', normalizeBiomeList('FOREST'), []);
            }
        },

        // ---- Vocabulary ownership ----------------------------------------
        {
            id: 'vocabulary-comes-from-blacksmith',
            label: 'The vocabulary resolves from Blacksmith, not our fallback',
            tier: 'headless',
            group: 'Vocabulary',
            note: 'The fallback exists only for a Blacksmith too old to have api.geography. If this fails while Blacksmith is current, we are silently running on our own copy in the wrong case.',
            run: async ({ expect }) => {
                const { getBiomeVocabulary, getBiomeKeys } = await schema();
                const theirs = game.modules.get('coffee-pub-blacksmith')?.api?.geography?.HABITATS;
                expect.ok('api.geography.HABITATS is available', Array.isArray(theirs));
                if (!Array.isArray(theirs)) return;
                expect('we resolve to their exact array', getBiomeVocabulary(), theirs);
                expect('twelve environments', getBiomeKeys().length, 12);
                expect.ok('their keys are lowercase', getBiomeKeys().every(k => k === k.toLowerCase()));
            }
        },
        {
            id: 'labels-are-distinct-from-keys',
            label: 'Every entry carries a label, and it is not the raw key',
            tier: 'headless',
            group: 'Vocabulary',
            note: 'data-biome round-trips the key; the button text shows the label. Fusing them is what would have shown a GM "underdark".',
            run: async ({ expect }) => {
                const { getBiomeVocabulary, getBiomeLabel } = await schema();
                const vocab = getBiomeVocabulary();
                expect.ok('every entry has key and label',
                    vocab.every(e => typeof e.key === 'string' && typeof e.label === 'string' && e.label));
                expect.ok('at least one label differs from its key', vocab.some(e => e.label !== e.key));
                expect('getBiomeLabel resolves any case',
                    getBiomeLabel(vocab[0].key.toUpperCase()), vocab[0].label);
                expect('an unknown key has no label', getBiomeLabel('FEYWILD'), null);
            }
        },
        {
            id: 'declaration-uses-live-vocabulary',
            label: 'The registered field group carries the live vocabulary, not the fallback',
            tier: 'headless',
            group: 'Vocabulary',
            note: 'The trap this refactor exists for: an object literal built at module scope captures the fallback, registers cleanly, and then rejects legitimate content with nothing in the console.',
            run: async ({ expect }) => {
                const { getBiomeKeys } = await schema();
                const importer = game.modules.get('coffee-pub-blacksmith')?.api?.importer;
                const group = importer?.listFieldGroups?.().find(g => g.module === 'coffee-pub-artificer');
                expect.ok('the group is registered', Boolean(group));
                const field = group?.fields?.find(f => f.name === 'artificerBiomes');
                expect.ok('artificerBiomes is declared', Boolean(field));
                expect('its values match the live vocabulary', field?.values, getBiomeKeys());
            }
        },

        // ---- The join ----------------------------------------------------
        {
            id: 'join-is-case-insensitive',
            label: 'A mixed-case scene habitat still matches an item biome',
            tier: 'headless',
            group: 'The join',
            note: 'The regression this suite exists for. A broken join does not throw and does not empty -- untagged components keep coming back, so it looks like it works.',
            run: async ({ expect, log }) => {
                const { getEligibleGatherRecords } = await import(GATHER);
                const { getBiomeKeys } = await schema();

                // Find a real biome/family pair that yields records, so the assertion
                // compares two live results rather than two empty ones.
                let found = null;
                for (const biome of getBiomeKeys()) {
                    for (const family of ['Plant', 'Mineral', 'Gem', 'CreaturePart', 'Environmental', 'Essence']) {
                        const hits = getEligibleGatherRecords([biome], [family]);
                        if (hits.some(r => (r.biomes ?? []).length)) {
                            found = { biome, family, count: hits.length };
                            break;
                        }
                    }
                    if (found) break;
                }
                if (!found) {
                    log('No biome-tagged components in the cache; cannot exercise the join. Rebuild the item cache and re-run.');
                    expect.ok('a biome-tagged component exists to test with', false);
                    return;
                }

                log(`Testing ${found.biome} / ${found.family} (${found.count} records)`);
                const canonical = getEligibleGatherRecords([found.biome], [found.family]);
                const flipped = getEligibleGatherRecords([flipCase(found.biome)], [found.family]);
                expect('flipped case returns the same count', flipped.length, canonical.length);
                expect('flipped case returns the same items',
                    flipped.map(r => r.uuid).sort(), canonical.map(r => r.uuid).sort());
            }
        },

        // ---- Checkbox nulls ----------------------------------------------
        {
            id: 'checkbox-nulls-are-not-values',
            label: 'A checkbox group submitting all-null does not read as configured',
            tier: 'headless',
            group: 'Checkbox nulls',
            note: 'FormDataExtended yields `checked ? value : null` per box, so twelve unticked boxes submit twelve nulls. Stringifying them produces twelve literal "null" strings -- a flag that reads as populated and matches nothing.',
            run: async ({ expect }) => {
                const { normalizeCheckboxList } = await import('/modules/coffee-pub-artificer/scripts/utils/helpers.js');
                const { normalizeBiomeList } = await schema();
                const allNull = Array(12).fill(null);
                expect('twelve nulls normalize to empty', normalizeCheckboxList(allNull), []);
                expect('and through the vocabulary too', normalizeBiomeList(normalizeCheckboxList(allNull)), []);
                // The single-box case takes a different path in Foundry -- namedItem
                // returns the element, not a list -- so it must be covered separately.
                expect('a scalar null is empty', normalizeCheckboxList(null), []);
                // A partially ticked group is the realistic case: real values survive,
                // the nulls beside them do not.
                const one = await sample();
                expect('mixed nulls and values keep only the values',
                    normalizeCheckboxList([null, one, null]), [one]);
                expect('the literal string "null" is still rejected by the vocabulary',
                    normalizeBiomeList(['null', 'null']), []);
            }
        },

        // ---- The item sheet ----------------------------------------------
        {
            id: 'sheet-renders-stored-case',
            label: 'A component stored in another case still renders its habitats selected',
            tier: 'headless',
            group: 'Item sheet',
            note: 'If this fails, every affected component opens with all buttons off and cannot be saved -- the habitat rule rejects the empty set it just produced.',
            run: async ({ expect }) => {
                const { normalizeBiomeList } = await schema();
                const one = await sample();
                // The sheet's render path reduces to exactly this: stored values in,
                // canonical set out, membership tested against the vocabulary.
                const selectedSet = new Set(normalizeBiomeList([flipCase(one)]));
                expect.ok(`${one} renders selected from stored ${flipCase(one)}`, selectedSet.has(one));
                expect.ok('and the hidden field is not empty', normalizeBiomeList([flipCase(one)]).length === 1);
            }
        },

        // ---- Habitat ownership -------------------------------------------
        {
            id: 'habitat-comes-from-blacksmith',
            label: 'Scene habitat is read from Blacksmith, not our legacy flag',
            tier: 'headless',
            group: 'Habitat ownership',
            note: 'The tell that distinguishes a live read from a stale one: their keys are LOWERCASE and in vocabulary order. Uppercase or alphabetical means our own flag answered.',
            run: async ({ expect, log }) => {
                const geography = game.modules.get('coffee-pub-blacksmith')?.api?.geography;
                expect.ok('api.geography.getHabitats is available', typeof geography?.getHabitats === 'function');
                if (typeof geography?.getHabitats !== 'function') return;

                const { getSceneHabitats } = await import('/modules/coffee-pub-artificer/scripts/utils/helpers.js');
                const { getBiomeKeys } = await schema();
                const order = getBiomeKeys();

                const scene = [...(game.scenes ?? [])].find(s => getSceneHabitats(s).length) ?? null;
                if (!scene) {
                    log('No scene carries habitats. Set some on the Geography tab of a scene and re-run.');
                    expect.ok('a scene with habitats exists to test with', false);
                    return;
                }
                const habitats = getSceneHabitats(scene);
                log(`${scene.name}: ${habitats.join(', ')}`);

                expect('we agree with Blacksmith exactly', habitats, geography.getHabitats(scene));
                expect.ok('every value is lowercase', habitats.every(h => h === h.toLowerCase()));
                expect.ok('every value is in the vocabulary', habitats.every(h => order.includes(h)));
                // Vocabulary order, not alphabetical. A stale reader would return the
                // stored order or a sorted one; only their reader returns this.
                const asDeclared = order.filter(k => habitats.includes(k));
                expect('returned in vocabulary order', habitats, asDeclared);
            }
        },
        {
            id: 'legacy-flag-is-not-read',
            label: 'Nothing reads the legacy habitats flag any more',
            tier: 'headless',
            group: 'Habitat ownership',
            note: 'Blacksmith left our key in place on purpose -- deleting is irreversible. That makes this assertion the thing keeping it inert: a stale key something still reads is worse than a deleted one, because it looks live.',
            run: async ({ expect }) => {
                // Read our own source and assert the absence, because "we removed the
                // reads" is exactly the kind of claim that rots on the next edit.
                const files = [
                    'scripts/manager-scene.js',
                    'scripts/manager-gather.js',
                    'scripts/manager-gathering-images.js'
                ];
                for (const file of files) {
                    const source = await fetch(`/modules/coffee-pub-artificer/${file}`).then(r => r.text());
                    // Strip comments: the accessor documents the legacy path by name, and
                    // an assertion that cannot tell prose from code would forbid saying so.
                    const code = source
                        .replace(/\/\*[\s\S]*?\*\//g, '')
                        .replace(/^\s*\/\/.*$/gm, '');
                    expect.ok(`${file} does not read .habitats`, !/\.habitats/.test(code));
                }
            }
        },

        // ---- Interactive --------------------------------------------------
        {
            id: 'edit-an-uppercase-component',
            label: 'Open a biome-tagged component and save it unchanged',
            tier: 'interactive',
            group: 'By hand',
            note: 'Habitats should render selected, and Save should succeed without asking you to choose a habitat. The soft lock, if it comes back, shows up exactly here.',
            run: async ({ log }) => {
                const { getEligibleGatherRecords } = await import(GATHER);
                const { getBiomeKeys } = await schema();
                for (const biome of getBiomeKeys()) {
                    const hit = getEligibleGatherRecords([biome], ['Plant', 'Mineral', 'Gem', 'CreaturePart', 'Environmental', 'Essence'])
                        .find(r => (r.biomes ?? []).length);
                    if (!hit) continue;
                    const item = await fromUuid(hit.uuid);
                    item?.sheet?.render(true);
                    log(`Opened ${hit.name} (${hit.biomes.join(', ')}). Check the habitat buttons, then Save.`);
                    return;
                }
                log('No biome-tagged component found in the cache to open.');
            }
        }
    ]
};
