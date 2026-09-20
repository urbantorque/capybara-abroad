// EVERY CONDITIONAL LINE NAMES A TASK THAT EXISTS.
//
//   node qa/lines.mjs
//
// `{ t: '…', after: 'task-id' }` is resolved by localResolve in npc.js through
// game.taskDone(), which answers FALSE for an unknown id rather than throwing —
// which is the right behaviour at runtime and is exactly why this file has to
// exist. A line whose id has been renamed does not warn, does not crash and
// does not appear: the person simply never says it, for ever, and nothing
// anywhere reports that anything is wrong.
//
// It also catches the other half of the same mistake — a conditional line
// naming a task from a DIFFERENT chapter, which parses, resolves and is
// unreachable in practice because a chapter's people only speak in their own
// chapter and finds/tasks from elsewhere are either always true or never true.

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

// ---- the task table -------------------------------------------------------
const shared = readFileSync(join(SRC, 'shared.js'), 'utf8');
const tasksBlock = shared.match(/export const TASKS[\s\S]*?\n\];/);
if (!tasksBlock) { console.error('cannot find TASKS in shared.js'); process.exit(2); }
const taskChapter = new Map();
for (const m of tasksBlock[0].matchAll(/\{\s*id:\s*'([^']+)',\s*text:\s*'[^']*'[^}]*?chapter:\s*(\d+)/g)) {
  taskChapter.set(m[1], Number(m[2]));
}

// ---- which file is which chapter -----------------------------------------
// The chapters that carry their own cast, one file each — plus npc.js, which
// carries TWO.
//
// This table read "environment.js and npc.js hold Sydney's and Pasto's, and
// neither of those crowds uses this system", and it was true for thirty-five
// versions: `npcLINES` was a flat table of strings that no gate touched, so the
// two chapters with the most tasks in the game were the two nobody audited
// because there was nothing in them to audit. v36 gave `pickLine` the same
// `localResolve` every other chapter's pool goes through, so npc.js is in the
// table now — as a SET, because a Sydney commuter and a Pasto stallholder are
// both in that file and both are right.
const FILE_CHAPTER = {
  'npc.js': [1, 2],
  'quay.js': 3, 'kyoto.js': 4, 'cali.js': 5, 'rio.js': 6, 'iceland.js': 7,
  'sahara.js': 8, 'drift.js': 9, 'venice.js': 10, 'kowloon.js': 11,
  'palawan.js': 12, 'goreme.js': 13, 'manly.js': 14, 'pantanal.js': 15,
  'cave.js': 16, 'antarctic.js': 17, 'monaco.js': 18, 'hanoi.js': 19,
};
/** True if `ch` is one of the chapters this file's cast is allowed to name. */
const chapterOk = (want, ch) => Array.isArray(want) ? want.includes(ch) : want === ch;
// A CHAPTER WITH NO CONDITIONAL LINE AT ALL IS A FINDING, NOT A PASS. This
// audit checks that every `after:`/`before:` names a real task in the right
// chapter, and for eighteen months the way to score zero on it was to have no
// such lines — which is exactly what chapters 18 and 19 shipped with, while
// they were also missing from the table above and so were not read at all.
// Green has to mean the people react to what you have done.
const MIN_CONDITIONAL = 6;

let bad = 0, warn = 0, total = 0;
const perFile = [];
// ...AND PER CHAPTER, NOT PER FILE, FOR THE ONE FILE THAT HOLDS TWO. A floor
// counted over npc.js as a whole would let Sydney's nineteen tasks carry Pasto
// entirely: thirty-nine lines, none of them in the plaza, and a clean run.
const perChapter = new Map();
for (const f of readdirSync(SRC).sort()) {
  if (!f.endsWith('.js')) continue;
  const src = readFileSync(join(SRC, f), 'utf8');
  const want = FILE_CHAPTER[f];
  let n = 0;
  for (const m of src.matchAll(/\b(after|before):\s*'([^']+)'/g)) {
    const key = m[1], id = m[2];
    // The placeholder in the four doc comments that explain the system.
    if (id === 'task-id') continue;
    total++; n++;
    if (!taskChapter.has(id)) {
      console.log('BLOCKER  ' + f + ': ' + key + ": '" + id + "' is not a task id");
      bad++;
      continue;
    }
    const ch = taskChapter.get(id);
    perChapter.set(ch, (perChapter.get(ch) || 0) + 1);
    if (want !== undefined && !chapterOk(want, ch)) {
      console.log('WARN     ' + f + ' (ch' + want + '): ' + key + ": '" + id +
                  "' belongs to chapter " + ch);
      warn++;
    }
  }
  if (n) perFile.push(f.replace('.js', '') + ' ' + n);
}

