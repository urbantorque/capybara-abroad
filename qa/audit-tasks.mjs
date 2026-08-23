// Structural audit of all 91 tasks: does each one have a way to be completed,
// and a way to be found?
import { readFileSync, readdirSync } from 'node:fs';

const shared = readFileSync('src/shared.js', 'utf8');
const systems = readFileSync('src/systems.js', 'utf8');
const files = readdirSync('src').filter(f => f.endsWith('.js'));
const all = Object.fromEntries(files.map(f => [f, readFileSync('src/' + f, 'utf8')]));

// ---- parse TASKS ---------------------------------------------------------
const tasksBlock = shared.slice(shared.indexOf('export const TASKS = ['),
                                shared.indexOf('\n];', shared.indexOf('export const TASKS = [')));
const tasks = [];
const re = /\{\s*id:\s*'([^']+)'[^}]*?chapter:\s*(\d+)([^}]*)\}/g;
let m;
while ((m = re.exec(tasksBlock))) {
  tasks.push({ id: m[1], chapter: Number(m[2]),
               wow: /wow:\s*'([^']+)'/.exec(m[3])?.[1] || null,
               mini: /mini:\s*'([^']+)'/.exec(m[3])?.[1] || null });
}
console.log('TASKS parsed:', tasks.length);

// ---- parse the hint table -----------------------------------------------
const hintIds = new Set();
// Keys are quoted only when they contain a hyphen, so both forms must be read.
const hre = /^\s*'?([a-zA-Z0-9-]+)'?:\s*\{\s*(?:clue|where)/gm;
while ((m = hre.exec(systems))) hintIds.add(m[1]);
console.log('hint rows parsed:', hintIds.size);

const arrivalSet = new Set([...shared.slice(shared.indexOf('export const CHAPTERS = ['))
  .matchAll(/arrive:\s*'([a-z0-9-]*)'/g)].map(x => x[1]).filter(Boolean));
const problems = [];
const P = (sev, id, msg) => problems.push({ sev, id, msg });

// ---- 1. can every task be completed? ------------------------------------
// Every biome wraps completeTask in a local helper (kyoTask, venTask, ...), so
// the honest test is "does this id appear as a string literal anywhere outside
// the tables that merely declare it".
for (const t of tasks) {
  let sites = 0;
  for (const [f, src] of Object.entries(all)) {
    if (f === 'shared.js') continue;
    const lit = new RegExp("'" + t.id.replace(/[-]/g, '\\-') + "'", 'g');
    let mm, n = 0;
    while ((mm = lit.exec(src))) n++;
    // the hint table in systems.js declares the id but does not complete it
    if (f === 'systems.js') n -= (hintIds.has(t.id) ? 1 : 0);
    sites += Math.max(0, n);
  }
  // The arrival tasks are completed through CHAPTERS.arrive by variable
  // (completeTask(cdef.arrive)), never by literal, so a literal search cannot
  // see them. Verified separately by the arrivals check below.
  if (sites === 0 && !arrivalSet.has(t.id)) P('BLOCKER', t.id, 'never referenced outside shared.js — cannot be completed');
}

// ---- 2. does every task tell the player where to go? --------------------
for (const t of tasks) {
  if (!hintIds.has(t.id)) P('WARN', t.id, 'no hint/clue row — player gets no pointer');
}
// and the reverse: a hint for a task that no longer exists
const ids = new Set(tasks.map(t => t.id));
for (const h of hintIds) if (!ids.has(h)) P('WARN', h, 'hint row for a task that is not in TASKS');

// ---- 3. chapters ---------------------------------------------------------
const chapBlock = shared.slice(shared.indexOf('export const CHAPTERS = ['));
const chapNs = [...chapBlock.matchAll(/\{\s*n:\s*(\d+),\s*biome:\s*'([a-z]+)'/g)].map(x => ({ n: Number(x[1]), biome: x[2] }));
console.log('CHAPTERS parsed:', chapNs.length);
const byChap = {};
for (const t of tasks) (byChap[t.chapter] = byChap[t.chapter] || []).push(t);
for (const c of chapNs) {
  const list = byChap[c.n] || [];
  if (!list.length) P('BLOCKER', 'chapter ' + c.n, 'has no tasks at all');
  const wows = list.filter(t => t.wow);
  if (wows.length !== 1) P('BLOCKER', 'chapter ' + c.n + ' (' + c.biome + ')',
    'has ' + wows.length + ' wow tasks, must be exactly 1');
  // ONE OR TWO MINIS. The scarcity is the mechanism, one rung down from the
  // banner: see the `mini` note in shared.js. Zero means a chapter with no
  // middle rung at all; three would make the middle rung the floor.
  const minis = list.filter(t => t.mini);
  if (minis.length < 1 || minis.length > 2) P('BLOCKER', 'chapter ' + c.n + ' (' + c.biome + ')',
    'has ' + minis.length + ' mini tasks, must be 1 or 2');
  // and no row may carry both — they are different in kind, not in size
  for (const t of list) if (t.wow && t.mini) P('BLOCKER', t.id, 'carries wow AND mini');
}
for (const k of Object.keys(byChap)) {
  if (!chapNs.some(c => c.n === Number(k))) P('BLOCKER', 'chapter ' + k, 'tasks exist but no CHAPTERS row');
}

// ---- 4. arrival tasks ----------------------------------------------------
const arrivals = [...chapBlock.matchAll(/arrive:\s*'([a-z0-9-]*)'/g)].map(x => x[1]).filter(Boolean);
for (const a of arrivals) if (!ids.has(a)) P('BLOCKER', a, 'CHAPTERS.arrive names a task not in TASKS');

// ---- 5. each biome module is in the build -------------------------------
const build = readFileSync('build.mjs', 'utf8');
for (const c of chapNs) {
  if (c.biome === 'sydney') continue;
  if (!build.includes("'src/" + c.biome + ".js'")) P('BLOCKER', c.biome, 'biome module missing from build.mjs ORDER');
}

// ---- 6. minimap coverage -------------------------------------------------
for (const c of chapNs) {
  if (!new RegExp('\\n  ' + c.biome + ':\\s*\\{').test(systems)) {
    P('WARN', c.biome, 'no sysMAP_WORLDS entry — no minimap in this chapter');
  }
}

// ---- 7. every lift row present ------------------------------------------
const liftN = (systems.match(/\n    lift:\s*\{/g) || []).length;
const palN = (systems.match(/\n  \{ chords: sysMUS_CHORDS/g) || []).length;
if (liftN !== palN) P('WARN', 'music', 'lift rows ' + liftN + ' != palettes ' + palN);

// ---- report --------------------------------------------------------------
console.log('');
const blockers = problems.filter(p => p.sev === 'BLOCKER');
const warns = problems.filter(p => p.sev === 'WARN');
for (const p of blockers) console.log('BLOCKER  ' + p.id.padEnd(22) + p.msg);
for (const p of warns) console.log('warn     ' + p.id.padEnd(22) + p.msg);
console.log('\n' + blockers.length + ' blockers, ' + warns.length + ' warnings, over ' +
            tasks.length + ' tasks in ' + chapNs.length + ' chapters (' +
            tasks.filter(t => t.wow).length + ' marquee, ' +
            tasks.filter(t => t.mini).length + ' mini)');
