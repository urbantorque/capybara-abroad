// A CLUE MAY NOT NAME A VERB THE PLAYER HAS NOT BEEN GIVEN YET.
//
// Found in batch 2, job 3: Sydney's `cafe-table` clue read "climb up onto the
// tabletop". The action is a HOP, and CLIMB is a real, distinct verb this game
// does not hand over until chapter 11 (capybara.js says so in its own comment).
// So chapter one spent the name of a chapter-eleven verb on something that is
// not it, ten chapters early — the worst thing a tutorial clue can do, because
// the player who remembers the word will go looking for a wall.
//
// Static on purpose: reads the sources, needs no browser, runs in well under a
// second, so it can sit in front of every future pass.
import { readFileSync } from 'node:fs';

const shared = readFileSync(new URL('../src/shared.js', import.meta.url), 'utf8');
const systems = readFileSync(new URL('../src/systems.js', import.meta.url), 'utf8');

// verb name -> the first chapter in which the player actually has it.
// Sourced from capybara.js's own comments.
const VERB_FROM = {
  climb: 11,   // capybara.js: "THE CLIMB (chapter 11)"
  dive: 12,    // capybara.js: "THE DIVE (chapter 12)"
};

// task id -> chapter. PER ROW, never a running counter: `chapter:` sits AFTER
// `id:` inside each row, so a streaming scanner gives every id the PREVIOUS
// row's chapter and the whole table comes out shifted by one. That measured as
// "Q is named first in chapter 0", and there is no chapter 0.
const taskChapter = new Map();
{
  const i = shared.indexOf('export const TASKS');
  const blk = shared.slice(i, shared.indexOf('export const', i + 10));
  for (const m of blk.matchAll(/\{[^{}]*\}/g)) {
    const id = /id:\s*'([^']+)'/.exec(m[0]);
    const ch = /chapter:\s*(\d+)/.exec(m[0]);
    if (id && ch) taskChapter.set(id[1], +ch[1]);
  }
}

// task id -> clue text, out of sysHINTS
const clues = new Map();
{
  const i = systems.indexOf('const sysHINTS');
  const blk = systems.slice(i);
  for (const m of blk.matchAll(/'?([a-z0-9-]+)'?\s*:\s*\{\s*clue:\s*'([^']*)'/g)) {
    if (!clues.has(m[1])) clues.set(m[1], m[2]);
  }
}

let blockers = 0, warnings = 0;
for (const [id, clue] of clues) {
  const chap = taskChapter.get(id);
  if (chap === undefined) continue;
    // NO REGEX BUILT FROM A STRING IN THIS FILE. It was `new RegExp("\b"+verb+...)`
    // and the heredoc that wrote the file ate one backslash of each pair, so the
    // pattern became a literal backspace character and matched NOTHING — the
    // audit passed clean against the very clue it was written to catch. A plain
    // includes() has no escapes to lose. See the harness note in memory.
  for (const [verb, from] of Object.entries(VERB_FROM)) {
    if (clue.toLowerCase().includes(verb) && chap < from) {
      console.log('BLOCKER  ch' + chap + '  ' + id + '  names "' + verb +
                  '" but there is no ' + verb + ' until chapter ' + from +
                  '\n           clue: "' + clue + '"');
      blockers++;
    }
  }
}

// The keys the title card advertises as core. Each should be NAMED BY KEY by at
// least one clue, or it is a control the paper never once says out loud.
const KEYS = { Q: /\bQ\b/, E: /\bE\b/, Shift: /\bShift\b/, Space: /\bSpace\b/ };
const firstNamed = {};
for (const [id, clue] of clues) {
  const chap = taskChapter.get(id);
  if (chap === undefined) continue;
  for (const [k, re] of Object.entries(KEYS)) {
    if (re.test(clue) && (firstNamed[k] === undefined || chap < firstNamed[k])) firstNamed[k] = chap;
  }
}
for (const k of Object.keys(KEYS)) {
  if (firstNamed[k] === undefined) {
    console.log('WARNING  no clue anywhere names the ' + k + ' key');
    warnings++;
  }
}

console.log('\nfirst chapter whose clue names each key: ' +
  Object.keys(KEYS).map(k => k + ' ' + (firstNamed[k] === undefined ? '-' : firstNamed[k])).join('  ·  '));
console.log(clues.size + ' clues checked against ' + taskChapter.size + ' task rows');

