// Authored memory routes and act thresholds, executed from shared.js.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripComments } from '../strip-comments.mjs';
const source = readFileSync('src/shared.js', 'utf8');
const a = source.indexOf('export const TASKS ='), b = source.indexOf('// RECORDS —', a);
const data = vm.runInNewContext(source.slice(a, b).replace(/^export /gm, '') +
  '\n({TASKS,CHAPTERS,JOURNEY,chapterDef,chapterExperience,HOMECOMING_ACTS,HOMECOMING_EXPERIENCES,homecomingMemory,homecomingProgress})');
const { TASKS, CHAPTERS, HOMECOMING_ACTS: acts, HOMECOMING_EXPERIENCES: defs,
  homecomingMemory: memory, homecomingProgress: progress } = data;
const tasks = new Map(TASKS.map(t => [t.id, t]));
let checks = 0;
function check(ok, label) { assert(ok, label); checks++; }
check(Object.keys(defs).length === 19, 'all places have authored routes');
for (const chapter of CHAPTERS) {
  const n = chapter.n, d = defs[n], ids = [d.signature, d.alternative, ...d.supports];
  check(new Set(ids).size === ids.length, 'distinct actions: ' + n);
  check(tasks.get(d.signature)?.wow, 'signature remains marquee: ' + n);
  for (const id of ids) check(tasks.get(id)?.chapter === n && id !== chapter.arrive, 'action belongs here, never arrival: ' + id);
  for (let bits = 0; bits < 2 ** ids.length; bits++) {
    const done = new Set(ids.filter((_, i) => bits & (1 << i)));
    const m = memory(n, id => done.has(id));
    const expected = !!(bits & 3) && !!(bits >> 2);
    check(m.enough === expected, 'either core plus a distinct supporting action: ' + n + '/' + bits);
    check(m.supportMissing === ((bits >> 2) ? 0 : 1), 'one support, never two required');
    check(m.coreDone === !!(bits & 3), 'alternative satisfies core without pretending signature done');
  }
  const empty = memory(n, () => false); empty.supports.length = 0; empty.supportOpen.length = 0;
  check(memory(n, () => false).supports.length === d.supports.length, 'returned choices do not mutate authorship');
}
const done = new Set(), isDone = id => done.has(id);
function earn(n) { done.add(defs[n].alternative); done.add(defs[n].supports[0]); }
check(progress(isDone).open.join(',') === '1', 'fresh story starts only in Sydney');
earn(1);
check(progress(isDone).open.join(',') === '1,3,14', 'first memory opens the coast');
for (let i = 0; i < acts.length; i++) {
  if (i) earn(acts[i].places[0]);
  const before = progress(isDone);
  check(before.actIndex === i && !before.ready, 'one memory cannot open next act: ' + i);
  earn(acts[i].places[1]);
  const after = progress(isDone);
  check(after.actIndex === Math.min(4, i + 1), 'two memories open next act: ' + i);
  check(after.ready === (i === 4), 'homecoming requires two in every act');
  check(before.open.every(n => after.open.includes(n)), 'earned destinations never relock');
}
check(progress(isDone).open.length === 19, 'all nineteen eventually open');
check(acts.reduce((sum, act) => sum + act.places.filter(n => memory(n, isDone).enough).length, 0) === 10,
  'homecoming needs ten memories, not nineteen clears');
done.delete(defs[1].alternative);
check(progress(isDone).open.join(',') === '1' && !progress(isDone).ready, 'future-task fixture cannot skip Sydney prerequisite');
for (const n of [0, 20, -1, NaN, '1', 'constructor']) check(memory(n, () => true) === null, 'invalid chapter rejected');
console.log('Homecoming story: ' + checks + ' checks passed; nineteen alternatives and five earned acts.');

const systems = stripComments(readFileSync('src/systems.js', 'utf8'));
function fn(name) {
  const at = systems.indexOf('function ' + name + '('), open = systems.indexOf('{', at);
  assert(at >= 0); let depth = 0;
  for (let i = open; i < systems.length; i++) {
    if (systems[i] === '{') depth++;
    if (systems[i] === '}' && --depth === 0) return systems.slice(at, i + 1);
  }
  throw Error('missing body: ' + name);
}
const taskRec = Object.fromEntries(TASKS.map(t => [t.id, { def: t, done: false }]));
const t = vm.createContext({ ...data, taskRec,
  chapRec: Object.fromEntries(CHAPTERS.map(c => [c.n, { ids: TASKS.filter(t => t.chapter === c.n).map(t => t.id) }])),
  game: { state: { journeyMode: 'story', homecomingArc: true } }, chapMax: 19,
  doneCount: 0, homeProgressN: -1, homeProgressCache: null, sysCHAP_ENOUGH: .7,
  wowOfChapter: n => TASKS.find(t => t.chapter === n && t.wow) });
for (const name of ['chapComplete', 'chapLegacyNeed', 'chapExperience', 'chapNeed', 'sysWayNeed', 'chapEnough',
  'keepHeld', 'jrOpen', 'journeyProgress', 'journeyNext', 'sysFinaleAll', 'sysFinaleKeeps']) vm.runInContext(fn(name), t);
const integratedBefore = checks;
function award(id) { if (!taskRec[id].done) { taskRec[id].done = true; t.doneCount++; } }
const opened = () => CHAPTERS.filter(c => t.jrOpen(c.n)).map(c => c.n);
check(opened().join(',') === '1' && t.journeyNext(1) === 1, 'shipped fresh story cannot recommend a locked place');
check(t.chapNeed(1) === 2 && t.sysWayNeed(1) === 2, 'shipped guidance asks for two distinct actions');
const cached = t.journeyProgress();
check(t.journeyProgress() === cached, 'repeated door checks reuse the projection');
award('steal-hat'); award('picnic-thief');
check(t.keepHeld(1) && t.chapEnough(1) && t.sysWayNeed(1) === 0, 'shipped memory accepts gentler route');
check(!t.chapExperience(1).signatureDone, 'signature stays genuinely unearned');
check(t.journeyProgress() !== cached, 'completed task invalidates projection');
check(opened().join(',') === '1,3,14' && t.journeyNext(1) === 3, 'shipped first recommendation stays on coast');
for (const act of acts) for (const n of act.places.slice(0, 2)) {
  award(defs[n].alternative); award(defs[n].supports[0]);
}
check(t.sysFinaleAll() && t.sysFinaleKeeps().length === 10, 'shipped finale accepts ten earned memories');
check(new Set(t.sysFinaleKeeps()).size === 10, 'no duplicated keepsakes');
const kept = t.sysFinaleKeeps().join(',');
t.game.state.journeyMode = 'free';
check(opened().length === 19 && t.sysFinaleKeeps().join(',') === kept, 'free-roam switch retains all earned memories');
t.game.state.homecomingArc = false;
check(opened().length === 19 && t.chapNeed(1) === 3, 'legacy retains open world and original memory rule');
award('opera-stage');
check(t.chapEnough(1) && t.keepHeld(1), 'legacy signature and two supports still work');
console.log('Homecoming shipped integration: ' + (checks - integratedBefore) + ' checks passed.');
