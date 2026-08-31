#!/usr/bin/env node
// ==================================================================
// check-doc-links.mjs
// ==================================================================
// Every relative markdown link and backticked repo path in documentation/, CLAUDE.md
// and README.md points at a file that exists.
//
// Run it with:  node tools/check-doc-links.mjs
//
// WHY THIS EXISTS. A rename has a PROSE surface, and no tooling sees it.
// `check-imports.mjs` verifies every code reference and is blind to a sentence
// naming a file that moved -- so reorganising documentation/ into subfolders
// silently broke nine references across five files, and nothing reported it.
// The same is true of a symbol rename: `OFFICIAL_BIOMES` became three accessors
// and the docs kept describing the constant, in this repo and in Blacksmith's.
//
// It matters more since the wiki sync: `tools/wiki-sync.mjs` DOWNGRADES a link
// it cannot resolve to plain text rather than failing, which is right for the
// wiki -- no red links -- and means a broken link leaves the repo as quietly
// missing text. This is the check that fails instead.
//
// WHAT IT DELIBERATELY DOES NOT DO. Cross-module paths
// (`coffee-pub-blacksmith/documentation/...`) are reported separately and never
// failed: a sibling module may not be checked out beside us, so "missing" and
// "not present on this machine" are the same measurement. Same reasoning the
// importer session used when they concluded a stale cross-module symbol cannot
// be automated -- true and false positives are indistinguishable.
//
// Exits non-zero on a broken same-repo link.
// ==================================================================

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve, relative, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Every markdown file we check: documentation/ plus the two root docs. */
function sources() {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith('.md')) out.push(path);
    }
  };
  walk(join(ROOT, 'documentation'));
  for (const name of ['CLAUDE.md', 'README.md']) {
    const path = join(ROOT, name);
    if (existsSync(path)) out.push(path);
  }
  // CHANGELOG.md IS DELIBERATELY NOT CHECKED. It names files as they were at the
  // time of the release that mentions them, so a path that no longer resolves is
  // usually CORRECT -- `scripts/ui/panels/` really did exist when that entry was
  // written. "Fixing" those would rewrite shipped history into something that never
  // happened, which is worse than a dead link in a document nobody navigates.
  return out.filter((f) => !EXCLUDED.test(relative(ROOT, f).split(sep).join('/')));
}

// Reference copies of OTHER modules' documentation, kept for comparison. Their code
// paths describe that module's tree, not ours, so every one reads as broken here and
// none of them is. Same measurement problem as a cross-module link.
const EXCLUDED = /^documentation\/Resources\//;

const LINK = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
// A bare path named in backticks -- `documentation/architecture/foo.md` -- is how
// most of our prose references a doc, and it breaks exactly like a link does.
const BACKTICK_PATH = /`((?:documentation|scripts|templates|styles|resources|testing|tools|macros)\/[A-Za-z0-9_./-]+)`/g;

const broken = [];
const crossModule = [];
let checked = 0;

for (const file of sources()) {
  const text = readFileSync(file, 'utf8');
  const from = relative(ROOT, file).replace(/\\/g, '/');

  const candidates = [];
  for (const m of text.matchAll(LINK)) candidates.push({ target: m[2], kind: 'link' });
  for (const m of text.matchAll(BACKTICK_PATH)) candidates.push({ target: m[1], kind: 'path' });

  for (const { target, kind } of candidates) {
    if (/^(https?:|mailto:|#)/i.test(target)) continue;
    const clean = target.split('#')[0].split('?')[0];
    if (!clean) continue;
    // An ILLUSTRATIVE path in a how-to -- `scripts/your-window.js` -- names a file the
    // reader is being told to create, not one that should exist. Matched narrowly on the
    // placeholder prefixes we actually use rather than by excluding the guide wholesale,
    // so a genuinely stale path in the same file is still caught.
    if (/(^|\/)(your|example)-/.test(clean)) continue;
    // Another module's tree. Unresolvable from here in a way that is not a defect.
    if (/coffee-pub-(?!artificer)[a-z]+\//i.test(clean)) { crossModule.push(`${from}: ${clean}`); continue; }

    // A backtick path is repo-relative; a markdown link is relative to its file.
    const base = kind === 'path' ? ROOT : dirname(file);
    checked++;
    if (!existsSync(resolve(base, clean))) {
      broken.push(`${from}: ${kind === 'path' ? 'names' : 'links to'} "${target}", which does not exist`);
    }
  }
}

if (crossModule.length) {
  console.log(`${[...new Set(crossModule)].length} cross-module reference(s), not checked:`);
  for (const c of [...new Set(crossModule)].sort()) console.log('  ' + c);
  console.log('');
}

if (broken.length) {
  console.error(`check-doc-links: ${broken.length} broken reference(s).\n`);
  for (const b of [...new Set(broken)].sort()) console.error('  ' + b);
  console.error('\nNothing else catches these: check-imports verifies code, not prose, and');
  console.error('wiki-sync downgrades an unresolvable link to plain text rather than failing.');
  process.exit(1);
}

console.log(`check-doc-links: ${checked} same-repo reference(s) resolve.`);
