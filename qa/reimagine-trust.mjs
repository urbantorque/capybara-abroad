// ROADMAP-REIMAGINE A: execute the shipped functions with small world/DOM
// doubles. These test decisions and state transitions, not source spellings.
// Browser input, persistence and rendered staging are a separate instrument.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripComments } from '../strip-comments.mjs';

const source = stripComments(readFileSync('src/systems.js', 'utf8'));
function fn(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'function exists: ' + name);
  const body = source.indexOf('{', start);
  let depth = 0;
  for (let i = body; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw Error('unterminated function: ' + name);
}
const noop = () => {};
const element = () => ({ textContent: '', hidden: false, classList: { add: noop, remove: noop },
  setAttribute: noop, focus: noop });
let checks = 0;
function check(label, test) { test(); checks++; console.log('pass  ' + label); }

const t = vm.createContext({
  sysHOME_UI: vm.runInNewContext('(' + source.match(/const sysHOME_UI = (\{[^]*?\n\});/)[1] + ')'),
  started: true, restore: false, doneCount: 0, jrFile: null, where: 'sydney',
  game: { state: {}, biome: { current: 'sydney' } },
  tutEver: false, tutArm: true, tutOn: true, tutDone: false, tutSkipped: false,
  tutBeat: 1, tutBeatT: 3, tutT: 12, tutWait: 0, tutEl: null, tutAim: {},
  tutWalk: 0, tutRunT: 0, tutYaw: 0, tutYawLast: NaN, tutBench: null,
  tutWheekN: 0, tutGrabN: 0, tutYuzuN: 0, tutTabN: 0, tutBumpN: 0,
  tutEndAt: -1, tutPill: '', tutHow: '', tutHitN: 0, tutSay: '', tutSayT: 0,
  tut0: { bump: 0 }, sysTUT_LINES: Array.from({ length: 8 }, () => ({ line: 'lesson' })),
  sysTUT_SHOP: 'shop', sysToastOut: noop, saves: 0,
  saveSoon() { t.saves++; }, sfx: noop,
  pauseShown: false, pausePre: false, pauseSetOpen: false,
  pauseTutReplay: element(), pauseTutSkip: element(), pauseFree: element(), pauseGo: element(),
  pauseOpeningReplay: element(), sysOpenFinish: null, sysOpenT: -1,
  pauseHead: element(), pauseFoot: element(), pauseCard: element(), pauseJrBtn: element(),
  pauseQuitBtn: element(), pauseSub: element(), pauseEl: element(),
  sysScheme: x => x, pauseSetToggle: noop, chapterDef: () => ({ name: 'Sydney' }), chapterOf: () => 1,
  jrCarriedMs: 0, startMs: 0, sysFmtTime: () => '0:00', pauseAskShut: noop,
  pauseSync: noop, uiSfx: noop, musDuck: noop, document: { activeElement: null, hidden: false },
  keys: {}, mouseAction: false, dragId: -1, sysPinchPts: new Map(), sysPinchD: 0,
  sysDragLastX: null, touchSlide: false, touchBack: false, touchLook: false, sysBufClearAll: noop,
  inputReleases: 0, sysInputRelease() { t.inputReleases++; }, // input behavior has its own extracted-helper probe
  pauseReturnFocus: null, jrShown: false, ledShown: false, albShown: false,
});
for (const name of ['tutLive', 'tutEnd', 'tutReplay', 'tutBeatClose', 'tutSkip', 'pauseShow', 'pauseHide']) {
  vm.runInContext(fn(name), t);
}
check('Pause preserves the active lesson and leaves the save unfinished', () => {
  t.pauseShow();
  assert.equal(t.game.state.paused, true);
  assert.equal(t.tutLive(), true); assert.equal(t.tutEver, false); assert.equal(t.tutBeat, 1);
  assert.equal(t.saves, 0); assert.equal(t.pauseTutSkip.hidden, false);
  assert.equal(t.inputReleases, 1, 'pause delegates input release without ending the lesson');
});
check('Resume returns to the same lesson and counters', () => {
  t.pauseHide();
  assert.equal(t.game.state.paused, false); assert.equal(t.tutBeatT, 3); assert.equal(t.tutT, 12);
});

