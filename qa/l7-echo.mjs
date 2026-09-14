// ONE SENTENCE PER SURFACE (L7, E6 / writing W1, W6, W7).
//
//   node qa/l7-echo.mjs
//
// The L7 writing review counted, across each chapter's seven surfaces, 73
// pairs that share a trigram; Manly said "the sea has a shape" five times
// between the picker and the notebook. `left`~`note` echoes are allowed — a
// player reads one OR the other — but the place card's `sub` and the
// notebook's first line, and the `sub` and the departure card's `left`, are
// read in ONE visit, and in 11 and 6 chapters they were the same sentence.
// This is the reviewer's trigram count (scratchpad echo.mjs) made into a
// test, plus the three other zero-invariants the review named:
//
//   - no shared trigram between `sub` and `nb[0]`, or `sub` and `left`, in
//     any chapter (the stop-list keeps "and the", "of the" and their like
//     from counting as an echo);
//   - the word "chapter" in no `note`, `left` or `nb` line — the animal does
//     not know it is in a game;
//   - no more than FIVE of the nineteen `left` lines end on a sentence that
//     begins "You" — the deadpan reversal is a cadence, not a rule;
//   - no clue in sysHINTS carries a percentage — the paper says where and
//     what, never the game's number;
//   - every chapter has an `again` (the place answers back, E6/B).
//
// CHAPTERS is read out of src/shared.js as text and evaluated, because the
// module imports three and node cannot; the literal has no references in it
// (qa/p6-static.cjs reads the same slice by regex). Exits 1 on any of the
// five; prints the census either way.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../strip-comments.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const shared = readFileSync(join(ROOT, 'src', 'shared.js'), 'utf8');
const systems = readFileSync(join(ROOT, 'src', 'systems.js'), 'utf8');

/** The balanced literal from `at` (an open bracket), skipping strings. */
function grab(src, at, open, close) {
  let depth = 0, inStr = null;
  for (let i = at; i < src.length; i++) {
    const c = src[i];
    if (inStr) { if (c === '\\') { i++; continue; } if (c === inStr) inStr = null; continue; }
    if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return src.slice(at, i + 1); }
  }
  return null;
}
// Comments first (they have apostrophes in them), then the bracket walk.
const cseg = stripComments(shared.slice(shared.indexOf('export const CHAPTERS = ['), shared.indexOf('\nexport function chapterOf')));
const lit = grab(cseg, cseg.indexOf('['), '[', ']');
const CHAPTERS = Function('return (' + lit + ')')();
if (!Array.isArray(CHAPTERS) || CHAPTERS.length !== 19) { console.log('BLOCKER  CHAPTERS did not evaluate to 19 rows'); process.exit(1); }

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const tri = (s) => { const w = norm(s).split(' '); const o = new Set(); for (let i = 0; i + 2 < w.length; i++) o.add(w.slice(i, i + 3).join(' ')); return o; };
const STOP = /^(and|the|of|it|is|a|in|to|you|on|at) (the|a|it|of|and|is|you|to|in|on|at) /;
const shared3 = (a, b) => [...tri(a)].filter((x) => tri(b).has(x) && !STOP.test(x + ' '));
const nbLines = (c) => (c.nb || []).flatMap((e) => typeof e === 'string' ? [e] : [e.t || '', e.else || '']).filter(Boolean);
const nb0 = (c) => (c.nb && typeof c.nb[0] === 'string') ? c.nb[0] : '';

let bad = 0;
const say = (ok, s) => { if (!ok) bad++; console.log((ok ? 'ok       ' : 'BLOCKER  ') + s); };

// 1. sub ~ nb[0], sub ~ left
let echoNb = 0, echoLeft = 0;
for (const c of CHAPTERS) {
  const a = shared3(c.sub, nb0(c)), b = shared3(c.sub, c.left);
  if (a.length) { echoNb++; console.log('  ' + c.n + ' ' + c.biome + '  sub~nb0  "' + a[0] + '"'); }
  if (b.length) { echoLeft++; console.log('  ' + c.n + ' ' + c.biome + '  sub~left "' + b[0] + '"'); }
}
say(echoNb === 0, 'sub~nb[0] shared trigrams: ' + echoNb + '/19 chapters (ceiling 0)');
say(echoLeft === 0, 'sub~left shared trigrams: ' + echoLeft + '/19 chapters (ceiling 0)');

// 2. "chapter" in note / left / nb
let chap = 0;
for (const c of CHAPTERS) for (const [f, s] of [['note', c.note], ['left', c.left], ...nbLines(c).map((s) => ['nb', s])]) {
  if (/\bchapters?\b/i.test(s)) { chap++; console.log('  ' + c.n + ' ' + c.biome + '  ' + f + ': ' + s); }
}
say(chap === 0, '"chapter" in note/left/nb: ' + chap + ' (ceiling 0)');

// 3. left lines ending on a "You …" sentence
let youFinal = 0;
for (const c of CHAPTERS) {
  const s = (c.left || '').split(/(?<=\.)\s+/);
  if (s.length >= 2 && /^You\b/.test(s[s.length - 1])) { youFinal++; console.log('  ' + c.n + ' ' + c.biome + '  left: ' + c.left); }
}
say(youFinal <= 5, 'left lines ending on a "You…" sentence: ' + youFinal + '/19 (ceiling 5)');

// 4. clue literals with a percentage
const hseg = stripComments(systems.slice(systems.indexOf('const sysHINTS = {')));
const hints = grab(hseg, hseg.indexOf('{'), '{', '}');
const LIT = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
const pct = (hints.match(LIT) || []).filter((l) => /\d+ ?%/.test(l));
for (const l of pct) console.log('  clue: ' + l);
say(pct.length === 0, 'sysHINTS clue literals with a percentage: ' + pct.length + ' (ceiling 0)');

// 5. every chapter answers a returner
const noAgain = CHAPTERS.filter((c) => typeof c.again !== 'string' || !c.again.trim());
for (const c of noAgain) console.log('  ' + c.n + ' ' + c.biome + '  no again:');
say(noAgain.length === 0, 'chapters with an `again` line: ' + (19 - noAgain.length) + '/19');

// The census that is not a test: the notebook's "did not"s, and every
// echoing pair across the seven surfaces (the reviewer's 73).
let didNot = 0, pairs = 0;
for (const c of CHAPTERS) {
  for (const s of nbLines(c)) if (/\b(did|do|does|had|has|have|was|were|is|are|could|am) not\b/i.test(s)) didNot++;
  const S = { sub: c.sub, hint: c.hint, open: c.open, left: c.left, note: c.note, nb0: nb0(c), acts: (c.acts || []).map((a) => a.line).join(' | ') };
  const k = Object.keys(S);
  for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) if (shared3(S[k[i]], S[k[j]]).length) pairs++;
}
console.log('\nnotebook lines with a "… not": ' + didNot + '; echoing surface pairs across all seven surfaces: ' + pairs + ' (the review counted 73)');
console.log(bad + ' of 6 invariants over');
process.exit(bad ? 1 : 0);
