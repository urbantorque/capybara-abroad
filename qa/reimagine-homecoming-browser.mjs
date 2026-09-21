// REIMAGINE G: controlled minimal-route save, then real-key homecoming.
// Run separately: node qa/reimagine-homecoming-browser.mjs route|empty [--presentation]
// This proves the ending transition, not a naturally played whole journey.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { openHarness } from './reimagine-harness.mjs';

const presentation = process.argv.includes('--presentation');
const mode = process.argv.slice(2).find(arg => !arg.startsWith('--')) || 'route';
assert.ok(['route', 'empty'].includes(mode), 'mode is route or empty');
assert.ok(!presentation || mode === 'route', 'presentation fixtures require the real route coda');
const source = readFileSync(new URL('../src/shared.js', import.meta.url), 'utf8');
const first = source.indexOf('export const TASKS ='), last = source.indexOf('// RECORDS —', first);
assert.ok(first >= 0 && last > first, 'authored journey data section exists');
const data = vm.runInNewContext(source.slice(first, last).replace(/^export /gm, '') +
  '\n({ TASKS, CHAPTERS, JOURNEY, CHAPTER_EXPERIENCES, chapterExperience })');
assert.equal(data.JOURNEY.join(','), '1,3,2,4,12,15,19');
const tasks = mode === 'route' ? data.JOURNEY.flatMap(n => {
  const e = data.CHAPTER_EXPERIENCES[n];
  return [e.signature, ...e.supports.slice(0, 2)];
}) : [];
assert.equal(new Set(tasks).size, tasks.length, 'fixture has no duplicate task credit');
for (const n of data.JOURNEY) {
  assert.equal(data.chapterExperience(n, id => tasks.includes(id)).enough, mode === 'route');
}
assert.ok(tasks.every(id => data.TASKS.some(t => t.id === id)), 'all seeded actions are shipped tasks');
const systems = readFileSync(new URL('../src/systems.js', import.meta.url), 'utf8');
const capySource = readFileSync(new URL('../src/capybara.js', import.meta.url), 'utf8');
function number(name, source = systems) {
  const m = source.match(new RegExp('\\b' + name + '\\s*=\\s*([\\d.]+)'));
  assert.ok(m, 'authored threshold ' + name); return Number(m[1]);
}
const lawn = { x: number('sysFIN_X'), z: number('sysFIN_Z'), radius: number('sysFIN_IN'),
  loaf: number('sysFIN_LOAF'), hold: number('sysFIN_HOLD'), rest: number('capyLOAF_T', capySource) };
const save = { v: 1, tasks, seen: mode === 'route' ? [...data.JOURNEY] : [],
  biome: 'sydney', ms: 0, tut: 1, fin: 0 };
