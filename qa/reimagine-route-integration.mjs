// REIMAGINE B: authored data wired into shipped travel and finale decisions.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripComments } from '../strip-comments.mjs';

const shared = readFileSync('src/shared.js', 'utf8');
const data = vm.runInNewContext(shared.slice(shared.indexOf('export const TASKS ='),
  shared.indexOf('// RECORDS —')).replace(/^export /gm, '') +
  '\n({TASKS,CHAPTERS,JOURNEY,CHAPTER_EXPERIENCES,chapterExperience,chapterDef})');
const source = stripComments(readFileSync('src/systems.js', 'utf8'));
function fn(name) {
  const at = source.indexOf('function ' + name + '(');
  assert.ok(at >= 0, name);
  const start = source.indexOf('{', at);
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(at, i + 1);
  }
  throw Error('unclosed ' + name);
}
const taskRec = Object.fromEntries(data.TASKS.map(t => [t.id, { done: false, def: t }]));
const chapRec = Object.fromEntries(data.CHAPTERS.map(c => [c.n,
  { ids: data.TASKS.filter(t => t.chapter === c.n).map(t => t.id) }]));
const staged = [], played = [], captions = [], timers = [];
const f = vm.createContext({ ...data, taskRec, chapRec, chapMax: 19, sysCHAP_ENOUGH: .7,
  wowOfChapter: n => data.TASKS.find(t => t.chapter === n && t.wow),
  chapterOf: biome => data.CHAPTERS.find(c => c.biome === biome)?.n || 1,
  clamp: (n, lo, hi) => Math.max(lo, Math.min(hi, n)), musProg: 0,
  game: { state: {}, physics: { stageKeep: (...a) => staged.push(a) }, events: { emit() {} } },
  sysFIN_GAP: 1.75, sysFIN_X: 30, sysFIN_Z: 26, sysFIN_R: 2.6,
  sysFinOpen: 0, sysFinStaged: false,
  ac: { currentTime: 0 }, musCurChord: [0, 4, 7], musVol: {}, musMuted: false,
  sysFinCodaN: 0, sysFinCodaTune: [], sysFinCodaPitch: [],
  musThemeBase: () => 60, musThemeNotes: () => Array.from({ length: 20 }, (_, i) => [i, 1]),
  musCodaChords() {}, musSnap: t => t, musDegOff: i => i, musOcaBase: () => 60,
  musLiftNote: (...args) => played.push(args), sysMUS_PAL: [{ lead: 'test' }],
  sysROUTE_LL: {}, sysFIN_CODA_BEAT: .22, sysFIN_NOTE_GAP: .34, sysMUS_OCA_VEL: .14,
  sysFIN_HUSH: 2.6, codaHideT: 0,
  codaEl: { textContent: '', appendChild(n) { if (n.kind === 'place') captions.push(n.text); }, classList: { add() {} } },
  document: { createTextNode: text => ({ kind: 'place', text }), createElement: () => ({}) },
  setTimeout: callback => timers.push(callback),
});
for (const name of ['chapComplete', 'chapLegacyNeed', 'chapExperience', 'chapNeed',
  'sysWayNeed', 'chapEnough', 'keepHeld', 'jrOpen', 'journeyNext', 'sysFinaleAll',
  'sysFinaleKeeps', 'sysFinaleFull', 'sysFinaleStage', 'sysFinaleCoda', 'musProgSet']) vm.runInContext(fn(name), f);
const reset = () => { for (const r of Object.values(taskRec)) r.done = false; staged.length = 0; };
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
check(Array.from({ length: 19 }, (_, i) => f.jrOpen(i + 1)).every(Boolean), 'all destinations open on empty save');
check(!f.jrOpen(0) && !f.jrOpen(20) && !f.jrOpen('1'), 'invalid destinations rejected');
check(f.journeyNext(1) === 3, 'harbour before flight');
check(!f.sysFinaleAll(), 'empty file cannot finish');
for (const n of data.JOURNEY) {
  const e = data.CHAPTER_EXPERIENCES[n];
  taskRec[e.signature].done = true;
  taskRec[e.supports[0]].done = true;
  check(!f.chapEnough(n), 'one support cannot earn memory ' + n);
  taskRec[e.supports[1]].done = true;
  check(f.chapEnough(n) && f.keepHeld(n), 'authored memory earns keepsake ' + n);
  check(!f.chapComplete(n), 'optional tasks stay optional ' + n);
  f.game.biome = { current: data.chapterDef(n).biome };
  f.musProgSet();
  check(f.musProg === 1, 'authored memory completes musical development ' + n);
}
check(f.sysFinaleAll() && !f.sysFinaleFull(), 'seven-place partial route earns ordinary ending');
check(f.journeyNext(19) === 1, 'last route place points home');
f.sysFinaleStage();
check(staged.length === 6, 'six physical souvenirs plus Pantanal empty place');
check(!staged.some(a => a[0] === 'pantanal'), 'no phantom Pantanal prop');
check(new Set(staged.map(a => a[1] + ',' + a[2])).size === 6, 'souvenirs occupy distinct slots');
f.sysFinaleCoda();
for (const timer of timers) timer();
check(played.length === 20, 'full twenty-note musical phrase preserved');
const expected = new Set(data.JOURNEY.map(n => data.chapterDef(n).name));
check(captions.length === 19 && captions.every(n => expected.has(n)), 'coda never names an unearned trip');
check(new Set(captions).size === 7, 'every earned route place is recalled');
reset();
// An old quota-qualified file must never lose a memory under the new choice set.
for (let n = 1; n <= 19; n++) {
  reset();
  const signature = data.TASKS.find(t => t.chapter === n && t.wow);
  taskRec[signature.id].done = true;
  const other = chapRec[n].ids.filter(id => id !== signature.id);
  for (const id of other.slice(0, f.chapLegacyNeed(n) - 1)) taskRec[id].done = true;
  check(f.chapEnough(n), 'legacy quota remains qualified ' + n);
}
reset();
for (const r of Object.values(taskRec)) r.done = true;
check(f.sysFinaleAll() && f.sysFinaleFull(), 'all-task save retains completionist ending');
check(f.sysFinaleKeeps().length === 19, 'earned optional trips included');
console.log('REIMAGINE route integration: ' + checks + ' decisions passed. Browser travel remains separate.');
