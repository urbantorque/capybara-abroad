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
               act: Number(/act:\s*(\d+)/.exec(m[3])?.[1] || 1),
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

// ---- 7a. the souvenirs, and the shape of each chapter (v18) --------------
// One `keep` per chapter, no exceptions: the shelf is seventeen slots wide and
// a table cannot be missing a rung. And if a chapter declares `acts`, the acts
// its tasks actually use have to be exactly the acts it declared — an act with
// nothing in it never opens, and a task in an act the chapter never announces
// is a row that silently disappears off the paper.
const chapRows = chapBlock.split(/\n  \{ n: /).slice(1);
const chapMeta = {};
for (const row of chapRows) {
  const n = Number(/^(\d+)/.exec(row)?.[1]);
  if (!n) continue;
  const actsRaw = /acts:\s*\[([\s\S]*?)\n    \]/.exec(row)?.[1] || '';
  chapMeta[n] = {
    keep: /keep:\s*'([^']*)'/.exec(row)?.[1] || null,
    win: Number(/win:\s*(\d+)/.exec(row)?.[1] || 0),
    acts: actsRaw ? [...actsRaw.matchAll(/\{\s*kick:\s*'([^']*)',\s*line:\s*'([^']*)'/g)].map(x => x[1]) : [],
  };
}
for (const c of chapNs) {
  const meta = chapMeta[c.n] || {};
  const list = byChap[c.n] || [];
  if (!meta.keep) P('BLOCKER', 'chapter ' + c.n + ' (' + c.biome + ')', 'has no `keep` — nothing to take away from it');
  if (meta.win && (meta.win < 1 || meta.win > 8)) P('BLOCKER', 'chapter ' + c.n, 'win ' + meta.win + ' is outside 1..8');
  const used = [...new Set(list.map(t => t.act))].sort((a, b) => a - b);
  const declared = (meta.acts || []).length;
  if (!declared) {
    if (used.some(a => a !== 1)) P('BLOCKER', 'chapter ' + c.n + ' (' + c.biome + ')',
      'tasks carry act ' + used.join('/') + ' but the chapter declares no `acts`');
  } else {
    if (declared < 2) P('BLOCKER', 'chapter ' + c.n, 'declares ' + declared + ' act — an act structure needs at least 2');
    for (let a = 1; a <= declared; a++) {
      if (!used.includes(a)) P('BLOCKER', 'chapter ' + c.n + ' (' + c.biome + ')', 'act ' + a + ' is declared but has no tasks in it');
    }
    for (const a of used) {
      if (a > declared) P('BLOCKER', 'chapter ' + c.n + ' (' + c.biome + ')', 'a task is in act ' + a + ' but only ' + declared + ' acts are declared');
    }
    // The arrival is act one by definition: you cannot turn up in act two.
    const arr = [...chapBlock.matchAll(/\{ n: (\d+),[\s\S]*?arrive:\s*'([a-z0-9-]*)'/g)];
    const mine = arr.find(x => Number(x[1]) === c.n)?.[2];
    if (mine) {
      const t = list.find(x => x.id === mine);
      if (t && t.act !== 1) P('BLOCKER', mine, 'the arrival task is in act ' + t.act + ', must be act 1');
    }
    // A `wow` in the FIRST act of a multi-act chapter means the chapter peaks
    // before it starts. That is a warning, not a blocker — Marrakech peaks on
    // the dune and ends round a fire on purpose.
    const w = list.find(t => t.wow);
    if (w && w.act === 1) P('WARN', 'chapter ' + c.n + ' (' + c.biome + ')', 'the marquee is in act 1 of ' + declared);
  }
}

// ---- 7c. the finds (v19) -------------------------------------------------
// A find with no predicate can never happen; a predicate with no find can
// never be shown. Both are silent failures, which is exactly the kind of thing
// a table is supposed to make impossible.
const findsBlock = shared.slice(shared.indexOf('export const FINDS = ['),
                                shared.indexOf('\n];', shared.indexOf('export const FINDS = [')));
const findIdsDecl = [...findsBlock.matchAll(/\{\s*id:\s*'([^']+)'\s*,\s*text:\s*'([^']*)'/g)].map(x => x[1]);
console.log('FINDS parsed:', findIdsDecl.length);
const findPreds = new Set(
  [...systems.slice(systems.indexOf('const sysFINDS = {'),
                    systems.indexOf('\n  };', systems.indexOf('const sysFINDS = {')))
    .matchAll(/^\s*'([a-z0-9-]+)':\s*function/gm)].map(x => x[1]));
for (const id of findIdsDecl) {
  if (!findPreds.has(id)) P('BLOCKER', id, 'FINDS row with no sysFINDS predicate — can never happen');
}
for (const id of findPreds) {
  if (!findIdsDecl.includes(id)) P('BLOCKER', id, 'sysFINDS predicate with no FINDS row — can never be shown');
}
// A find id may not collide with a task id: both live in the same save file and
// the same journal, and the ledger looks both up by name.
for (const id of findIdsDecl) {
  if (ids.has(id)) P('BLOCKER', id, 'find id collides with a task id');
}
// ...and no find may be advertised. If it is on the paper it is a task.
if (findIdsDecl.some(id => hintIds.has(id))) P('BLOCKER', 'finds', 'a find has a hint row — finds are never pointed at');

// ---- 7d. a find may belong to a place (v20) ------------------------------
// `chapter: n` means the predicate is only swept in chapter n, so a wrong
// number does not throw and does not warn — it produces a find that can never
// be met, in silence, which is the worst failure this table has.
//
// NOTE ON THE PARSE ABOVE: findIdsDecl requires `id` immediately followed by
// `text`. Any field added to a row must therefore go AFTER `text`, or the row
// stops existing as far as every check in 7c is concerned. This block re-parses
// each row whole so the two can never disagree about how many rows there are.
const findRows = [...findsBlock.matchAll(
  /\{\s*id:\s*'([^']+)'\s*,\s*text:\s*'((?:[^'\\]|\\.)*)'([^}]*)\}/g)].map(m => {
  const tail = m[3] || '';
  const ch = /\bchapter:\s*(\d+)/.exec(tail);
  const wh = /\bwhere:\s*'((?:[^'\\]|\\.)*)'/.exec(tail);
  return { id: m[1], text: m[2], chapter: ch ? Number(ch[1]) : 0, where: wh ? wh[1] : null };
});
if (findRows.length !== findIdsDecl.length) {
  P('BLOCKER', 'finds', 'row parse disagrees: ' + findRows.length + ' whole rows vs ' +
    findIdsDecl.length + ' id/text pairs — a field was inserted between id and text');
}
const chapMaxN = Math.max(...chapNs.map(c => c.n));
const findPerChap = Object.create(null);
for (const r of findRows) {
  if (!r.chapter) continue;
  if (!Number.isInteger(r.chapter) || r.chapter < 1 || r.chapter > chapMaxN) {
    P('BLOCKER', r.id, 'chapter ' + r.chapter + ' is not a chapter (1..' + chapMaxN + ') — swept nowhere');
    continue;
  }
  if (!chapNs.some(c => c.n === r.chapter)) {
    P('BLOCKER', r.id, 'chapter ' + r.chapter + ' has no CHAPTERS row — swept nowhere');
    continue;
  }
  findPerChap[r.chapter] = (findPerChap[r.chapter] || 0) + 1;
}
// A `where` line only earns its place if it differs from the toast.
for (const r of findRows) {
  if (r.where !== null && r.where === r.text) {
    P('WARN', r.id, 'where is identical to text — drop it');
  }
}
// The pass's own progress meter, and the ceiling that keeps a find rare.
for (const c of chapNs) {
  const n = findPerChap[c.n] || 0;
  if (n === 0) P('WARN', 'chapter ' + c.n + ' (' + c.biome + ')', 'no find of its own — nothing here can be found, only completed');
  else if (n > 3) P('WARN', 'chapter ' + c.n + ' (' + c.biome + ')', n + ' place finds — a find is supposed to be rare');
}
console.log('FINDS: ' + findRows.filter(r => !r.chapter).length + ' anywhere, ' +
            findRows.filter(r => r.chapter).length + ' of a place, over ' +
            Object.keys(findPerChap).length + ' of ' + chapNs.length + ' chapters');

