// ONE AUTHOR'S TICS DO NOT RUN THROUGH NINETEEN VOICES (L6, E7).
//
//   node qa/l6-tics.mjs
//
// The writing review counted, across the string literals of src/*.js:
// *eleven years* ×17 in 9 files, *Tuesday* ×17 in 8, *every single* ×15,
// *, that is.* ×14, *nobody has ever* ×15. Every one of those lines reads fine
// on its own — the deadpan number IS the house style — and the table only
// fails when it is read sideways: by chapter eight a player hears the writer,
// not the place. qa/m9-voice.mjs already reads npcPLACE_SAY sideways; this
// reads every file.
//
// It is a CEILING PER FILE, not a ban. A phrase is a chapter's when one or two
// chapters say it (the Drift's regular is called Eleven Years; the Quay's
// wharfies say "that is"); it is the author's when eleven do. Three files
// each, and the count is of files, not of lines — a chapter that leans on a
// phrase six times is a voice, eleven chapters that each use it once are a
// tic.
//
// Only string literals count, never comments: the comments are the repo's
// notebook and say "nobody has ever" about the code. The source goes through
// the build's own stripComments (a tokeniser, not a regex — see
// strip-comments.mjs for why that matters) and what is left is scanned for
// '…', "…" and `…` literals. Exits 1 if any phrase is in more than THREE
// files; prints the per-file census either way so the surplus can be found.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../strip-comments.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const CEILING = 3;

// The table. Each is a regex over a single literal; `\b` where the phrase is
// a word, none where it is punctuation. "I have been … years" is the shape,
// not the words: a first person, a duration, a number spelled or written.
const NUM = '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|' +
            'thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|' +
            'thirty|forty|fifty|sixty|\\d+)';
const PHRASES = [
  ['eleven years',        /\beleven years\b/i],
  ['Tuesday',             /\bTuesday\b/],
  ['every single',        /\bevery single\b/i],
  [', that is.',          /, that is\./],
  ['nobody has ever',     /\bnobody has ever\b/i],
  ['I have been N years', new RegExp('\\bI have been\\b[^.!?]*\\b' + NUM + ' years\\b', 'i')],
];

// A literal, as the tokeniser left it: no newlines inside '…' or "…", any
// inside `…`. The build stripped the comments; what remains that looks like a
// string IS a string.
const LIT = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;

const files = readdirSync(SRC).filter((f) => f.endsWith('.js')).sort();
const lits = new Map();
for (const f of files) {
  const s = stripComments(readFileSync(join(SRC, f), 'utf8'));
  lits.set(f, s.match(LIT) || []);
}

let bad = 0;
for (const [name, re] of PHRASES) {
  const per = new Map();
  let n = 0;
  for (const [f, ls] of lits) {
    for (const l of ls) {
      const m = l.match(new RegExp(re.source, re.flags + 'g'));
      if (!m) continue;
      per.set(f, (per.get(f) || 0) + m.length);
      n += m.length;
    }
  }
  const over = per.size > CEILING;
  if (over) bad++;
  const census = [...per].sort((a, b) => b[1] - a[1]).map(([f, k]) => f + ' ' + k).join(', ');
  console.log((over ? 'BLOCKER  ' : 'ok       ') + '"' + name + '"  x' + n + ' in ' +
              per.size + ' file' + (per.size === 1 ? '' : 's') +
              (per.size ? '  (' + census + ')' : ''));
}
console.log('\n' + PHRASES.length + ' phrases, ceiling ' + CEILING + ' files each, ' +
            bad + ' over');
process.exit(bad ? 1 : 0);
