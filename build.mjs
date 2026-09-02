// Coordinator build step: concatenate the five locked modules + shared + main into a
// single self-contained HTML file that runs straight from file:// with no server.
//
//   node build.mjs
//
// Relies on the contract rules: imports only at the top in fixed forms, exports only
// via `export function`, every other top-level name module-prefixed.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { stripComments } from './strip-comments.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));

// Dependency order matters: shared first, main last.
const ORDER = [
  'src/shared.js',
  'src/environment.js',
  'src/pasto.js',
  'src/quay.js',
  'src/kyoto.js',
  'src/cali.js',
  'src/rio.js',
  'src/iceland.js',
  'src/sahara.js',
  'src/drift.js',
  'src/venice.js',
  'src/kowloon.js',
  'src/palawan.js',
  'src/goreme.js',
  'src/manly.js',
  'src/pantanal.js',
  'src/cave.js',
  'src/antarctic.js',
  'src/monaco.js',
  'src/hanoi.js',
  'src/weather.js',
  'src/props.js',
  'src/capybara.js',
  'src/condor.js',
  'src/npc.js',
  'src/systems.js',
  'src/main.js',
];

// `import\b`, AND A SPAN THAT CANNOT CROSS A STATEMENT.
//
// This was `^[ \t]*import[\s\S]*?from...`, which has two holes. Without the
// word boundary, a top-level line beginning `importantThing = ...` matches the
// first six characters; and because `[\s\S]*?` crosses newlines it then runs on
// to the NEXT `from '...'` anywhere below and deletes everything in between —
// silently, from the bundle only, with no build error. A real import list may
// span lines but contains no semicolon until its end, so `[^;]*?` keeps the
// multi-line form working while pinning the match inside one statement.
const IMPORT_RE = /^[ \t]*import\b[^;]*?from\s*['"][^'"]+['"];?[ \t]*\r?\n/gm;
const BARE_IMPORT_RE = /^[ \t]*import\b\s*['"][^'"]+['"];?[ \t]*\r?\n/gm;
const EXPORT_RE = /^[ \t]*export\s+(?=(?:async\s+)?function|const|let|var|class)/gm;

const problems = [];

