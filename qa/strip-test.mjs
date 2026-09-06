// The stripper's own tests. Every case here is a way a regex-based stripper
// silently eats live code — which is the failure mode that matters, because
// the file still parses afterwards.
//
// Run: node qa/strip-test.mjs
import { stripComments } from '../strip-comments.mjs';

let pass = 0, fail = 0;
function is(got, want, what) {
  if (got === want) { pass++; return; }
  fail++;
  console.log('FAIL  ' + what);
  console.log('  want: ' + JSON.stringify(want));
  console.log('  got : ' + JSON.stringify(got));
}
const one = (s) => stripComments(s).replace(/\s+/g, ' ').trim();

// ---- the ordinary cases --------------------------------------------------
is(one('const a = 1; // gone'), 'const a = 1;', 'line comment');
is(one('/* gone */ const a = 1;'), 'const a = 1;', 'block comment');
is(one('const a = 1; /* gone\nstill gone */ const b = 2;'),
   'const a = 1; const b = 2;', 'multi-line block comment');

// ---- the ones that eat live code ----------------------------------------
is(one("const s = 'not // a comment';"), "const s = 'not // a comment';",
   'a // inside a single-quoted string');
is(one('const s = "not /* a */ comment";'), 'const s = "not /* a */ comment";',
   'a block comment inside a double-quoted string');
is(one('const re = /https:\\/\\//;'), 'const re = /https:\\/\\//;',
   'an escaped // inside a regex literal');
is(one('const re = /[/]/;'), 'const re = /[/]/;',
   'a / inside a regex character class');
is(one('const k = a / b; // gone'), 'const k = a / b;',
   'division, not a regex');
is(one('const k = (a) / b / c;'), 'const k = (a) / b / c;',
   'division after a close paren');
is(one('if (x) return /re/.test(y); // gone'), 'if (x) return /re/.test(y);',
   'a regex after return, which is identifier-shaped but not a value');
// A template literal is copied out VERBATIM, comments and all. That is
// deliberate and it is the safe direction: keeping a comment costs bytes and
// can never change behaviour, whereas getting the brace depth wrong inside a
// substitution ends the template early and takes the rest of the file with it.
// This codebase builds its shaders from array joins rather than templates, so
// the bytes involved are negligible.
is(one('const t = `a ${b /* kept */} c`;'), 'const t = `a ${b /* kept */} c`;',
   'a comment inside a template substitution is KEPT, on purpose');
is(one("const t = `a ${ 'x // y' } b`;"), "const t = `a ${ 'x // y' } b`;",
   'a // inside a string inside a template substitution');
is(one('const t = `outer ${ `inner ${1}` } end`;'),
   'const t = `outer ${ `inner ${1}` } end`;', 'a nested template literal');
is(one('const t = `a } b`;'), 'const t = `a } b`;',
   'a bare brace inside a template');

// ---- ASI: a stripped comment may not join two lines ----------------------
is(stripComments('const a = 1 // gone\nconst b = 2').split('\n').length, 2,
   'the newline after a line comment survives');
// The newlines a block comment contained are re-emitted, so ASI and the line
// count survive it — and then runs of three or more are collapsed to two,
// which is safe because ASI needs at least one newline and never more than
// one. A file that is 46% comment would otherwise become a file that is 46%
// empty.
is(stripComments('a\n/* gone\ngone\ngone */\nb').split('\n').length, 3,
   'a block comment leaves its newlines behind, collapsed');

// ---- and the real files --------------------------------------------------
// The strongest test available without a parser: every source file, stripped,
// must still parse. `vm.Script` will not take ESM, so imports and exports are
// removed the same way build.mjs removes them.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
const IMPORT_RE = /^[ \t]*import\b[^;]*?from\s*['"][^'"]+['"];?[ \t]*\r?\n/gm;
const EXPORT_RE = /^[ \t]*export\s+(?=(?:async\s+)?function|const|let|var|class)/gm;
let bytesIn = 0, bytesOut = 0, files = 0, broke = 0;
for (const f of readdirSync('src').filter((x) => x.endsWith('.js'))) {
  const raw = readFileSync(join('src', f), 'utf8');
  const body = (t) => t.replace(IMPORT_RE, '').replace(EXPORT_RE, '');
  const before = body(raw);
  const after = body(stripComments(raw));
  bytesIn += before.length;
  bytesOut += after.length;
  files++;
  // ---- A SOURCE FILE THAT DOES NOT PARSE FAILS THE BUILD (F4) ------------
  // This was a `console.log` of a parenthetical and a `continue`. The reasoning
  // was sound as far as it went — the stripper must not be blamed for a file
  // that was already broken — but the consequence was that NOTHING failed:
  // `npm test` reported "10 checks, 0 failed" on a systems.js with a hard
  // syntax error in it, and the only thing that ever said otherwise was the
  // browser console, two probes and twenty minutes later.
  //
  // This loop is the only place in the suite that parses the source at all, so
  // it is the only place that can answer the question. It answers it now.
  try { new vm.Script(before); } catch (e) {
    console.log('FAIL  ' + f + ' DOES NOT PARSE: ' + e.message);
    fail++; broke++;
    continue;
  }
  try { new vm.Script(after); } catch (e) {
    console.log('FAIL  ' + f + ' does not parse after stripping: ' + e.message);
    fail++; broke++;
  }
}
const kb = (x) => (x / 1024).toFixed(0) + ' KB';
console.log('\n' + files + ' source files: ' + kb(bytesIn) + ' -> ' + kb(bytesOut) +
            '  (' + Math.round((1 - bytesOut / bytesIn) * 100) + '% smaller), ' +
            broke + ' broken');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
