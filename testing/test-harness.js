// ==================================================================
// ===== ARTIFICER TEST HARNESS (testing/test-harness.js) ===========
// ==================================================================
// Paste this entire file into a Foundry SCRIPT MACRO and run it as GM. It
// loads the suites listed in SUITES below and opens a dialog that stays open,
// so you can fire check after check.
//
// WHY THIS EXISTS. Artificer has no test framework -- it is a plain no-build
// Foundry module. Before this, verifying anything meant reading the console
// while it scrolled, and most of what we needed to check reports nothing at
// all: a field group that failed to register, a gate that can never fire, a
// cache that says it holds 668 items and returns none. Those look exactly like
// working code from the console.
//
// TWO TIERS
//   headless    -- contract assertions, self-reporting PASS/FAIL, no
//                  interaction. "Run All Headless" runs every one across every
//                  suite and prints a single summary.
//   interactive -- checks only a person can judge (does the shimmer read as
//                  deliberate, did the craft animate). One button each.
//
// ADDING A SUITE
//   1. Write testing/suites/suite-<name>.js exporting the shape documented in
//      testing/harness-lib.js.
//   2. Add its path to SUITES below.
//   An explicit list, not a glob: what runs should be a decision rather than a
//   side effect of what happens to be on disk.
//
//   DO NOT COPY THE CACHE-BUSTER BELOW INTO MODULE CODE. It is correct here,
//   where re-importing a suite is the point, and wrong for anything under
//   scripts/: import() caches by url, but a busted module's own relative
//   imports are NOT busted, so you get a second instance of the module while
//   everything it imports stays shared -- and a suite ends up asserting against
//   private state the module never writes to.
//
// KEEPING IT HONEST
//   A harness asserting a stale contract is worse than no harness, because it
//   manufactures confidence. Update the suite as part of the change that alters
//   what it asserts -- the same rule CLAUDE.md applies to the docs.
// ==================================================================

// harness-lib.js sits at the testing/ root; suites sit one level below it.
const ROOT = '/modules/coffee-pub-artificer/testing';
const BASE = `${ROOT}/suites`;

const SUITES = [
    `${BASE}/suite-importer-field-group.js`,
    `${BASE}/suite-biome-normalization.js`,
    `${BASE}/suite-scene-gather-profile.js`
];

// ------------------------------------------------------------------

// Cache-buster. import() caches by URL, so without this a suite edit does not
// take effect until Foundry is fully restarted -- and the harness silently runs
// the previous version, which is exactly the false confidence it exists to remove.
const VERSION = `?v=${Date.now()}`;

const { createRecorder, display } = await import(`${ROOT}/harness-lib.js${VERSION}`);

const loaded = [];
const loadErrors = [];
for (const path of SUITES) {
    try {
        const module = await import(`${path}${VERSION}`);
        const suite = module.default;
        if (!suite?.id || !Array.isArray(suite.checks)) {
            loadErrors.push(`${path}: not a valid suite (needs id and checks[])`);
            continue;
        }
        loaded.push(suite);
    } catch (error) {
        loadErrors.push(`${path}: ${error.message}`);
    }
}

if (loadErrors.length) {
    console.error('ARTIFICER HARNESS | suite load failures:\n  ' + loadErrors.join('\n  '));
    ui.notifications.error(`${loadErrors.length} test suite(s) failed to load — see console (F12).`);
}
if (!loaded.length) {
    ui.notifications.error('No test suites loaded. Nothing to run.');
    return;
}

const esc = (value) => foundry.utils.escapeHTML(String(value ?? ''));
const api = game.modules.get('coffee-pub-artificer')?.api ?? null;

const makeLogger = (prefix) => (message) => console.log(`ARTIFICER HARNESS | ${prefix} | ${message}`);

/** Run one check, returning its assertion results. A throw is a failed result
 *  rather than an aborted run: one broken check must not hide the others. */
