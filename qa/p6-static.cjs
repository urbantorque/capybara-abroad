// P6's static half. Every claim here is about a TABLE, and a table is
// answerable without a browser — this is the same idiom as the P3 clue audit.
// Run: node qa/p6-static.cjs
const fs = require('fs');
const s = fs.readFileSync('src/shared.js', 'utf8');

// ---- CHAPTERS -------------------------------------------------------------
const ci = s.indexOf('export const CHAPTERS');
const cseg = s.slice(ci, s.indexOf('\nexport function chapterOf'));
const parts = cseg.split(/\n  \{ n: /).slice(1);
const chaps = parts.map((p) => {
  const acts = [...p.matchAll(/\{ kick: '([^']*)', line: '([^']*)' \}/g)].map((m) => [m[1], m[2]]);
  return {
    n: +p.match(/^(\d+)/)[1],
    biome: (p.match(/biome: '([a-z]+)'/) || [])[1],
    sub: (p.match(/sub: '([^']*)'/) || [])[1] || '',
    open: (p.match(/open: '([^']*)'/) || [])[1] || '',
    note: (p.match(/note: '([^']*)'/) || [])[1] || '',
    keep: (p.match(/keep: '([^']*)'/) || [])[1] || '',
    keepNone: /keepNone: true/.test(p),
    acts: acts,
  };
});

// ---- TASKS ----------------------------------------------------------------
const ti = s.indexOf('export const TASKS');
const tseg = s.slice(ti, ci);
const tasks = [...tseg.matchAll(/\{ id: '([a-z0-9-]+)',[\s\S]{0,300}?chapter: (\d+)(?:, act: (\d))?/g)]
  .map((m) => ({ id: m[1], chapter: +m[2], act: m[3] ? +m[3] : 1 }));

const fail = [];
const warn = [];

// 1. every chapter has a note
for (const c of chaps) if (!c.note) fail.push('ch' + c.n + ' (' + c.biome + ') has no note');

// 2. the open line is never act one's line
for (const c of chaps) {
  if (c.acts.length && c.acts[0][1] === c.open) fail.push('ch' + c.n + ' open duplicates act 1');
}

// 3. every act declared has at least one task in it, and no task points at an
//    act its chapter does not declare. An act with nothing in it never becomes
//    the live act, so it is a heading the player can never see.
for (const c of chaps) {
  const mine = tasks.filter((t) => t.chapter === c.n);
  const have = new Set(mine.map((t) => t.act));
  if (!c.acts.length) {
    for (const a of have) if (a > 1) fail.push('ch' + c.n + ' task in act ' + a + ' but declares no acts');
    continue;
  }
  for (let a = 1; a <= c.acts.length; a++) {
    if (!have.has(a)) fail.push('ch' + c.n + ' declares act ' + a + " ('" + c.acts[a - 1][0] + "') with no tasks in it");
  }
  for (const a of have) {
    if (a > c.acts.length) fail.push('ch' + c.n + ' has a task in act ' + a + ' but declares only ' + c.acts.length);
  }
}

// 4. no chapter has an act with one task in it — a movement of one row is a
//    curtain going up on a single line, which reads as a bug
for (const c of chaps) {
  if (!c.acts.length) continue;
  for (let a = 1; a <= c.acts.length; a++) {
    const k = tasks.filter((t) => t.chapter === c.n && t.act === a).length;
    if (k === 1) warn.push('ch' + c.n + " act " + a + " ('" + c.acts[a - 1][0] + "') has one task");
  }
}

// 5. the arrival row of every chapter is act 1: it is the first thing a player
//    reads and it cannot be behind a movement they have not opened
for (const c of chaps) {
  const arrive = tasks.find((t) => t.chapter === c.n && /^to-|^come-/.test(t.id));
  if (arrive && arrive.act !== 1) fail.push('ch' + c.n + ' arrival ' + arrive.id + ' is in act ' + arrive.act);
}

// 6. nothing still says "Turn up in"
const turn = [...tseg.matchAll(/text: '(Turn up in [^']*)'/g)].map((m) => m[1]);
for (const t of turn) fail.push('arrival still says: ' + t);

// 7. exactly one chapter may be the souvenir exception
const none = chaps.filter((c) => c.keepNone);
if (none.length !== 1) fail.push('keepNone is on ' + none.length + ' chapters, expected exactly 1');

console.log('chapters ' + chaps.length + ', tasks ' + tasks.length);
console.log('acts per chapter: ' + chaps.map((c) => c.n + ':' + c.acts.length).join(' '));
for (const w of warn) console.log('warn  ' + w);
for (const f of fail) console.log('FAIL  ' + f);
console.log(fail.length ? fail.length + ' FAILURES' : 'all static checks pass');
process.exit(fail.length ? 1 : 0);
