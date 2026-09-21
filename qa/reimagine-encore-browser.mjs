// D3: earn the concert with real keys, then check its actionable continuation.
// Flags and viewport are explicit fixtures; tasks, bodies and clocks are not seeded.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';

const mode = process.argv[2] || 'success', width = Number(process.argv[3] || 1280);
assert.ok(['success', 'miss', 'controls', 'transition', 'leave'].includes(mode));
assert.ok([1280, 390].includes(width));
const name = `reimagine-encore-${mode}-${width}`, rows = [];
const h = await openHarness({ width, height: 760 });
const held = new Set();
async function release() { for (const k of held) await h.page.keyboard.up(k); held.clear(); }
async function stage() {
  const start = Date.now();
  try {
    while (Date.now() - start < 35000) {
      const s = await h.page.evaluate(() => {
        const g = window.__capy;
        return { p: g.capy.position.toArray(), target: g.hintTarget('opera-stage'), yaw: g.input.camYaw };
      });
      const dx = s.target.x - s.p[0], dz = s.target.z - s.p[2];
      if (Math.hypot(dx, dz) < .7) return;
      const x = dx * Math.cos(s.yaw) - dz * Math.sin(s.yaw);
      const z = dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw), want = new Set();
      if (Math.abs(x) > Math.abs(z) * .42) want.add(x > 0 ? 'd' : 'a');
      if (Math.abs(z) > Math.abs(x) * .42) want.add(z > 0 ? 's' : 'w');
      for (const k of [...held]) if (!want.has(k)) { await h.page.keyboard.up(k); held.delete(k); }
      for (const k of want) if (!held.has(k)) { await h.page.keyboard.down(k); held.add(k); }
      await h.page.waitForTimeout(160);
    }
    throw new Error('natural stage navigation timed out');
  } finally { await release(); }
}
async function sample(label) {
  const row = await h.page.evaluate(label => {
    const g = window.__capy, marq = document.querySelector('.capyui-marq');
    const line = document.querySelector('.capyui-marqlive'), rect = line.getBoundingClientRect();
    const wallet = document.querySelector('.capyui-wallet').getBoundingClientRect();
    const walletOverlap = Math.max(0, Math.min(rect.right, wallet.right) - Math.max(rect.left, wallet.left)) *
      Math.max(0, Math.min(rect.bottom, wallet.bottom) - Math.max(rect.top, wallet.top));
    let visible = rect.width > 0 && rect.height > 0;
    for (let p = line; p; p = p.parentElement) {
      const css = getComputedStyle(p);
      visible &&= css.display !== 'none' && css.visibility !== 'hidden' && Number(css.opacity) > .01;
    }
    return { label, t: g.state.time, wall: performance.now(), paused: g.state.paused,
      biome: g.biome.current, earned: g.taskDone('opera-stage'), encore: g.env.encoreAudit(),
      position: g.capy.position.toArray(), concert: g.env.concertAudit(),
      onPodium: g.env.inZone('operaStage', g.capy.position.x, g.capy.position.z) && g.capy.position.y > .9,
      musicLive: g.wowLiveAt(), continuation: marq.classList.contains('continuation'),
      text: line.textContent, visible, walletOverlap, rect: { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom },
      inViewport: rect.x >= 0 && rect.y >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
      paper: document.querySelector('.capyui-todo')?.className };
  }, label);
  rows.push(row); return row;
}
async function live(label) {
  await h.page.waitForFunction(() => document.querySelector('.capyui-marq').classList.contains('continuation'));
  await h.page.waitForTimeout(160);
  const row = await sample(label);
  assert.ok(row.earned && row.encore.encoreT > 0 && row.continuation, 'earned encore remains available');
  assert.ok(row.visible && row.inViewport && row.text.includes('THE ENCORE'), 'action visible within viewport');
  assert.equal(row.walletOverlap, 0, 'wallet does not cover encore instruction');
  assert.equal(row.musicLive, -1, 'completed-task musical live state stays inherited');
  return row;
}
try {
  await h.page.evaluate(() => {
    window.__encoreKeys = [];
    document.addEventListener('keydown', e => window.__encoreKeys.push({ key: e.code, trusted: e.isTrusted }));
  });
  await h.start(); await stage();
  for (let i = 0; i < 3; i++) { await h.page.keyboard.press('q'); await h.page.waitForTimeout(1200); }
  await h.page.waitForFunction(() => window.__capy.taskDone('opera-stage'));
  await live('earned countdown'); await h.screenshot(name + '-earned');
  if (mode === 'controls') {
    for (const [label, state] of [['flag', { noEarnedFocus: true }], ['rung', { perfRung: 1 }]]) {
      await h.page.evaluate(state => Object.assign(window.__capy.state, state), state);
      await h.page.waitForTimeout(200);
      assert.equal((await sample(label)).continuation, false, label + ' restores inherited display');
      await h.page.evaluate(() => { window.__capy.state.noEarnedFocus = false; window.__capy.state.perfRung = 0; });
      await live(label + ' restored');
    }
    await h.page.keyboard.press('Escape'); await h.page.waitForTimeout(250);
    const paused = await sample('paused'); assert.ok(paused.paused && !paused.visible, 'pause hides action');
    await h.page.keyboard.press('Escape'); await live('resumed');
  }
  if (mode === 'success' || mode === 'controls') {
    await h.page.keyboard.press('q');
    await h.page.waitForFunction(() => window.__capy.env.encoreAudit().encoreDone);
    await h.page.waitForTimeout(950);
    const end = await sample('encore answered');
    assert.ok(end.encore.encoreDone && !end.continuation, 'reward ends countdown');
    assert.ok(end.encore.glowT > 0, 'existing encore glow reward remains');
  } else if (mode === 'transition') {
    await h.page.evaluate(() => window.__capy.hud.cross('quay'));
    await h.page.waitForTimeout(250);
    assert.equal((await sample('transition')).continuation, false, 'transition clears continuation');
  } else {
    if (mode === 'leave') await h.hold('s', 1800);
    await h.page.waitForFunction(() => window.__capy.env.encoreAudit().encoreT <= 0, null, { timeout: 30000 });
    await h.page.waitForTimeout(950);
    const end = await sample('window expired');
    assert.ok(!end.continuation && !end.encore.encoreDone, 'missed encore closes without reward');
  }
  await h.screenshot(name + '-end');
  const keys = await h.page.evaluate(() => window.__encoreKeys);
  assert.ok(keys.length > 0 && keys.every(k => k.trusted));
  assert.deepEqual(h.metadata.errors, []);
  await h.result(name, { metadata: h.metadata, mode, width, rows, keys });
  console.log(JSON.stringify({ mode, width, rows, errors: h.metadata.errors }, null, 2));
} catch (error) {
  await release(); await sample('failure'); await h.screenshot(name + '-failure');
  await h.result(name + '-failure', { metadata: h.metadata, rows, error: String(error.stack || error) });
  throw error;
} finally { await h.close(); }