async function runCheck(suite, check) {
    const { results, expect } = createRecorder();
    try {
        await check.run({ api, expect, log: makeLogger(`${suite.id}/${check.id}`), game });
    } catch (error) {
        results.push({
            label: `${check.label} — threw: ${error.message}`,
            pass: false,
            actual: String(error),
            expected: 'no exception'
        });
    }
    return results.map(r => ({ ...r, suite: suite.id, check: check.id }));
}

// ------------------------------------------------------------------
// STYLING
//
// Injected into <head>, not into the dialog content. DialogV2 sanitises string
// content with cleanHTML, which drops inline `style` attributes and is entitled
// to drop a <style> element -- and passing the content as a DOM element instead
// runs into "config.content element must have no attributes". A head-injected
// sheet sidesteps both. Classes and data-* attributes DO survive, which is why
// everything below hooks on classes.
// ------------------------------------------------------------------
const STYLE_ID = 'artificer-harness-style';
const STYLE_CSS = `
.ah-root { font-size: 13px; display: flex; flex-direction: column; max-height: 72vh; }
.ah-head { flex: 0 0 auto; margin-bottom: 8px; }
.ah-body { flex: 1 1 auto; min-height: 0; overflow: auto; }
.ah-intro { font-size: 0.85em; opacity: 0.65; margin: 0 0 6px; }
.ah-suite-title { margin: 0 0 6px; font-size: 1em; }
.ah-settings { width: 100%; font-size: 0.85em; margin-bottom: 8px; }
.ah-settings td { padding: 1px 4px; }
.ah-settings td:first-child { opacity: 0.6; white-space: nowrap; }
.ah-group { margin: 12px 0 4px; opacity: 0.55; text-transform: uppercase;
            font-size: 0.72em; letter-spacing: 0.06em; }
.ah-check { margin-bottom: 8px; }
.ah-check button { width: 100%; text-align: left; }
.ah-note { margin: 2px 0 0; font-size: 0.75em; opacity: 0.55; font-style: italic; }
.ah-results { margin-top: 10px; }
.ah-results table { width: 100%; font-size: 0.85em; border-collapse: collapse; }
.ah-results td { padding: 2px 6px; vertical-align: top; }
.ah-verdict { white-space: nowrap; font-weight: bold; }
.ah-pass .ah-verdict { color: #4caf50; }
.ah-fail .ah-verdict { color: #e05a5a; }
.ah-detail { opacity: 0.75; font-size: 0.92em; }
`;

function installStyle() {
    removeStyle();
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_CSS;
    document.head.appendChild(style);
}
function removeStyle() {
    document.getElementById(STYLE_ID)?.remove();
}

// ------------------------------------------------------------------

function renderResults(results) {
    if (!results.length) return '<p class="ah-note">No assertions recorded.</p>';
    const rows = results.map(r => `
        <tr class="${r.pass ? 'ah-pass' : 'ah-fail'}">
            <td class="ah-verdict">${r.pass ? 'PASS' : 'FAIL'}</td>
            <td>${esc(r.label)}</td>
            <td class="ah-detail">${r.pass ? '' : `got <code>${esc(display(r.actual))}</code>, wanted <code>${esc(display(r.expected))}</code>`}</td>
        </tr>`).join('');
    return `<table><tbody>${rows}</tbody></table>`;
}