// Execute the actual menu callbacks through the UI factory, including the
// controls route. The journal double pauses exactly as the real modal does.
const buttons = {};
t.pauseBtn = (_cls, label, action) => { buttons[label] = action; return element(); };
t.jrKeys = { open: false, scrollIntoView() {} };
t.jrKeysSum = { focus() {} };
t.jrCard = { insertBefore() {}, firstChild: null, scrollTop: 0 };
t.jrShow = () => { t.jrShown = true; t.game.state.paused = true; };
t.jrReturnFocus = null;
const menuStart = source.indexOf('const pauseGo = pauseBtn(');
const menuEnd = source.indexOf('pauseSetBtn.setAttribute(', menuStart);
vm.runInContext('{ ' + source.slice(menuStart, menuEnd) + ' }', t);
check('Opening controls through Pause preserves guidance', () => {
  t.pauseShow(); buttons['learn to play']();
  assert.equal(t.jrKeys.open, true); assert.equal(t.game.state.paused, true);
  assert.equal(t.tutLive(), true); assert.equal(t.tutEver, false); assert.equal(t.saves, 0);
});

// Run the live tutorial update block with its world observations stubbed.
const tickStart = source.indexOf('if (tutLive() && started) {');
const tickEnd = source.indexOf('if (started && capy && !slipEver', tickStart);
Object.assign(t, { capy: { grounded: true }, inSyd: true, transBusy: false, dt: 1,
  sp: 0, p: { x: 0, y: 0, z: 0 }, sysTUT_TOTAL_T: 180, sysTUT_START_T: 4.6,
  sysTUT_GAP_T: 0.8, sysTUT_WALK_M: 4, sysTUT_MIN_T: 1.6, sysTUT_DOOR_T: 45,
  sysTUT_BEAT_T: 20, tutBeatStart: () => {}, sysTUT_SAY_T: 4 });
vm.runInContext('function stepLesson() { ' + source.slice(tickStart, tickEnd) + ' }', t);
check('Help freezes the lesson clock while the journal is open', () => {
  t.stepLesson(); assert.equal(t.tutT, 12); assert.equal(t.tutBeatT, 3);
});
check('Closing help allows the same lesson to advance', () => {
  t.jrShown = false; t.game.state.paused = false; t.stepLesson();
  assert.equal(t.tutT, 13); assert.equal(t.tutBeatT, 4); assert.equal(t.tutBeat, 1);
});
check('Timed-out final lesson is offered, never saved as learned', () => {
  t.tutBeat = 8; t.tutHitN = 7; t.tutBeatClose(false);
  assert.equal(t.tutDone, true); assert.equal(t.tutEver, false); assert.equal(t.tutHow, 'offered');
});
check('Replay resets guidance without changing completed tasks', () => {
  t.doneCount = 42; buttons['replay the guided walk']();
  assert.equal(t.tutLive(), true); assert.equal(t.tutBeat, 0); assert.equal(t.tutHitN, 0);
  assert.equal(t.doneCount, 42); assert.equal(t.tutEver, false);
});
check('All eight demonstrated lessons persist completion', () => {
  t.tutBeat = 8; t.tutHitN = 7; t.tutBeatClose(true);
  assert.equal(t.tutEver, true); assert.equal(t.tutHow, 'walked'); assert.equal(t.tutHitN, 8);
});
check('Explicit skip persists; replay remains possible afterwards', () => {
  t.tutReplay(); buttons['skip the guided walk']();
  assert.equal(t.tutEver, true); assert.equal(t.tutSkipped, true); assert.equal(t.tutHow, 'skip');
  t.pauseShow(); assert.equal(t.pauseTutReplay.hidden, false); assert.equal(t.pauseTutSkip.hidden, true);
  t.pauseHide(); t.tutReplay(); assert.equal(t.tutEver, false); assert.equal(t.tutLive(), true);
});
for (const how of ['time', 'left', 'cut']) check(how + ' never records tutorial mastery', () => {
  t.tutReplay(); t.tutEnd(how); assert.equal(t.tutEver, false); assert.equal(t.tutSkipped, false);
});
const armStart = source.indexOf('tutArm = !tutEver &&');
const arm = source.slice(armStart, source.indexOf(';', armStart) + 1);
for (const [label, restore, tut, done, where, want, mode] of [
  ['fresh Sydney', false, undefined, 0, 'sydney', true],
  ['unfinished restored Sydney', true, 0, 12, 'sydney', true],
  ['completed restored Sydney', true, 1, 12, 'sydney', false],
  ['legacy save', true, undefined, 12, 'sydney', false],
  ['unfinished abroad', true, 0, 12, 'pasto', false],
  // ROADMAP-TEN U1a: Free Roam is HAVOC from the first second; the walk is Pause's
  ['fresh Free Roam', false, undefined, 0, 'sydney', false, 'free'],
]) check(label + ' uses the intended guidance eligibility', () => {
  Object.assign(t, { restore, jrFile: { tut }, tutEver: !!tut, doneCount: done, where, journeyMode: mode || 'story' });
  vm.runInContext(arm, t); assert.equal(t.tutArm, want);
});
check('Legacy restore stays opted out after writing and restoring its next save', () => {
  const restoreTut = source.match(/tutEver = jrFile\.tut[^;]*;/)?.[0];
  const saveTut = source.match(/\btut:\s*(tutEver[^,\n]*)/)?.[1];
  assert.ok(restoreTut && saveTut, 'shipped restore assignment and save projection exist');
  Object.assign(t, { restore: true, jrFile: { v: 1, tasks: ['wheek'] }, doneCount: 1, where: 'sydney', journeyMode: 'story' });
  vm.runInContext(restoreTut + arm, t);
  assert.equal(t.tutArm, false);
  // Serialize the real writer's tutorial projection, then feed its saved
  // value back through the real restore assignment and startup eligibility.
  const saved = JSON.stringify({ ...t.jrFile, tut: vm.runInContext(saveTut, t) });
  t.jrFile = JSON.parse(saved);
  assert.equal(t.jrFile.tut, 1);
  vm.runInContext(restoreTut + arm, t);
  assert.equal(t.tutArm, false); assert.equal(t.tutEver, true);
  t.tutReplay();
  assert.equal(t.tutLive(), true); assert.equal(t.tutEver, false);
});

