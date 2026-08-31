#!/usr/bin/env node
// ==================================================================
// check-imports.mjs
// ==================================================================
// Every named import under scripts/ and testing/ -- static
// `import { a } from './x.js'` and lazy `const { a } = await import('./x.js')`
// alike -- names an export that ./x.js actually has.
//
// Run it with:  node tools/check-imports.mjs
//
// WHY THIS EXISTS. `node --input-type=module --check` is the only static gate
// this repo has, and it PARSES WITHOUT RESOLVING. A symbol renamed or moved
// between files without its `export` leaves every file syntactically valid and
// every check passing, and the failure surfaces only when Foundry loads the
// module -- or, for a lazy import, not even then: a missing name destructures to
// `undefined` and throws when it is finally CALLED, which may be on one branch
// of one window a person has to open.
//
// That is not hypothetical here. Moving the biome vocabulary off a constant
// (`OFFICIAL_BIOMES`) onto accessors (`getBiomeVocabulary`, `getBiomeKeys`,
// `getBiomeLabel`) replaced one exported name with three across six files. Every
// file parsed throughout. Nothing in the repo could have told us whether the
// consumers had been updated correctly.
//
// Adapted from coffee-pub-blacksmith/tools/check-imports.mjs, which is where the
// three non-obvious details below were learned the hard way. Kept in step with
// it by hand; there is no shared tooling between the modules.
//
// Exits non-zero on a violation.
// ==================================================================

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// scripts/ is the module proper; testing/ suites import across into harness-lib
// and into scripts/, which is exactly the boundary a rename breaks silently.
// macros/ is deliberately EXCLUDED: those files are pasted into Foundry script
// macros rather than loaded as modules, so a relative specifier in one would not
// resolve the same way and flagging it would be noise.
const SOURCE_DIRS = ['scripts', 'testing'].map((dir) => resolve(ROOT, dir));

/** Every .js file under a directory, recursively. */
function walk(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
        const path = resolve(dir, name);
        if (statSync(path).isDirectory()) out.push(...walk(path));
        else if (name.endsWith('.js')) out.push(path);
    }
    return out;
}

/**
 * The names a module exports.
 *
 * Leading whitespace is allowed on every form: an indented top-level export is
 * unusual formatting, not invalid JS, and anchoring hard on `^export` reports
 * real exports as missing. A checker that cries wolf is worse than none, because
 * the first thing anyone does is stop believing it.
 *
 * Deliberately syntactic rather than a real parse -- this repo has no build step,
 * and adding a parser dependency to run one check would cost more than it saves.
 * An unrecognised shape makes the check MISS a violation rather than invent one,
 * which is the safe direction for a heuristic.
 */
function exportedNames(source) {
    const names = new Set();
    for (const match of source.matchAll(/^\s*export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/gm)) {
        names.add(match[1]);
    }
    for (const match of source.matchAll(/^\s*export\s+class\s+([A-Za-z0-9_$]+)/gm)) {
        names.add(match[1]);
    }
    for (const match of source.matchAll(/^\s*export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/gm)) {
        names.add(match[1]);
    }
    // `export { a, b as c }` -- the exported name is what follows `as`, or the
    // bare name when there is no rename.
    for (const match of source.matchAll(/^\s*export\s*\{([^}]*)\}/gm)) {
        for (const part of match[1].split(',')) {
            const piece = part.trim();
            if (!piece) continue;
            const renamed = piece.match(/\bas\s+([A-Za-z0-9_$]+)$/);
            names.add(renamed ? renamed[1] : piece.split(/\s+/)[0]);
        }
    }
    return names;
}

/** True when a module re-exports wholesale, which this check cannot follow. */
function hasStarExport(source) {
    return /^\s*export\s+\*/m.test(source);
}

// Both import forms, each reduced to the same pair: the braced name list, and the
// specifier. A default or namespace import names nothing to verify and is skipped
// by requiring the braces.
const PATTERNS = [
    { kind: 'lazily imports',
      re: /const\s*\{([^}]+)\}\s*=\s*await\s+import\(\s*['"]([^'"]+)['"]\s*\)/g },
    { kind: 'imports',
      re: /^\s*import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/gm }
];

const files = SOURCE_DIRS.filter((dir) => existsSync(dir)).flatMap(walk);
const cache = new Map();
const problems = [];
let checked = 0;

for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const { kind, re } of PATTERNS) {
        re.lastIndex = 0;
        for (const match of source.matchAll(re)) {
            const specifier = match[2];
            // Bare and absolute specifiers are not ours to resolve. The
            // `/modules/coffee-pub-blacksmith/api/blacksmith-api.js` bridge is
            // deliberately in this category: it is another module's contract, and
            // checking it here would make our gate fail on their refactor.
            if (!specifier.startsWith('.')) continue;
            // testing/ busts its import cache with `?v=...`; strip it before resolving.
            const target = resolve(dirname(file), specifier.split('?')[0]);
            if (!existsSync(target)) {
                problems.push(`${relative(ROOT, file)}: imports "${specifier}", which does not exist`);
                continue;
            }
            if (!cache.has(target)) cache.set(target, readFileSync(target, 'utf8'));
            const targetSource = cache.get(target);
            if (hasStarExport(targetSource)) continue;     // cannot follow a re-export

            const available = exportedNames(targetSource);
            for (const part of match[1].split(',')) {
                const piece = part.trim();
                if (!piece) continue;
                // THE TWO FORMS RENAME IN OPPOSITE DIRECTIONS, and conflating them
                // reports the local alias as the missing export. A lazy import
                // destructures -- `{ a: b }` takes the export `a`. A static import
                // uses `as` -- `{ a as b }` also takes the export `a`, but the text
                // after the keyword is the LOCAL name, not the wanted one.
                const wanted = (kind === 'imports'
                    ? piece.split(/\s+as\s+/)[0]
                    : piece.split(':')[0]).trim();
                if (!wanted || wanted.startsWith('...')) continue;
                checked++;
                if (!available.has(wanted)) {
                    problems.push(
                        `${relative(ROOT, file)}: ${kind} "${wanted}" from "${specifier}", `
                        + `which does not export it`);
                }
            }
        }
    }
}

if (problems.length) {
    console.error(`check-imports: ${problems.length} problem(s).\n`);
    for (const problem of problems) console.error(`  ${problem}`);
    console.error('\nA static import naming a missing export fails the whole module load. A lazy one');
    console.error('is undefined until it is called, so it throws in Foundry on whichever branch');
    console.error('finally reaches it -- and nowhere earlier.');
    process.exit(1);
}

console.log(`check-imports: ${checked} imported name(s) resolve across ${files.length} file(s).`);
