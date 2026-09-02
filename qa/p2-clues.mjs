// Static check: apply the pad and touch substitution tables to every clue
// string in the file and report which ones change, so a bare-letter rule that
// eats a word is visible before it ships. The touch table's own comment records
// this check being run for R5; the pad table is new and needs the same.
import fs from 'fs';

const src = fs.readFileSync('src/systems.js', 'utf8');

// clue: '...'  |  clue: "..."   (single-line literals only; the handful of
// function-valued clues are built at runtime and cannot be read here)
const re = /clue:\s*('((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;
const clues = [];
let m;
while ((m = re.exec(src))) clues.push((m[2] !== undefined ? m[2] : m[3]).replace(/\\'/g, "'"));

const TOUCH = [
  [/\bhold Shift\b/g, 'push the stick all the way'],
  [/\bhold R\b/g,     'hold STUCK'],
  [/\bpress Q\b/g,    'tap WHEEK'],
  [/\bpress E\b/g,    'tap GRAB'],
  [/\bhold E\b/g,     'hold GRAB'],
  [/\bhold G\b/g,     'hold SLIDE'],
  [/\bQ\b/g,          'WHEEK'],
  [/\bE\b/g,          'GRAB'],
  [/\bSpace\b/g,      'HOP'],
  [/\bShift\b/g,      'the stick, all the way'],
  [/\bG\b/g,          'SLIDE'],
];
const PAD = [
  [/\bhold Shift\b/g, 'hold RT'],
  [/\bhold R\b/g,     'hold BACK'],
  [/\bpress Q\b/g,    'press B'],
  [/\bpress E\b/g,    'press X'],
  [/\bhold E\b/g,     'hold X'],
  [/\bhold G\b/g,     'hold LT'],
  [/\bQ\b/g,          'B'],
  [/\bE\b/g,          'X'],
  [/\bSpace\b/g,      'A'],
  [/\bShift\b/g,      'RT'],
  [/\bG\b/g,          'LT'],
];
const apply = (s, t) => t.reduce((a, r) => a.replace(r[0], r[1]), s);

let padChanged = 0, touchChanged = 0;
const padRows = [], suspicious = [];
for (const c of clues) {
  const p = apply(c, PAD), t = apply(c, TOUCH);
  if (p !== c) { padChanged++; padRows.push([c, p]); }
  if (t !== c) touchChanged++;
  // A rewrite is suspicious when a letter was replaced inside what reads as
  // ordinary prose rather than as a named control: no "press"/"hold" nearby.
  if (p !== c && !/\b(press|hold|tap|with|and)\b/.test(c)) suspicious.push([c, p]);
}

console.log('clue string literals found:', clues.length);
console.log('rewritten by the PAD table  :', padChanged);
console.log('rewritten by the TOUCH table:', touchChanged);
console.log('\n--- every pad rewrite ---');
for (const [a, b] of padRows) console.log('  ' + JSON.stringify(a) + '\n   -> ' + JSON.stringify(b));
console.log('\n--- rewrites with no verb nearby (check these by eye) ---');
if (!suspicious.length) console.log('  none');
for (const [a, b] of suspicious) console.log('  ' + JSON.stringify(a) + ' -> ' + JSON.stringify(b));

// And the reverse hazard: a clue that CONTAINS a lone capital the tables would
// eat but that is not a control at all.
const lone = clues.filter(c => /\b[A-Z]\b/.test(c) && !/\b(Q|E|G|R)\b/.test(c));
console.log('\nclues with some other lone capital:', lone.length);
for (const c of lone.slice(0, 12)) console.log('  ' + JSON.stringify(c));
