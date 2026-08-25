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
console.log('\n' + blockers + ' blockers, ' + warnings + ' warnings');
process.exit(blockers ? 1 : 0);
