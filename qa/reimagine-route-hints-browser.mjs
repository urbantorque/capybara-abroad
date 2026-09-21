// REIMAGINE D: controlled Hanoi timeout/recovery through real frame updates.
// Scooter placement and partial deliveries are fixtures, never natural play.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { openHarness } from './reimagine-harness.mjs';

const tag = process.argv[2] || 'hanoi';
assert.ok(/^[\w.-]+$/.test(tag), 'artifact tag');
const name = 'reimagine-route-hints-' + tag;
const h = await openHarness();
const out = { metadata: h.metadata, cases: [], screenshots: [],
  scope: 'Controlled Hanoi scooter placement, timeout clock, and partial-delivery fixtures; real updates, hint getters and UI; not natural journey completion.',
  omitted: ['Empty rack cannot be set through cubSet; covered by function fixture.'] };
const sameXZ = (a, b) => !!a && !!b && Math.abs(a.x - b.x) < .001 && Math.abs(a.z - b.z) < .001;
async function sample(label) {
  const row = await h.page.evaluate(label => {
    const g = window.__capy, c = g.hanoi.cub();
    const visible = el => {
      if (!el || !el.getClientRects().length) return false;
      for (let n = el; n; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
      }
      return true;
    };
    return { label, time: g.state.time, hidden: document.hidden, paused: g.state.paused,
      cub: c, target: g.hintTarget('pho-run'), stall: g.hanoi.cubStall(), scooter: g.hanoi.cubAt(),
      nextDrop: g.hanoi.dropAt(c.next), taskDone: g.taskDone('pho-run'),
      text: [...document.querySelectorAll('.capyui-clue,.capyui-marqhow')].map(el => ({
        text: el.textContent.trim(), visible: visible(el), previous: el.previousElementSibling?.textContent.trim() || '' })) };
  }, label);
  out.cases.push(row); return row;
}
async function shot(suffix) {
  await h.screenshot(name + '-' + suffix);
  out.screenshots.push(fileURLToPath(new URL('./' + name + '-' + suffix + '.png', import.meta.url)));
}
try {
  await h.page.evaluate(() => {
    window.__routeHintKeys = [];
    for (const type of ['keydown', 'keyup']) document.addEventListener(type, e => {
      window.__routeHintKeys.push({ type, code: e.code, trusted: e.isTrusted });
    });
  });
  await h.start(); await h.arrive('hanoi');
  const off = await sample('off scooter');
  assert.ok(sameXZ(off.target, off.scooter), 'off target is current scooter');

  // F is the game's actual task selector, including rows outside the shown act.
  out.pin = { attempted: true, selected: false };
  for (let i = 0; i < 25; i++) {
    const selected = await h.page.evaluate(() => {
      const clue = document.querySelector('.capyui-clue');
      return !!clue?.previousElementSibling?.textContent.includes('Take the pho scooter');
    });
    if (selected) { out.pin.selected = true; break; }
    await h.page.keyboard.press('f'); await h.page.waitForTimeout(80);
  }
  await h.page.evaluate(() => {
    const a = window.__capy.hanoi;
    a.cubDebug({ take: true, x: 40, z: 40 });
    a.cubSet({ t: 1, run: true, next: 1 });
  });
  await h.page.waitForTimeout(450);
  const active = await sample('active delivery');
  assert.ok(active.cub.on && active.cub.run && sameXZ(active.target, active.nextDrop), 'running target is next delivery');
  assert.ok(!sameXZ(active.scooter, active.stall), 'fixture scooter is away from refill stall');

  await h.page.evaluate(() => window.__capy.hanoi.cubSet({ t: 151, run: true }));
  await h.page.waitForFunction(() => !window.__capy.hanoi.cub().run, null, { timeout: 15000 });
  // Past the authored 0.7 s live watchdog and the 0.25 s hint tick.
  const expiredAt = await h.page.evaluate(() => window.__capy.state.time);
  await h.page.waitForFunction(t => window.__capy.state.time - t >= 1.3, expiredAt, { timeout: 15000 });
  const expired = await sample('real timeout update');
  assert.ok(expired.cub.on && !expired.cub.done && !expired.cub.run, 'expired while mounted without completion');
  assert.ok(sameXZ(expired.target, expired.stall), 'timeout points to fixed refill stall');
  assert.ok(!sameXZ(expired.target, expired.scooter), 'timeout does not point to displaced scooter');
  out.uiRecoveryCovered = expired.text.some(t => t.visible && /pho stall.*press E/.test(t.text));
  if (!out.uiRecoveryCovered) out.omitted.push('Recovery target proven; recovery wording was not visible in the sampled UI.');
  await shot('expired');

  await h.page.evaluate(() => {
    const a = window.__capy.hanoi, p = a.cubStall(); a.cubDebug({ x: p.x, z: p.z });
  });
  await h.page.waitForTimeout(500); await h.page.keyboard.press('e');
  await h.page.waitForFunction(() => window.__capy.hanoi.cub().run, null, { timeout: 15000 });
  const restarted = await sample('trusted E restart at stall');
  assert.equal(restarted.cub.next, 0, 'restart resets delivery order');
  assert.ok(sameXZ(restarted.target, restarted.nextDrop), 'recovered run points to first drop');

  // Seed two prior deliveries, then allow the real third-drop update to finish.
  await h.page.evaluate(() => {
    const a = window.__capy.hanoi, p = a.dropAt(2);
    a.cubSet({ next: 2, t: 20, run: true }); a.cubDebug({ x: p.x, z: p.z });
  });
  await h.page.waitForFunction(() => window.__capy.hanoi.cub().done, null, { timeout: 15000 });
  const complete = await sample('controlled completion');
  assert.ok(complete.cub.done && !complete.cub.run && complete.taskDone, 'real final drop completes seeded run');
  assert.ok(sameXZ(complete.target, complete.scooter), 'completed idle points to scooter');

  await h.page.evaluate(() => {
    const a = window.__capy.hanoi, p = a.cubStall(); a.cubDebug({ x: p.x, z: p.z });
  });
  await h.page.waitForTimeout(600); await h.page.keyboard.press('e');
  await h.page.waitForFunction(() => window.__capy.hanoi.cub().run, null, { timeout: 15000 });
  const replay = await sample('completed replay');
  assert.ok(replay.cub.done && replay.cub.run, 'completed chapter can replay delivery run');
  assert.ok(sameXZ(replay.target, replay.nextDrop), 'replay points to active drop despite done latch');
  await shot('replay');
  out.keys = await h.page.evaluate(() => window.__routeHintKeys);
  assert.ok(out.keys.length > 0 && out.keys.every(k => k.trusted), 'keyboard events trusted');
  assert.ok(out.cases.every(c => !c.hidden && !c.paused), 'visible unpaused observations');
  assert.deepEqual(h.metadata.errors, [], 'zero runtime errors');
  await h.result(name, out);
  console.log(JSON.stringify({ cases: out.cases.map(c => ({ label: c.label, target: c.target, run: c.cub.run, done: c.cub.done })),
    pin: out.pin, uiRecoveryCovered: out.uiRecoveryCovered, screenshots: out.screenshots, errors: h.metadata.errors,
    scope: out.scope, omitted: out.omitted }, null, 2));
} catch (error) {
  out.failure = String(error.stack || error);
  try { await sample('failure'); await shot('failure'); await h.result(name + '-failure', out); } catch { /* preserve original failure */ }
  throw error;
} finally { await h.close(); }
