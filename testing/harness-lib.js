// ==================================================================
// ===== TEST HARNESS LIB (testing/harness-lib.js) ==================
// ==================================================================
//
// DO NOT PASTE THIS INTO A FOUNDRY MACRO. It is an ES module, so a macro
// rejects it with "must be valid JavaScript for an asynchronous scope:
// Unexpected token 'export'". The only file here that goes in a macro is
// testing/test-harness.js, which import()s this one and every suite.
//
// Shared helpers for Artificer test suites. Same conventions as Blacksmith's
// harness, deliberately -- someone who has used one should recognise the other.
//
// TWO TIERS
//   headless    -- contract assertions that self-report PASS/FAIL with no
//                  interaction. This is the tier that catches a regression six
//                  months from now, and the tier "Run All Headless" executes.
//   interactive -- checks needing a person: to JUDGE a result (does the shimmer
//                  read as deliberate) or to choose the MOMENT (start a craft,
//                  then look). One button each; the harness stays open.
//
// A suite module default-exports:
//
//   {
//       id, label,
//       icon,                                          // optional FA class
//       settings: () => [ { label, value, note } ],     // optional
//       checks: [ {
//           id, label,
//           tier: 'headless' | 'interactive',
//           group,                   // optional sub-heading
//           note,                    // optional, shown under the button
//           run: async (ctx) => {}   // ctx: { api, expect, log, game }
//       } ]
//   }
//
// Register the suite's path in SUITES in testing/test-harness.js.
//
// KEEPING IT HONEST
//   A harness asserting a stale contract is worse than no harness, because it
//   manufactures confidence. Update the suite as part of the change that alters
//   the thing it asserts -- the same rule CLAUDE.md applies to the docs.
// ==================================================================

export const MODULE_ID = 'coffee-pub-artificer';
export const BLACKSMITH_ID = 'coffee-pub-blacksmith';

/** Artificer's API, or a thrown error naming what is missing. */
export function requireApi() {
    const api = game.modules.get(MODULE_ID)?.api;
    if (!api) throw new Error(`${MODULE_ID} api is unavailable -- is the module enabled and Foundry reloaded?`);
    return api;
}

/** Blacksmith's API. Returns null rather than throwing: we are a consumer, and
 *  a check that needs it should say so rather than failing the whole suite. */
export function blacksmithApi() {
    return game.modules.get(BLACKSMITH_ID)?.api ?? null;
}

/** A module setting, with a fallback for one that is not registered yet. */
export function setting(key, fallback = null) {
    try {
        return game.settings.get(MODULE_ID, key);
    } catch (_) {
        return fallback;
    }
}

/** Structural equality, enough for the shapes assertions actually compare. */
export function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (a === null || b === null) return false;
    if (typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every(k => deepEqual(a[k], b[k]));
}

/** A value rendered short enough to sit in a results table. */
export function display(value) {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (typeof value === 'string') return value.length > 80 ? `${value.slice(0, 77)}...` : value;
    if (Array.isArray(value)) return `[${value.length}] ${JSON.stringify(value).slice(0, 70)}`;
    if (typeof value === 'object') return JSON.stringify(value).slice(0, 80);
    return String(value);
}

/**
 * Assertion recorder handed to every check as `expect`.
 *
 * `expect.ok` is for a boolean you already computed; `expect` compares two
 * values and shows both when they differ, which is what makes a failure
 * diagnosable from the results table without opening the console.
 */
export function createRecorder() {
    const results = [];
    const expect = (label, actual, expected) => {
        const pass = deepEqual(actual, expected);
        results.push({ label, pass, actual, expected });
        return pass;
    };
    expect.ok = (label, condition) => {
        const pass = Boolean(condition);
        results.push({ label, pass, actual: condition, expected: true });
        return pass;
    };
    expect.throws = async (label, fn) => {
        let threw = false;
        try {
            await fn();
        } catch (_) {
            threw = true;
        }
        results.push({ label, pass: threw, actual: threw, expected: 'throws' });
        return threw;
    };
    return { results, expect };
}

/**
 * Whether a CSS rule exists by probing a marker custom property.
 *
 * Scanning `document.styleSheets` is unreliable across origins; a probe element
 * asks the cascade the same question the browser answers when rendering.
 * @param {string} className
 * @param {string} property
 * @returns {boolean}
 */
export function cssDeclares(className, property) {
    const probe = document.createElement('div');
    probe.style.display = 'none';
    probe.className = className;
    document.body.appendChild(probe);
    try {
        return getComputedStyle(probe).getPropertyValue(property).trim() !== '';
    } finally {
        probe.remove();
    }
}

/** A settings row for a suite's `settings()`. */
export function settingRow(label, value, note = null) {
    return { label, value: display(value), note };
}

/** Wait for a condition, for interactive checks that must not race a render. */
export async function waitFor(predicate, { timeout = 3000, interval = 50 } = {}) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        if (await predicate()) return true;
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    return false;
}