// Real keepHeld, finale and shelf functions share the same earned predicate.
// One ordinary partial chapter, Pantanal's empty slot, one final chapter.
const staged = [], events = [];
const f = vm.createContext({
  chapMax: 3, JOURNEY: [1, 2, 3], full: new Set(), enough: new Set([1, 2, 3]),
  chapRec: { 1: { ids: ['a', 'to-pantanal'] }, 2: { ids: ['b', 'to-last'] }, 3: { ids: ['c'] } },
  taskRec: { 'to-pantanal': { done: true }, 'to-last': { done: true } },
  chapterDef: n => [{ biome: 'sydney' }, { biome: 'pantanal', keepNone: true }, { biome: 'hanoi' }][n - 1],
  game: { state: { noVoice2: true }, physics: { stageKeep: (...args) => staged.push(args) },
    biome: { spawnOf: () => ({ x: 0, z: 0 }) }, events: { emit: (...args) => events.push(args) } },
  sysFIN_X: 30, sysFIN_Z: 26, sysFIN_R: 2.6, sysFIN_GAP: 1.75,
  sysFinOpen: 0, sysFinStaged: false, sysShelfCount: 0, sysShelfSpoken: {}, jrKeptAt: {},
  sysSHELF_X: 35.6, sysSHELF_Z: 27.4, sysSHELF_LEN: 4.6, sysSHELF_SURF: 0.84,
});
f.chapComplete = n => f.full.has(n); f.chapEnough = n => f.enough.has(n);
for (const name of ['keepHeld', 'sysFinaleAll', 'sysFinaleKeeps', 'sysFinaleFull', 'sysFinaleStage', 'sysShelfSlot', 'sysShelfStage']) {
  vm.runInContext(fn(name), f);
}
check('Ordinary partial journey earns its ending without 100 percent', () => {
  assert.equal(f.sysFinaleAll(), true); assert.equal(f.sysFinaleFull(), false);
});
check('Partial finale stages every physical souvenir and leaves Pantanal empty', () => {
  f.sysFinaleStage(); assert.deepEqual(staged.map(a => a[0]), ['sydney', 'hanoi']);
  assert.equal(f.sysFinStaged, true); assert.equal(f.game.state.finaleOn, true);
  assert.equal(events.at(-1)[0], 'finale:staged');
});
check('Shelf also preserves the earned empty Pantanal slot', () => {
  staged.length = 0; f.sysShelfStage();
  assert.deepEqual(staged.map(a => a[0]), ['sydney', 'hanoi']); assert.equal(f.sysShelfCount, 3);
  assert.ok(Math.abs(staged[1][2] - staged[0][2] - 4.6) < 1e-9);
});
check('An unearned departure does not satisfy the ending', () => {
  f.taskRec['to-pantanal'].done = false;
  assert.equal(f.keepHeld(1), false); assert.equal(f.sysFinaleAll(), false);
});
check('Completionist journey still works without requiring departure ticks', () => {
  f.full = new Set([1, 2, 3]);
  assert.equal(f.sysFinaleAll(), true); assert.equal(f.sysFinaleFull(), true);
  staged.length = 0; f.sysFinaleStage(); assert.deepEqual(staged.map(a => a[0]), ['sydney', 'hanoi']);
});
console.log('\n' + checks + ' behavioral checks passed. Browser integration remains separate.');

