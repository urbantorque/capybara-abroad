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
// Only the chapters that carry their own cast. environment.js and npc.js hold
// Sydney's and Pasto's, and neither of those crowds uses this system.
const FILE_CHAPTER = {
  'quay.js': 3, 'kyoto.js': 4, 'cali.js': 5, 'rio.js': 6, 'iceland.js': 7,
  'sahara.js': 8, 'drift.js': 9, 'venice.js': 10, 'kowloon.js': 11,
  'palawan.js': 12, 'goreme.js': 13, 'manly.js': 14, 'pantanal.js': 15,
  'cave.js': 16, 'antarctic.js': 17,
};

let bad = 0, warn = 0, total = 0;
const perFile = [];
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
    if (want !== undefined && ch !== want) {
      console.log('WARN     ' + f + ' (ch' + want + '): ' + key + ": '" + id +
                  "' belongs to chapter " + ch);
      warn++;
    }
  }
  if (n) perFile.push(f.replace('.js', '') + ' ' + n);
}

console.log('\nconditional lines: ' + total);
console.log(perFile.join(' · '));
// The five that had none. Named so that a regression is visible rather than
// merely absent — this is the list the Delight Pass wave three closed.
const CLOSED = ['quay.js', 'goreme.js', 'manly.js', 'pantanal.js'];
for (const f of CLOSED) {
  const src = readFileSync(join(SRC, f), 'utf8');
  if (!/\bafter:\s*'/.test(src)) {
    console.log('BLOCKER  ' + f + ' has no conditional lines at all again');
    bad++;
  }
}
console.log('\n' + bad + ' blockers, ' + warn + ' warnings');
process.exit(bad ? 1 : 0);