function strip(file, src) {
  const imports = src.match(IMPORT_RE) || [];
  for (const line of imports) {
    const m = line.match(/from\s*['"]([^'"]+)['"]/);
    const spec = m && m[1];
    if (spec !== 'three' && spec !== 'cannon-es' && !/^\.\/[a-z]+\.js$/.test(spec)) {
      problems.push(`${file}: illegal import specifier "${spec}"`);
    }
  }
  // ...AND THE SIDE-EFFECT FORM GOES THROUGH THE SAME GATE. `import './x.js'`
  // was stripped by BARE_IMPORT_RE but never entered the loop above, which only
  // walks matches that have a `from`. So `import 'https://cdn/…'` would have
  // been silently DELETED rather than blocked: the module runs in dev, where
  // the browser honours it, and is simply absent from dist. Different
  // behaviour in the two artefacts, and nothing anywhere says so.
  const bare = src.match(BARE_IMPORT_RE) || [];
  for (const line of bare) {
    const m = line.match(/['"]([^'"]+)['"]/);
    problems.push(`${file}: side-effect import "${m && m[1]}" — every import must be a named one the bundler can account for`);
  }
  if (/^[ \t]*export\s+default/m.test(src)) problems.push(`${file}: uses export default (contract violation)`);
  if (/\bimport\s*\(/.test(src)) problems.push(`${file}: uses dynamic import()`);
  if (/\bfetch\s*\(/.test(src)) problems.push(`${file}: uses fetch()`);

  let out = src.replace(IMPORT_RE, '').replace(BARE_IMPORT_RE, '').replace(EXPORT_RE, '');
  return out.trim();
}

// ---- COMMENTS ARE THE POINT OF THE SOURCE AND DEAD WEIGHT IN THE BUNDLE --
// 46% of this repo's source is whole-line comment — 3.5 MB of it — and the
// artefact is one file that a player downloads or opens off a memory stick.
// strip-comments.mjs is a scanner rather than a regex, for the reason its own
// header gives at length: a slash is two things in JavaScript, and a pattern
// that hunts for a double slash finds the wrong one, silently.
//
// AND IT IS GUARDED. Each stripped body is parsed before it is accepted; a
// file that will not parse falls back to its own unstripped text and the
// build says which. A bug in the stripper must cost BYTES, never
// correctness — the same rule as the dollar-apostrophe note further down and
// as replaceOnce.
//
// vm.Script rather than a module parse, because the bodies have already had
// their imports and exports removed by strip(), which is exactly the form
// that goes into the bundle.
let strippedIn = 0, strippedOut = 0, stripFail = 0;
function stripBody(f, src) {
  const plain = strip(f, src);
  let lean;
  try {
    lean = strip(f, stripComments(src));
    new vm.Script(lean);
  } catch (e) {
    console.error('  strip skipped for ' + f + ': ' + e.message);
    stripFail++;
    return plain;
  }
  strippedIn += plain.length;
  strippedOut += lean.length;
  return lean;
}
const bodies = ORDER.map(f => {
  const src = readFileSync(join(ROOT, f), 'utf8');
  return `\n/* ======================= ${f} ======================= */\n` + stripBody(f, src) + '\n';
});

// Collision check: two modules declaring the same top-level function name would silently
// clobber each other once concatenated. Fail loudly instead.
const DECL_RE = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;
const seen = new Map();
ORDER.forEach((f, i) => {
  let m;
  DECL_RE.lastIndex = 0;
  while ((m = DECL_RE.exec(bodies[i]))) {
    const name = m[1] || m[2];
    if (seen.has(name)) problems.push(`NAME COLLISION: "${name}" declared in both ${seen.get(name)} and ${f}`);
    else seen.set(name, f);
  }
});

if (problems.length) {
  console.error('\n  BUILD BLOCKED — contract violations:\n');
  for (const p of problems) console.error('   * ' + p);
  console.error('');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// THE TWO LIBRARIES GO IN THE FILE.
//
// This build step has always described its output as "a single self-contained
// HTML file that runs straight from file:// with no server", and until 31 Aug
// 2026 it was neither: it inlined 7.5 MB of game and left `import * as THREE
// from 'three'` pointing at an importmap entry on jsdelivr. So the one artefact
// meant to be handed to somebody needed the network to start, and when it could
// not reach the CDN it showed a pale blue card reading "warming up the
// harbour…" for ever, in silence. Measured; see index.html.
//
// Each library is wrapped in an IIFE rather than concatenated flat, because
// three.js and cannon-es BOTH declare a top-level `Material` (and `Quaternion`,
// `Shape`, `Plane`, `Sphere`, `Vector3`/`Vec3`...). One scope each, one
// namespace object out, and the game's own `import * as X` is replaced by a
// `const` binding of exactly the same shape.
//
// Both files are single-export, import-free and use no `as` aliases — checked
// here rather than assumed, because a silent mistranslation of the export list
// would produce a bundle that boots and then fails somewhere deep in a chapter.
function vendorIIFE(file, name) {
  const src = readFileSync(join(ROOT, file), 'utf8');
  const m = src.match(/^export \{([^}]*)\};?\s*$/m);
  if (!m) { problems.push(`${file}: expected exactly one trailing "export { ... };"`); return ''; }
  if (/\bas\b/.test(m[1])) { problems.push(`${file}: export list uses "as" aliases — the shorthand transform is wrong for it`); return ''; }
  if (/^\s*import[\s(]/m.test(src)) { problems.push(`${file}: has imports of its own`); return ''; }
  if (/import\.meta/.test(src)) { problems.push(`${file}: uses import.meta and cannot be wrapped`); return ''; }
  const names = m[1].split(',').map(s => s.trim()).filter(Boolean);
  const body = src.slice(0, m.index) + '\nreturn { ' + names.join(', ') + ' };\n';
  return `/* ================= ${file} (${names.length} exports) ================= */\n` +
         `const ${name} = (function () {\n${body}})();\n`;
}

// MIT requires the notice to travel with the code, and inlining the code into
// a single file is exactly the case it is talking about. Kept as an HTML
// comment at the top of <body> so it survives in the artefact itself and not
// only in a repository nobody who was handed the file can see.
const VENDOR_NOTICE = [
  '<!--',
  '  This file bundles two MIT-licensed libraries.',
  '',
  '  three.js r169 — Copyright (c) 2010-2024 three.js authors',
  '  cannon-es 0.20.0 — Copyright (c) 2015 cannon.js authors, (c) 2020 cannon-es authors',
  '',
  '  Permission is hereby granted, free of charge, to any person obtaining a copy',
  '  of this software and associated documentation files (the "Software"), to deal',
  '  in the Software without restriction, including without limitation the rights',
  '  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell',
  '  copies of the Software, and to permit persons to whom the Software is',
  '  furnished to do so, subject to the following conditions:',
  '',
  '  The above copyright notice and this permission notice shall be included in',
  '  all copies or substantial portions of the Software.',
  '',
  '  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR',
  '  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,',
  '  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE',
  '  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER',
  '  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,',
  '  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN',
  '  THE SOFTWARE.',
  '',
  '  Full provenance, versions and checksums: vendor/README.md in the source tree.',
  '-->'
].join('\n');

// ---- AND WHAT THE GAME ITSELF IS UNDER (R10) -----------------------------
// The block above is the two libraries' notice and it has always been correct.
// What the artefact never said was anything about the ninety thousand lines it
// is mostly made of — so a file that travels well, opens from file:// and can
// be emailed to anybody carried an MIT grant covering three.js and cannon-es
// and SILENCE about the game, which reads, to anyone who thinks about it for a
// second, as though the MIT notice covered the lot.
//
// It does not. Until there is a LICENSE file, the honest line is the one the
// law supplies by default, and it belongs in the artefact rather than only in
// a repository nobody who was handed the file can see.
//
// THIS IS WIRING, NOT A DECISION. Drop a LICENSE file in the root and the
// notice below becomes its first paragraph automatically; see LICENSING.md for
// the three edits that go with it.
function gameNotice() {
  let grant = null;
  for (const f of ['LICENSE', 'LICENSE.md', 'LICENSE.txt']) {
    try { grant = readFileSync(join(ROOT, f), 'utf8'); break; } catch (e) { /* next */ }
  }
  const head = ['<!--', '  Untitled Capybara Game', ''];
  if (grant) {
    // The first paragraph of a licence file is its identity — "MIT License",
    // "Creative Commons Attribution 4.0", the copyright line. Enough to tell
    // somebody holding the file what they may do, with a pointer to the rest.
    const para = grant.replace(/\r\n/g, '\n').split('\n\n')[0].trim().split('\n');
    for (const l of para.slice(0, 8)) head.push('  ' + l);
    head.push('');
    head.push('  Full terms: the LICENSE file in the source tree.');
  } else {
    head.push('  No licence has been granted for this game.');
    head.push('');
    head.push('  The MIT notice below covers the two bundled libraries and NOTHING ELSE.');
    head.push('  Everything outside them is © the author, all rights reserved: you may');
    head.push('  play this file, and you do not have permission to redistribute or');
    head.push('  modify it. If you were handed this and want to do either, ask.');
  }
  head.push('-->');
  return head.join('\n');
}
const GAME_NOTICE = gameNotice();

const vendored = vendorIIFE('vendor/three.module.js', 'THREE') +
                 vendorIIFE('vendor/cannon-es.js', 'CANNON');

if (problems.length) {
  console.error('\n  BUILD BLOCKED — vendor problems:\n');
  for (const p of problems) console.error('   * ' + p);
  console.error('');
  process.exit(1);
}

// ---- A SPLICE THAT DID NOT HAPPEN IS SILENT, AND THAT IS THE DANGER -------
// All three replacements below key off an exact anchor in index.html, and
// `String.replace` with no match is a no-op that returns the string unchanged.
// So any reformat of index.html — a reordered attribute, a different quote, a
// line break — would produce a dist file that is the right sort of size, opens
// without complaint, and is missing the entire game, or the MIT notice the
// licence requires to travel with the code. The build would print OK.
//
// Same family as the `$'` bug the comment below describes: the failure is not
// that something goes wrong, it is that nothing does.
function replaceOnce(text, anchor, make, what) {
  const g = anchor instanceof RegExp
    ? new RegExp(anchor.source, anchor.flags.includes('g') ? anchor.flags : anchor.flags + 'g')
    : null;
  const n = g ? (text.match(g) || []).length : text.split(anchor).length - 1;
  if (n !== 1) {
    console.error(`\n  BUILD BLOCKED — ${what}: expected exactly one match, found ${n}.\n`);
    console.error('  index.html has almost certainly been reformatted. Without this check');
    console.error('  the build would have written a dist file missing it and printed OK.\n');
    process.exit(1);
  }
  return text.replace(anchor, make);
}

const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
// ---- THE REPLACEMENT IS A FUNCTION, AND IT HAS TO BE ----------------------
// `String.replace(pattern, string)` interprets `$&`, `$'` and "$`" INSIDE THE
// REPLACEMENT — so a single `$'` anywhere in the code being inlined splices
// "everything after the match" into the middle of the bundle. three.js
// contains one. The symptom was a dist file that looked fine, was the right
// sort of size, and died with `SyntaxError: Invalid or unexpected token`
// 1.2 MB in, with `</script></body></html>` sitting in the middle of a string
// literal in the middle of a library. A replacer function is passed the match
// instead of scanning for `$`, and has no such behaviour.
const inlineScript = '<script type="module">\n' + vendored + bodies.join('\n') + '\n</script>';
let bundled = replaceOnce(
  html,
  '<script type="module" src="./src/main.js"></script>',
  () => inlineScript,
  'the game itself'
);
// The importmap is now dead weight, and worse: leaving a bare specifier map in
// a file that resolves nothing would be a lie about where the code came from.
bundled = replaceOnce(bundled, /<script type="importmap">[\s\S]*?<\/script>\s*/,
                      () => '', 'the importmap');
// A function again, for the same reason as above — the notice has no `$` in it
// today, and the next person to edit it should not have to know that it must not.
bundled = replaceOnce(bundled, '<body>', () => '<body>\n' + GAME_NOTICE + '\n' + VENDOR_NOTICE,
                      'the licence notices');
if (/cdn\.jsdelivr\.net|unpkg\.com|cdnjs/.test(bundled)) {
  console.error('\n  BUILD BLOCKED — the bundle still references a CDN.\n');
  process.exit(1);
}

mkdirSync(join(ROOT, 'dist'), { recursive: true });
const outPath = join(ROOT, 'dist', 'untitled-capybara-game.html');
writeFileSync(outPath, bundled, 'utf8');

const kb = (Buffer.byteLength(bundled, 'utf8') / 1024).toFixed(1);
console.log(`OK  ${outPath}  (${kb} KB, ${seen.size} top-level declarations, no collisions)`);
console.log(`    comments stripped: ${(strippedIn / 1024).toFixed(0)} KB source -> ` +
            `${(strippedOut / 1024).toFixed(0)} KB` +
            (stripFail ? `, ${stripFail} file(s) kept whole` : ''));