if (process.argv.includes('--browser')) {
  const { openHarness } = await import('./reimagine-harness.mjs');
  const h = await openHarness();
  try {
    const instrument = vm.runInThisContext('(' + readFileSync('qa/reimagine-trust-browser.js', 'utf8') + ')');
    await instrument(h.page);
    await h.result('reimagine-trust-device', h.metadata);
    assert.equal(h.metadata.errors.length, 0, 'browser errors');
    console.log('Browser guidance checks passed on ' + h.metadata.renderer.renderer);
  } finally { await h.close(); }
}

if (process.argv.includes('--finale')) {
  const { openHarness } = await import('./reimagine-harness.mjs');
  const boot = await openHarness();
  let data;
  try {
    data = await boot.page.evaluate(async () => {
      const { TASKS, CHAPTERS } = await import('/src/shared.js');
      const omitted = CHAPTERS.map(c => TASKS.find(t => t.chapter === c.n && !t.wow && !t.id.startsWith('to-')).id);
      return { all: TASKS.map(t => t.id), omitted, seen: CHAPTERS.map(c => c.n),
        physical: CHAPTERS.filter(c => !c.keepNone).map(c => c.biome) };
    });
  } finally { await boot.close(); }
  for (const complete of [false, true]) {
    const tasks = complete ? data.all : data.all.filter(id => !data.omitted.includes(id));
    const save = { v: 1, tasks, seen: data.seen, biome: 'sydney', ms: 9000000, tut: 1, fin: 0 };
    const h = await openHarness({ storage: { 'capy3.journey.v1': save } });
    const tag = 'reimagine-trust-finale-' + (complete ? 'full' : 'partial');
    const out = { seedTasks: tasks.length, complete, metadata: h.metadata };
    try {
      await h.page.evaluate(() => document.querySelector('.capyui-carry').click());
      await h.page.waitForFunction(() => window.__capy.state.started);
      await h.hold('Shift', 40);
      await h.page.waitForTimeout(1400);
      out.stage = await h.page.evaluate(() => {
        const g = window.__capy;
        return { shelf: g.shelfAudit(), gates: g.gateInfo(), finaleOn: g.state.finaleOn,
          keeps: g.props.filter(p => !p.removed && p.keep).map(p => ({ keep: p.keep,
            radius: Math.hypot(p.body.position.x - 30, p.body.position.z - 26) })) };
      });
      assert.equal(out.stage.shelf.keep, 19);
      assert.equal(out.stage.finaleOn, true);
      assert.deepEqual(out.stage.keeps.map(p => p.keep).sort(), data.physical.slice().sort());
      assert.ok(out.stage.keeps.every(p => Math.abs(p.radius - 2.6) < 0.3), 'souvenirs occupy finale horseshoe');
      assert.equal(out.stage.gates.every(g => g.complete), complete);
      // Seed the animal near the ending; its ordinary settling and hold drive
      // the ending. This is a state integration test, not a navigation test.
      await h.page.evaluate(() => {
        const g = window.__capy;
        g.capy.body.position.set(30, 0.7, 26); g.capy.body.velocity.set(0, 0, 0);
      });
      await h.page.waitForTimeout(4000);
      await h.screenshot(tag + '-lawn');
      await h.page.waitForFunction(() => window.__capy.hud.codaAudit().done, null, { timeout: 30000 });
      await h.page.waitForFunction(() => document.querySelector('.capyui-led').classList.contains('show'), null, { timeout: 30000 });
      await h.screenshot(tag + '-ledger');
      out.ending = await h.page.evaluate(() => {
        window.dispatchEvent(new Event('pagehide'));
        return { coda: window.__capy.hud.codaAudit(), save: JSON.parse(localStorage.getItem('capy3.journey.v1')),
          ledger: document.querySelector('.capyui-led').textContent };
      });
      assert.equal(out.ending.save.fin, 1);
      assert.equal(h.metadata.errors.length, 0);
      await h.result(tag, out);
      console.log(tag + ': ' + tasks.length + ' seeded tasks, 18 souvenirs, empty Pantanal, ending saved.');
    } catch (error) {
      out.error = String(error.stack || error); await h.result(tag, out); throw error;
    } finally { await h.close(); }
  }
}