const h = await openHarness({ storage: { 'capy3.journey.v1': save } });
const name = 'reimagine-homecoming-' + mode + (presentation ? '-presentation' : '');
const report = { metadata: h.metadata, mode, presentation, fixture: save, lawn, steps: [], navigation: [], rest: [], keys: [] };
const keys = new Set();
async function setKeys(want) {
  for (const key of [...keys]) if (!want.has(key)) { await h.page.keyboard.up(key); keys.delete(key); }
  for (const key of want) if (!keys.has(key)) { await h.page.keyboard.down(key); keys.add(key); }
}
const release = () => setKeys(new Set());
async function observeKeys() {
  await h.page.evaluate(() => {
    window.__homecomingKeys = [];
    for (const type of ['keydown', 'keyup']) document.addEventListener(type, e => {
      window.__homecomingKeys.push({ type, key: e.code, trusted: e.isTrusted, t: window.__capy.state.time });
    });
  });
}
async function state() {
  return h.page.evaluate(() => {
    const g = window.__capy, c = g.capy, led = document.querySelector('.capyui-led');
    const saved = JSON.parse(localStorage.getItem('capy3.journey.v1') || '{}');
    return { t: g.state.time, wall: performance.now(), hidden: document.hidden, paused: !!g.state.paused,
      chapter: g.biome.current, p: c.position.toArray(), yaw: g.input.camYaw,
      velocity: c.body.velocity.toArray(), loaf: c.loaf || 0, restT: c.restT || 0,
      grounded: !!c.grounded, swimming: !!c.swimming, carried: !!c.carriedBy,
      finaleOn: !!g.state.finaleOn, coda: g.hud.codaAudit(), gates: g.gateInfo(),
      shelf: g.shelfAudit(), ledger: { shown: !!led?.classList.contains('show'),
        title: led?.querySelector('h2')?.textContent, text: led?.textContent },
      notebook: g.notebook(), saved: { fin: saved.fin || 0, tasks: saved.tasks || [], nb: saved.nb },
      locals: (g.locals || []).filter(r => r.biome === 'sydney' && Math.hypot(r.x - c.position.x, r.z - c.position.z) < 5)
        .slice(0, 3).map(r => ({ role: r.role, x: r.x, y: r.y, z: r.z })) };
  });
}
function live(s, ledgerAllowed = false) {
  assert.equal(s.hidden, false, 'owned browser remains visible');
  assert.equal(s.chapter, 'sydney', 'homecoming stays in Sydney');
  assert.ok(!s.paused || (ledgerAllowed && s.ledger.shown), 'only final ledger may pause the game');
}
async function sample(label) {
  const s = { label, ...await state() }; report.steps.push(s);
  console.log(JSON.stringify({ label, t: s.t, p: s.p, loaf: s.loaf, fin: s.saved.fin,
    coda: { running: s.coda.running, done: s.coda.done, notes: s.coda.notes }, ledger: s.ledger.title }));
  return s;
}
async function go(target, radius = 1, maxMs = 28000) {
  const start = Date.now(); let best = Infinity, progressAt = start, jumps = 0, detours = 0;
  try {
    while (Date.now() - start < maxMs) {
      const s = await state(); live(s);
      const dx = target.x - s.p[0], dz = target.z - s.p[2], distance = Math.hypot(dx, dz);
      report.navigation.push({ target, distance, ...s });
      if (distance < radius) return;
      if (s.carried) { await release(); await h.page.waitForTimeout(200); continue; }
      // A gardener can carry an unearned visitor west across the hedge.
      // Return around its actual southern end instead of pushing through it.
      if (target.x >= 22 && target.z > 14 && s.p[0] < 19 && s.p[2] > 14) {
        assert.ok(detours++ < 2, 'repeated NPC relocation blocks the lawn approach');
        await release();
        await go({ x: 12, z: 10 }); await go({ x: target.x, z: 10 });
        best = Infinity; progressAt = Date.now(); continue;
      }
      if (distance < best - .3) { best = distance; progressAt = Date.now(); }
      const x = dx * Math.cos(s.yaw) - dz * Math.sin(s.yaw);
      const z = dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw), want = new Set();
      if (Math.abs(x) > Math.abs(z) * .42) want.add(x > 0 ? 'd' : 'a');
      if (Math.abs(z) > Math.abs(x) * .42) want.add(z > 0 ? 's' : 'w');
      await setKeys(want);
      if (Date.now() - progressAt > 3500) {
        assert.ok(jumps < 2, 'real-key approach blocked: ' + JSON.stringify(s.p));
        await h.page.keyboard.press('Space'); jumps++; progressAt = Date.now();
      }
      await h.page.waitForTimeout(140);
    }
    throw new Error('homecoming waypoint timed out: ' + JSON.stringify(target));
  } finally { await release(); }
}
async function walkHome() {
  // Use the open harbour end of the eastern hedge, then the horseshoe's
  // western mouth, east of the authored tree at (23,21). The lawn shelf
  // is on the opposite, eastern side.
  await go({ x: 12, z: 10 }); await go({ x: 24, z: 10 });
  await go({ x: 27, z: lawn.z }, 1, 45000); await go({ x: lawn.x, z: lawn.z }, .5);
}
async function restOnLawn(expectCoda, label) {
  await release(); const start = Date.now(); let settledAt = null;
  while (Date.now() - start < 45000) {
    const s = await state(); live(s, expectCoda);
    report.rest.push({ label, ...s });
    const inside = Math.hypot(s.p[0] - lawn.x, s.p[2] - lawn.z) < lawn.radius;
    if (expectCoda && s.coda.running) return s;
    if (!expectCoda) {
      assert.equal(s.coda.running, false, 'rest must not start another coda');
      assert.equal(s.coda.notes, 0, 'no newly scheduled finale notes');
      assert.equal(s.ledger.shown, false, 'rest must not reopen final ledger');
    }
    if (inside && s.loaf >= lawn.loaf) {
      if (settledAt === null) settledAt = s.t;
      if (!expectCoda && s.t - settledAt > lawn.hold + 1) return s;
    } else settledAt = null;
    await h.page.waitForTimeout(200);
  }
  throw new Error('bounded natural rest did not reach expected homecoming state: ' + label);
}
async function checkPresentation() {
  report.captions = [];
  const cardMs = number('sysMOMENT_CARD');
  assert.equal(cardMs, 2600, 'presentation fixture uses original card expiry');
  const flagBefore = await h.page.evaluate(() => ({
    own: Object.hasOwn(window.__capy.state, 'noEndingSpace'), value: window.__capy.state.noEndingSpace }));
  async function read(label) {
    const row = await h.page.evaluate(label => {
      const g = window.__capy, el = document.querySelector('.capyui-moment');
      return { label, wall: performance.now(), t: g.state.time, closing: g.hud.codaAudit().closing,
        running: g.hud.codaAudit().running, cut: !!g.state.noEndingSpace,
        shown: el.classList.contains('show'), opacity: Number(getComputedStyle(el).opacity),
        text: el.textContent, hidden: document.hidden, paused: !!g.state.paused };
    }, label);
    assert.ok(row.closing && row.running && !row.hidden && !row.paused, 'caption test remains inside actual closing coda');
    report.captions.push(row); return row;
  }
  async function expect(label, shown, picture = false) {
    await h.page.waitForFunction(shown => {
      const el = document.querySelector('.capyui-moment');
      return el.classList.contains('show') === shown;
    }, shown, { timeout: 1200 });
    if (picture) {
      await h.page.waitForFunction(shown => {
        const opacity = Number(getComputedStyle(document.querySelector('.capyui-moment')).opacity);
        return shown ? opacity > .98 : opacity < .02;
      }, shown, { timeout: 1200 });
    }
    const row = await read(label); assert.equal(row.shown, shown, label);
    if (picture) await h.screenshot(name + '-' + label);
    return row;
  }
  const cut = value => h.page.evaluate(value => { window.__capy.state.noEndingSpace = value; }, value);
  async function publish(kind, args) {
    await read(kind + '-before-publication');
    return h.page.evaluate(args => {
      const at = performance.now(); window.__capy.hud.showMoment(...args); return at;
    }, args);
  }
  try {
    await cut(false);
    const at = await publish('generic', ['AN INCIDENT', 'Presentation fixture: generic incident.', '', true]);
    await expect('generic-live', false, true);
    await cut(true); await expect('generic-cut', true, true);
    await cut(false); const restored = await expect('generic-restored', false, true);
    const elapsed = await h.page.evaluate(at => performance.now() - at, at);
    assert.ok(restored.wall - at < cardMs, 'generic restoration observed before original timer expired');
    await h.page.waitForTimeout(Math.max(0, cardMs - elapsed) + 100);
    await cut(true); await h.page.waitForTimeout(100);
    await expect('generic-expired-cut', false);
    report.quietCost = await h.page.evaluate(() => {
      const g = window.__capy, prior = g.state.noEndingSpace, samples = [];
      let hits = 0;
      try {
        g.state.noEndingSpace = true;
        const start = performance.now();
        for (let batch = 0; batch < 50; batch++) {
          const at = performance.now();
          for (let i = 0; i < 10000; i++) if (g.hud.incidentalQuiet()) hits++;
          samples.push((performance.now() - at) / 10000);
        }
        const totalMs = performance.now() - start, sorted = [...samples].sort((a, b) => a - b);
        return { calls: 500000, batches: 50, perBatch: 10000, hits, totalMs,
          p95BatchMeanMs: sorted[Math.ceil(sorted.length * .95) - 1], samples,
          closing: g.hud.codaAudit().closing,
          scope: 'Actual hud.incidentalQuiet CPU accessor, noEndingSpace=true, real closing coda. Batch-mean timing; not GPU or full-frame cost.' };
      } finally { g.state.noEndingSpace = prior; }
    });
    assert.equal(report.quietCost.closing, true, 'cut-cost measurement remained inside closing coda');
    assert.ok(report.quietCost.p95BatchMeanMs <= .1, 'cut quiet-accessor p95 batch mean <=0.1ms');
    await cut(false);
    for (const [kind, args] of [
      ['named', ['A NAMED CHAIN', 'Presentation fixture: named reward.', 'Original note.', false]],
      ['mini', ['SMALL VICTORY', 'Presentation fixture: mini reward.']],
    ]) {
      await publish(kind, args); await expect(kind + '-live', false);
      await cut(true); await expect(kind + '-cut', true);
      await cut(false); await expect(kind + '-restored', false);
    }
  } finally {
    await h.page.evaluate(before => {
      if (before.own) window.__capy.state.noEndingSpace = before.value;
      else delete window.__capy.state.noEndingSpace;
    }, flagBefore);
  }
}
try {
  await observeKeys(); await h.start();
  const initial = await sample('fresh ' + mode + ' save restored'); live(initial);
  assert.equal(initial.finaleOn, mode === 'route', 'only all route memories stage the lawn');
  assert.equal(initial.coda.done, false, 'fixture has not spent the closing beat');
  assert.equal(initial.saved.fin, 0);
  assert.equal(initial.gates.filter(g => g.enough).length, mode === 'route' ? 7 : 0);
  assert.equal(initial.gates.filter(g => g.complete).length, 0, 'not a completionist fixture');
  await h.screenshot(name + '-arrival');
  await walkHome(); await sample('walked into the lawn'); await h.screenshot(name + '-before');
  const rested = await restOnLawn(mode === 'route', 'first visit');
  if (mode === 'route') {
    assert.equal(rested.coda.done, true, 'actual loaf spends closing beat');
    await h.screenshot(name + '-coda-early');
    if (presentation) await checkPresentation();
    await h.page.waitForTimeout(1400); await h.screenshot(name + '-coda');
    const deadline = Date.now() + 25000;
    let end;
    do {
      end = await state(); live(end, true); report.rest.push({ label: 'coda to ledger', ...end });
      if (end.ledger.shown && end.saved.fin === 1) break;
      await h.page.waitForTimeout(250);
    } while (Date.now() < deadline);
    assert.equal(end.saved.fin, 1, 'ending persisted through normal save writer');
    assert.equal(end.ledger.shown, true, 'final ledger appeared');
    assert.equal(end.ledger.title, 'BACK WHERE IT BEGAN', 'ordinary ending, not full completion');
    assert.equal(end.coda.whole, true, 'whole authored tune scheduled');
    assert.equal(end.coda.notes, 20, 'single complete twenty-note coda');
    assert.ok(end.saved.nb?.fin?.t, 'closing notebook page persisted');
    assert.equal(end.gates.every(g => g.complete), false);
    report.ending = end; await h.page.waitForTimeout(1200); await h.screenshot(name + '-ledger');
    report.keys = await h.page.evaluate(() => window.__homecomingKeys);
    await h.page.reload(); await observeKeys(); await h.start();
    const restored = await sample('completed save restored'); live(restored);
    assert.equal(restored.saved.fin, 1); assert.equal(restored.coda.done, true);
    assert.equal(restored.coda.notes, 0, 'fresh audio session has not replayed coda');
    assert.deepEqual(restored.saved.nb.fin, end.saved.nb.fin, 'closing page not awarded again on load');
    await walkHome();
    const again = await restOnLawn(false, 'reload revisit');
    assert.equal(again.saved.fin, 1); assert.equal(again.coda.done, true);
    assert.deepEqual(again.saved.nb.fin, end.saved.nb.fin, 'second loaf does not rewrite closing page');
    report.revisited = again; await h.screenshot(name + '-reload-rest');
    report.keys.push(...await h.page.evaluate(() => window.__homecomingKeys));
  } else {
    assert.equal(rested.saved.fin, 0, 'zero-route save cannot close from resting');
    assert.equal(rested.coda.done, false); assert.equal(rested.finaleOn, false);
    assert.ok(rested.restT >= lawn.rest && rested.loaf >= lawn.loaf, 'negative case genuinely settled');
    report.negative = rested; await h.screenshot(name + '-negative-rest');
    report.keys = await h.page.evaluate(() => window.__homecomingKeys);
  }
  assert.ok(report.keys.some(k => ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(k.key)), 'real walking observed');
  assert.ok(report.keys.every(k => k.trusted), 'all observed keyboard events trusted');
  assert.deepEqual(h.metadata.errors, []);
  report.scope = 'Controlled initial progress-save fixture only. Subsequent lawn navigation and settling use real keys and real clock, with no task/body/finale/clock/input-state writes. Route mode checks ordinary ending and repeat-rest after reload; empty mode checks genuine settled negative. Not a natural whole-journey claim.';
  if (presentation) report.scope += ' Optional presentation mode injects generic/named/mini captions through hud.showMoment and toggles only noEndingSpace during the genuinely triggered coda; these are controlled UI fixtures, not naturally earned rewards. The renderer and clock remain live, so screenshots are presentation comparisons, not pinned pixel-parity evidence.';
  await h.result(name, report);
  console.log(JSON.stringify({ pass: true, mode, seededTasks: tasks.length, navigation: report.navigation.length,
    restSamples: report.rest.length, errors: h.metadata.errors }));
} catch (error) {
  await release(); report.failure = String(error.stack || error);
  try { await sample('failure'); } catch {}
  try { report.keys.push(...await h.page.evaluate(() => window.__homecomingKeys || [])); } catch {}
  try { await h.screenshot(name + '-failure'); } catch {}
  await h.result(name + '-failure', report); throw error;
} finally { await h.close(); }