// ---- THE SECOND ASK (L6, F2 / design 2.1, 2.2) ------------------------------
// A row may carry `needs:` — the skill or system its tick reads, '+'-joined
// when it reads two. Two rules and two counts:
//   1. A ROW MAY NOT NEED A THING THE PLAYER HAS NOT BEEN GIVEN YET. The
//      chapter that teaches each key, from sysSKILLS in systems.js (the herd
//      is chapter 1 through the ibis, `alt: 'bin-chicken'`) and capybara.js's
//      own comments (the dive, chapter 12). A `needs` whose chapter is later
//      than the row's is a blocker.
//   2. CONSUMERS PER VERB. The front of the title card promises six verbs and
//      a dive, and the paper has to ask for each of them: G at least once, the
//      dive in at least three chapters (today four rows in two — the LEGACY
//      table is those four, by grep of `capy.diving`/`.depth` at their tick
//      sites in palawan.js and manly.js, so the count is rows and not needs).
//   ...and the number the review measured at zero: rows whose tick reads a
//   field capySkill backs (vault, seed, mantle, committed, the herd, and the
//   perch, which is gated on can('herd')).
const NEEDS_FROM = {
  lungs: 2, quiet: 4, beat: 5, carve: 7, vault: 8, seed: 9, mantle: 11,
  herd: 1, float: 15, flow: 19, committed: 19,
  dive: 12, hidden: 1, perch: 1, worn: 1, carry: 1, G: 1, slide: 1, clock: 1,
};
const SKILL_BACKED = { vault: 1, seed: 1, mantle: 1, committed: 1, flow: 1, herd: 1, perch: 1 };
const LEGACY = { dive: { 'first-dive': 12, 'the-crack': 12, cathedral: 12, 'duck-dive': 14 } };
const needsRows = [];
{
  const i = shared.indexOf('export const TASKS');
  const blk = shared.slice(i, shared.indexOf('export const', i + 10));
  for (const m of blk.matchAll(/\{[^{}]*\}/g)) {
    const id = /id:\s*'([^']+)'/.exec(m[0]);
    const ch = /chapter:\s*(\d+)/.exec(m[0]);
    const nd = /needs:\s*'([^']+)'/.exec(m[0]);
    if (id && ch && nd) needsRows.push({ id: id[1], chapter: +ch[1], needs: nd[1].split('+') });
  }
}
const consumers = {};
for (const r of needsRows) {
  for (const k of r.needs) {
    const from = NEEDS_FROM[k];
    if (from === undefined) {
      console.log('BLOCKER  ch' + r.chapter + '  ' + r.id + '  needs "' + k + '", which nothing teaches (not in NEEDS_FROM)');
      blockers++;
    } else if (r.chapter < from) {
      console.log('BLOCKER  ch' + r.chapter + '  ' + r.id + '  needs "' + k + '" but it is not taught until chapter ' + from);
      blockers++;
    }
    (consumers[k] = consumers[k] || new Map()).set(r.id, r.chapter);
  }
}
for (const k of Object.keys(LEGACY)) for (const [id, ch] of Object.entries(LEGACY[k])) (consumers[k] = consumers[k] || new Map()).set(id, ch);
const skillRows = needsRows.filter(r => r.needs.some(k => SKILL_BACKED[k]));
const askRows = needsRows.filter(r => !r.needs.every(k => k === 'clock'));
console.log('\nneeds: ' + needsRows.length + ' rows carry one (' + askRows.length + ' ask for something taught, ' +
  (needsRows.length - askRows.length) + ' are windows); ' + skillRows.length + ' read a capySkill-backed field');
console.log('consumers per verb (rows, chapters):');
for (const k of Object.keys(consumers).sort()) {
  const m = consumers[k];
  const chs = [...new Set(m.values())].sort((a, b) => a - b);
  console.log('  ' + k.padEnd(10) + m.size + ' rows in ' + chs.length + ' chapters  [' + chs.join(' ') + ']');
}
const gN = consumers.G ? consumers.G.size : 0;
const dN = consumers.dive ? consumers.dive.size : 0;
const dCh = consumers.dive ? new Set(consumers.dive.values()).size : 0;
if (gN < 1) { console.log('BLOCKER  G is on the front of the title card and no row reads capy.sliding'); blockers++; }
if (dN < 4 || dCh < 3) { console.log('BLOCKER  the dive has ' + dN + ' consumers in ' + dCh + ' chapters; wants >= 4 in >= 3'); blockers++; }
if (askRows.length < 11) { console.log('BLOCKER  ' + askRows.length + ' rows ask for something taught; the second ask wants >= 11'); blockers++; }

console.log('\n' + blockers + ' blockers, ' + warnings + ' warnings');
process.exit(blockers ? 1 : 0);
