import { readFileSync } from 'node:fs';
const s = readFileSync('src/systems.js', 'utf8');
const clues = [...s.matchAll(/clue: '((?:[^'\\]|\\.)*)'/g)].map(m => m[1]);

// The candidate transform, longest/most specific first.
const MAP = [
  [/\bhold Shift\b/g, 'push the stick all the way'],
  [/\bhold R\b/g,     'hold STUCK'],
  [/\bpress Q\b/g,    'tap WHEEK'],
  [/\bpress E\b/g,    'tap GRAB'],
  [/\bhold E\b/g,     'hold GRAB'],
  [/\bQ\b/g,          'WHEEK'],
  [/\bE\b/g,          'GRAB'],
  [/\bSpace\b/g,      'HOP'],
  [/\bShift\b/g,      'the stick, all the way'],
  [/\bCtrl\b/g,       'SLIDE'],
];
function t(x) { let o = x; for (const [re, v] of MAP) o = o.replace(re, v); return o; }

let n = 0;
for (const c of clues) {
  const o = t(c);
  if (o !== c) { n++; console.log('  -', c); console.log('  +', o); }
}
console.log('--- changed', n, 'of', clues.length);
const risky = clues.map(t).filter(c => /\b[A-Z]\b/.test(c));
console.log('--- lone capitals surviving the transform:', risky.length);
risky.forEach(c => console.log('   ', c));