function suiteHtml(suite) {
    const settings = typeof suite.settings === 'function' ? suite.settings() : [];
    const settingsHtml = settings.length ? `
        <table class="ah-settings">
            ${settings.map(s => `<tr><td>${esc(s.label)}</td><td><code>${esc(s.value)}</code></td></tr>`).join('')}
        </table>` : '';

    let lastGroup = null;
    const buttons = suite.checks.map(check => {
        // The heading is emitted whenever `group` CHANGES going down the list, so
        // declaration order is preserved rather than bucketed.
        const heading = check.group && check.group !== lastGroup
            ? `<h4 class="ah-group">${esc(check.group)}</h4>` : '';
        lastGroup = check.group ?? lastGroup;
        // The note sits OUTSIDE the button: a note inside one stretches it and
        // collides with the row below.
        return `${heading}
            <div class="ah-check">
                <button type="button" data-suite="${esc(suite.id)}" data-check="${esc(check.id)}">
                    ${check.tier === 'interactive' ? '<i class="fa-solid fa-hand-pointer"></i> ' : ''}${esc(check.label)}
                </button>
                ${check.note ? `<p class="ah-note">${esc(check.note)}</p>` : ''}
            </div>`;
    }).join('');

    return `<section>
        <h3 class="ah-suite-title">${suite.icon ? `<i class="${esc(suite.icon)}"></i> ` : ''}${esc(suite.label)}</h3>
        ${settingsHtml}${buttons}
    </section>`;
}

const totalHeadless = loaded.reduce((sum, s) => sum + s.checks.filter(c => c.tier !== 'interactive').length, 0);

const content = `
    <div class="ah-root">
        <div class="ah-head">
            <p class="ah-intro">
                Results appear below and in the console (F12). The dialog stays open — run as many checks as you like.
            </p>
            <button type="button" data-run-all>
                Run All Headless (${totalHeadless} check${totalHeadless === 1 ? '' : 's'}, ${loaded.length} suite${loaded.length === 1 ? '' : 's'})
            </button>
        </div>
        <div class="ah-body">
            ${loaded.map(suiteHtml).join('<hr>')}
            <div class="ah-results" data-results></div>
        </div>
    </div>`;

installStyle();

// `DialogV2.wait`, not `new DialogV2().render(true)`. The config `render`
// callback is what wires every button, and going through wait() is the path
// that reliably invokes it.
await foundry.applications.api.DialogV2.wait({
    window: { title: 'Artificer Test Harness', resizable: true },
    position: { width: 720, height: 'auto' },
    modal: false,
    rejectClose: false,
    content,
    buttons: [{ action: 'close', label: 'Close', default: true }],
    close: () => removeStyle(),
    render: (_event, dialog) => {
        const root = dialog?.element ?? dialog;
        const output = root.querySelector('[data-results]');

        const show = (title, results) => {
            const failed = results.filter(r => !r.pass).length;
            output.innerHTML = `
                <h4>${esc(title)} — ${results.length - failed} passed, ${failed} failed</h4>
                ${renderResults(results)}`;

            // ONE PLAIN-TEXT BLOCK, then the objects. A console.log of an array
            // renders as a collapsible object that cannot be selected and copied --
            // which is useless for pasting a failure into a bug report or handing it
            // to another session. The text block below is the copyable artifact; the
            // array after it is for expanding a value in place.
            const header = `ARTIFICER HARNESS | ${title}: ${results.length - failed} passed, ${failed} failed`;
            const lines = results.map(r => r.pass
                ? `  PASS  ${r.label}`
                : `  FAIL  ${r.label}
          got:    ${display(r.actual)}
          wanted: ${display(r.expected)}`);
            console.log([header, ...lines].join('\n'));
            if (failed) console.warn(`${failed} failed — see the block above to copy.`);
            console.log('Result objects:', results);
        };

        root.querySelector('[data-run-all]')?.addEventListener('click', async () => {
            output.innerHTML = '<p>Running…</p>';
            const all = [];
            for (const suite of loaded) {
                for (const check of suite.checks.filter(c => c.tier !== 'interactive')) {
                    all.push(...await runCheck(suite, check));
                }
            }
            show('All headless checks', all);
        });

        root.querySelectorAll('button[data-check]').forEach((button) => {
            button.addEventListener('click', async () => {
                const suite = loaded.find(s => s.id === button.dataset.suite);
                const check = suite?.checks.find(c => c.id === button.dataset.check);
                if (!check) return;
                output.innerHTML = '<p>Running…</p>';
                show(check.label, await runCheck(suite, check));
            });
        });
    }
});
