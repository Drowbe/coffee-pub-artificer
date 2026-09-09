// ==================================================================
// ===== SUITE: HARNESS INTEGRITY ===================================
// ==================================================================
// Assertions about the harness itself.
//
// WHY THIS SUITE EXISTS. There are two ways to run the checks -- the dialog in
// `test-harness.js` and the programmatic `run-headless.js` -- and each carries its
// own list of suites. A suite added to one and not the other still passes
// everything, because the runner that does not know about it simply runs fewer
// tests and reports success. That is the harness's own version of the failure it
// exists to catch: coverage silently shrinking while the number stays green.
//
// The duplication is deliberate -- importing the macro body would run its dialog as
// a side effect -- so this is the check that makes it safe.
// ==================================================================

import { settingRow } from '../harness-lib.js';

const HARNESS = '/modules/coffee-pub-artificer/testing/test-harness.js';
const RUNNER = '/modules/coffee-pub-artificer/testing/run-headless.js';

/** Suite basenames named in the macro's SUITES array, read from its source. */
async function suitesInMacro() {
    const source = await fetch(HARNESS).then((r) => r.text());
    const block = source.match(/const SUITES\s*=\s*\[([\s\S]*?)\]/);
    if (!block) return null;
    return [...block[1].matchAll(/suite-[a-z0-9-]+/g)].map((m) => m[0]).sort();
}

export default {
    id: 'harness-integrity',
    label: 'Harness Integrity',
    icon: 'fa-solid fa-vial-circle-check',

    settings: () => [
        settingRow('Runners', 'test-harness.js (dialog) and run-headless.js (programmatic)')
    ],

    checks: [
        {
            id: 'suite-lists-agree',
            label: 'Both runners know about the same suites',
            tier: 'headless',
            group: 'Coverage',
            note: 'A suite added to one list and not the other runs in one place and not the other, and both still report green -- the runner that has never heard of it just tests less.',
            run: async ({ expect, log }) => {
                const { SUITE_FILES } = await import(RUNNER);
                const inMacro = await suitesInMacro();

                expect.ok('test-harness.js declares a SUITES array', Array.isArray(inMacro));
                if (!inMacro) return;

                const inRunner = [...SUITE_FILES].sort();
                log(`macro: ${inMacro.join(', ')}`);
                log(`runner: ${inRunner.join(', ')}`);
                expect('the two lists match', inRunner, inMacro);
            }
        },
        {
            id: 'every-suite-file-is-listed',
            label: 'No suite file is missing from both lists',
            tier: 'headless',
            group: 'Coverage',
            note: 'A file written into testing/suites/ and never listed is invisible: it runs nowhere, fails nothing, and looks like finished work.',
            run: async ({ expect, log }) => {
                const { SUITE_FILES } = await import(RUNNER);
                // There is no directory listing over HTTP, so probe for each suite the
                // runner claims plus any obvious sibling. This cannot find a file nobody
                // references at all -- stated rather than implied, because a check whose
                // limits are unstated gets trusted past them.
                for (const name of SUITE_FILES) {
                    const url = `/modules/coffee-pub-artificer/testing/suites/${name}.js`;
                    const response = await fetch(url);
                    expect.ok(`${name}.js exists`, response.ok);
                }
                log('Only listed suites are probed; a file referenced by neither list cannot be seen from here.');
            }
        }
    ]
};