console.log('\nconditional lines: ' + total);
console.log(perFile.join(' · '));
// EVERY chapter with its own cast, not a hand-kept list of the ones that were
// once fixed. The old list named four — the ones the Delight Pass wave three
// closed — which is why chapters 18 and 19 could ship with none and score a
// clean run: they were not on the list, and they were not in FILE_CHAPTER
// either, so nothing looked at them at all.
const perFileN = new Map(perFile.map(s => {
  const i = s.lastIndexOf(' ');
  return [s.slice(0, i) + '.js', Number(s.slice(i + 1))];
}));
for (const f of Object.keys(FILE_CHAPTER)) {
  const want = FILE_CHAPTER[f];
  // A file that names two chapters is scored per chapter — see the note by
  // `perChapter`. A file that names one is scored on its own count, exactly
  // as before, because for those two numbers are the same number.
  const parts = Array.isArray(want) ? want : null;
  const n = parts ? null : (perFileN.get(f) || 0);
  const scores = parts ? parts.map(c => [c, perChapter.get(c) || 0]) : [[want, n]];
  for (const [ch, cn] of scores) {
    if (cn === 0) {
      console.log('BLOCKER  ' + f + ' (ch' + ch +
                  ') has NO conditional lines — nobody there reacts to what you have done');
      bad++;
    } else if (cn < MIN_CONDITIONAL) {
      console.log('WARN     ' + f + ' (ch' + ch + ') has only ' + cn +
                  ' conditional lines, under the ' + MIN_CONDITIONAL + ' floor');
      warn++;
    }
  }
}
// ---- THE FIRST WALK'S EIGHT LINES (ROADMAP-WOW2, T) ------------------------
// `sysTUT_LINES` in systems.js is the one pool that is not in npc.js or a
// chapter file, so it is read here by name: exactly eight, each in the
// game's lower-case voice (a key name may be a capital: W, A, S, D, Shift,
// Space, Q, E, Tab, C), each naming the key it teaches, none over the pill's
// one breath (80 characters), none said twice. qa/l6-tics.mjs reads the same
// literals for the three-file ceiling, since it scans every file.
const sysSrc = readFileSync(join(SRC, 'systems.js'), 'utf8');
const tutBlock = sysSrc.match(/const sysTUT_LINES = \[([\s\S]*?)\n\];/);
if (!tutBlock) { console.log('BLOCKER  systems.js: sysTUT_LINES not found'); bad++; }
else {
  const KEYS = { move: /\bW, A, S, D\b/, run: /\bShift\b/, hop: /\bSpace\b/, wheek: /\bQ\b/, take: /\bE\b/,
                 paper: /\bTab\b/, look: /\bdrag\b|\bC\b/, door: /\bboard\b/ };
  const lines = [...tutBlock[1].matchAll(/\{\s*key:\s*'([^']+)',\s*line:\s*'([^']*)'/g)].map((m) => [m[1], m[2]]);
  if (lines.length !== 8) { console.log('BLOCKER  sysTUT_LINES: ' + lines.length + ' lines, not eight'); bad++; }
  const seen = new Set();
  for (const [key, line] of lines) {
    const re = KEYS[key];
    if (!re) { console.log('BLOCKER  sysTUT_LINES: unknown beat "' + key + '"'); bad++; continue; }
    if (!re.test(line)) { console.log('BLOCKER  sysTUT_LINES ' + key + ': does not name its key: ' + line); bad++; }
    if (/^[A-Z]/.test(line) && !/^(W, A|Shift|Space|Q\.|E |Tab|C )/.test(line)) { console.log('BLOCKER  sysTUT_LINES ' + key + ': starts with a capital that is not a key'); bad++; }
    if (line.length > 80) { console.log('BLOCKER  sysTUT_LINES ' + key + ': ' + line.length + ' characters, over the breath'); bad++; }
    if (seen.has(line)) { console.log('BLOCKER  sysTUT_LINES ' + key + ': said twice'); bad++; }
    seen.add(line);
  }
  console.log('the first walk: ' + lines.length + ' lines, each naming its key');
}

console.log('\n' + bad + ' blockers, ' + warn + ' warnings');
process.exit(bad ? 1 : 0);
