// ==================================================================
// ===== HEADLESS HARNESS RUNNER (testing/run-headless.js) ==========
// ==================================================================
// Runs every headless check and returns the results. NO DIALOG, NO CLICKING.
//
// From the browser console (F12), as GM:
//
//   const { runHeadless } = await import('/modules/coffee-pub-artificer/testing/run-headless.js');
//   await runHeadless();
//
// It prints a copyable plain-text block and returns `{passed, failed, results}`
// so a caller can assert on it.
//
// WHY THIS EXISTS, and it is not convenience. `test-harness.js` is a macro body
// that builds its dialog inline and exposes no entry point, so the only way to run
// it was for a person to paste a file into a Script macro and click a button. That
// makes the harness unrunnable by anyone automating a migration -- which is exactly
// when you most want it. Foundry's v14 migration surfaced this: the session driving
// the live client could not run our suites at all, and a synthesised dialog click
// would have produced worse data than none. Reported by coffee-pub-blacksmith on
// 2026-09-09; the argument is theirs.
//
// THE SUITE LIST IS DUPLICATED FROM test-harness.js, ON PURPOSE. Importing it would
// mean importing the macro body, which runs the whole dialog as a side effect. The
// duplication is two lines and visible; the alternative is a runner that opens a
// window nobody asked for. If you add a suite, add it in both places -- there is a
// harness check asserting the two lists agree, so forgetting is caught rather than
// silently running fewer tests than you think.
// ==================================================================

const ROOT = '/modules/coffee-pub-artificer/testing';

/** The suites to run. Keep in step with SUITES in test-harness.js. */
export const SUITE_FILES = [
    'suite-importer-field-group',
    'suite-biome-normalization',
    'suite-scene-gather-profile',
    'suite-harness-integrity'
];

/**
 * Run every headless check across every suite.
 *
 * @param {object} [options]
 * @param {boolean} [options.quiet] Suppress the console block; just return results.
 * @returns {Promise<{passed: number, failed: number, results: object[], text: string}>}
 */
export async function runHeadless({ quiet = false } = {}) {
    // Cache-buster, same reasoning as the macro: import() caches by URL, so without
    // it a suite edit does not take effect until Foundry restarts -- and the runner
    // silently tests the previous version, which is the false confidence a harness
    // exists to remove.
    const version = `?v=${Date.now()}`;
    const { createRecorder, display } = await import(`${ROOT}/harness-lib.js${version}`);
    const api = game.modules.get('coffee-pub-artificer')?.api ?? null;

    const results = [];
    for (const file of SUITE_FILES) {
        let suite;
        try {
            suite = (await import(`${ROOT}/suites/${file}.js${version}`)).default;
        } catch (error) {
            // A suite that fails to LOAD must be a visible failure, not a silent
            // reduction in coverage.
            results.push({
                suite: file, check: '(load)',
                label: `${file} failed to load: ${error.message}`,
                pass: false, actual: String(error), expected: 'suite loads'
            });
            continue;
        }
        for (const check of suite.checks.filter((c) => c.tier !== 'interactive')) {
            const { results: recorded, expect } = createRecorder();
            try {
                await check.run({ api, expect, log: () => {}, game });
            } catch (error) {
                recorded.push({
                    label: `${check.label} — threw: ${error.message}`,
                    pass: false, actual: String(error), expected: 'no exception'
                });
            }
            for (const r of recorded) results.push({ ...r, suite: suite.id, check: check.id });
        }
    }

    const failed = results.filter((r) => !r.pass).length;
    const passed = results.length - failed;

    // One plain-text block. A console.log of an array renders as a collapsible object
    // that cannot be selected and copied, which is useless for pasting a failure into
    // a report or handing it to another session.
    const lines = results.map((r) => (r.pass
        ? `  PASS  ${r.label}`
        : `  FAIL  ${r.label}\n          got:    ${display(r.actual)}\n          wanted: ${display(r.expected)}`));
    const text = [`ARTIFICER HARNESS: ${passed} passed, ${failed} failed`, ...lines].join('\n');

    if (!quiet) {
        console.log(text);
        if (failed) console.warn(`${failed} failed — copy the block above.`);
    }
    return { passed, failed, results, text };
}