// ---- 7b. every souvenir has a glyph --------------------------------------
for (const c of chapNs) {
  if (!new RegExp('\\n  ' + c.biome + ':\\s*\\{\\s*s:').test(systems.slice(systems.indexOf('const sysKEEPS')))) {
    P('WARN', c.biome, 'no sysKEEPS entry — the shelf slot draws empty');
  }
}

// ---- 7. every lift row present ------------------------------------------
const liftN = (systems.match(/\n    lift:\s*\{/g) || []).length;
const palN = (systems.match(/\n  \{ chords: sysMUS_CHORDS/g) || []).length;
if (liftN !== palN) P('WARN', 'music', 'lift rows ' + liftN + ' != palettes ' + palN);

// ---- 8. THE FINALE FIXTURE IS NOT ALLOWED TO GO STALE -------------------
// `qa/all-task-ids.json` is the save every finale script writes to reach the
// ending — pf2-finale.js, pf2-finale2.js and pf2-finshot.js all fetch it and
// none of them checks it. When chapters 18 and 19 shipped it stayed at 199 of
// 229 ids, so `sysFinaleAll()` was false for a fortnight and every one of
// those scripts was quietly exercising a finale THAT CANNOT TRIGGER: the lawn
// stages nothing, the ledger never opens, and the run still reports whatever
// it happened to measure. Found by the closeout, from `keeps: 0`.
//
// Regenerate with the one-liner in qa/CLOSEOUT.md, in the same commit as any
// task table change.
try {
  const fixture = JSON.parse(readFileSync('qa/all-task-ids.json', 'utf8'));
  const ids = tasks.map(t => t.id);
  const missing = ids.filter(i => !fixture.includes(i));
  const extra = fixture.filter(i => !ids.includes(i));
  if (missing.length) P('BLOCKER', 'all-task-ids', missing.length +
      ' task ids missing from qa/all-task-ids.json (' + missing.slice(0, 4).join(', ') +
      (missing.length > 4 ? ', …' : '') + ') — every finale script is testing an ending that cannot fire');
  if (extra.length) P('WARN', 'all-task-ids', extra.length +
      ' ids in qa/all-task-ids.json that no task has any more (' + extra.slice(0, 4).join(', ') + ')');
} catch (e) {
  P('BLOCKER', 'all-task-ids', 'qa/all-task-ids.json is missing or unreadable — ' + e.message);
}

// ---- 8. the records: a live line each, and a par where one is defensible ---
//
// TWO DIFFERENT KINDS OF FINDING, so they are two different severities.
//
// A record with no `recordLive` caller is a BLOCKER-shaped hole in the one
// surface the game has for replay: the block that draws the line says so
// itself — "a player attempting one of the measured tasks is running against an
// invisible target". Twenty-one of fifty-three were in that state before v36.
//
// A record with no `par` is REPORTED AND NOT FAILED. Thirteen of them have no
// figure anywhere in the source to derive one from, and a par nobody can defend
// is worse than no par at all — so this counts and names them rather than
// pretending the gap is a bug. If the number ever drops to zero, delete the
// branch; if it grows, somebody added a record without thinking about what a
// good one looks like.
{
  const recBlock = shared.slice(shared.indexOf('export const RECORDS = {'),
                                shared.indexOf('\n};', shared.indexOf('export const RECORDS = {')));
  const recs = [...recBlock.matchAll(/^\s*'([a-z0-9-]+)':\s*\{([^}]*)\}/gm)]
    .map(x => ({ id: x[1], par: /\bpar:\s*[-0-9.]+/.test(x[2]) }));
  // Every chapter wraps recordLive in its own helper — antLive, hanLive,
  // driRecordLive — so the test is any identifier ending in "Live" (or
  // recordLive itself) called with this id as a literal.
  const liveRe = id => new RegExp('[A-Za-z_]*[Ll]ive\\s*\\(\\s*[\'"]' + id + '[\'"]');
  const noLive = [], noPar = [];
  for (const r of recs) {
    if (!files.some(f => liveRe(r.id).test(all[f]))) noLive.push(r.id);
    if (!r.par) noPar.push(r.id);
  }
  if (noLive.length) P('BLOCKER', 'records-live', noLive.length + ' of ' + recs.length +
    ' records never call recordLive, so nothing is on screen while they are being set (' +
    noLive.join(', ') + ')');
  console.log('RECORDS parsed: ' + recs.length + ' — ' + (recs.length - noLive.length) +
              ' with a live line, ' + (recs.length - noPar.length) + ' with a par' +
              (noPar.length ? '\n  no par (no figure in the source to derive one from): ' +
                              noPar.join(', ') : ''));
}

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
