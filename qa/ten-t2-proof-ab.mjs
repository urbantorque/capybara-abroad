// ROADMAP-TEN T2 proof slot: the rung-0 GPU cost of every T2 flag that draws,
// headful Edge on the reference GPU, one browser, alone.
//   CAPY_QA_URL=http://localhost:5199/ node qa/ten-t2-proof-ab.mjs [chapter ...]
// qa/aaa-ab.mjs's method (post.render timer queries, the flag alternating in
// blocks, the median of the settled frames each side), with three things it
// cannot do on its own: the term has to be IN the frame, so each case stages
// the moment (the pod, the forced aurora at the pool, a ring from 150 m, the
// ping on the wall) and pins the lens in post.render; a term that lives for
// two seconds (the ping) gets 120-frame blocks and a wheek at the start of
// EVERY block, cut or live, so the only difference between the sides is the
// glints; and every chapter also times a flag nothing reads, which is the
// noise floor the other numbers are read against. The frozen pair is taken
// live first, then cut (a cut ping is killed, and a cut zenith snaps its
// fade to zero, so the other order draws two cut pictures).
// Pictures: qa/ten-t2-proof-<case>-{shot,on,off}.png (shot is the headful page
// with its HUD, on/off the canvas alone). Numbers: qa/ten-t2-proof-ab.json.png.
import { openHarness } from './reimagine-harness.mjs';

process.env.CAPY_QA_MUTE_AUDIO = '1';
process.env.CAPY_QA_NO_THROTTLE = '1';
const MS = +(process.env.CAPY_AB_MS || 14000);

// A lens is [eye x, y, z, target x, y, z], or a function run in the page
// before every render (it may also hold the animal still).
const pose = `g => { const c = g.camera; window.__abPose = [c.position.clone(), c.quaternion.clone()] }`;
const pinPose = `g => { const c = g.camera, p = window.__abPose; c.position.copy(p[0]); c.quaternion.copy(p[1]) }`;
const CASES = {
  antarctic: [
    { tag: 'orca', flags: ['noOrcaRound'],
      // the pod from 12 m off its quarter, wherever the patrol has it
      pin: `g => { const o = g.scene.getObjectByName('antPod'), T = g.THREE, c = new T.Vector3(), v = new T.Vector3();
        let n = 0; for (const m of o.children) { m.getWorldPosition(v); c.add(v); n++ } c.divideScalar(n || 1);
        g.camera.position.set(c.x + 9, 3.5, c.z + 9); g.camera.lookAt(c.x, 0.2, c.z) }` },
    { tag: 'antarctic-null', flags: ['noT2ProofNull'], same: 'orca' },
  ],
  iceland: [
    { tag: 'aurora', flags: ['noAuroraRamp'],
      // the tick frame itself: the call, 2.2 s, then that lens is held
      setup: async page => {
        await page.evaluate(() => { const g = window.__capy, y = g.groundY(-40, -10); g.capy.body.position.set(-40, y + 0.8, -10); g.capy.body.velocity.set(0, 0, 0) });
        await page.waitForTimeout(3000);
        await page.evaluate(() => window.__capy.iceland.auroraForce(1)); await page.waitForTimeout(5000);
        await page.evaluate(() => window.__capy.iceland.auroraCall()); await page.waitForTimeout(2200);
        await page.evaluate(`(${pose})(window.__capy)`);
      }, pin: pinPose },
    { tag: 'steam', flags: ['noSteamSoft'], setup: async page => {
        // the resting lens in the pool, the one the review measured 24 % steam on
        await page.evaluate(() => { const g = window.__capy, st = g.state; st.noAuroraFrame = true });
        await page.waitForTimeout(6000);
        await page.evaluate(`(${pose})(window.__capy)`);
        await page.evaluate(() => { window.__capy.state.noAuroraFrame = false });
      }, pin: pinPose },
    { tag: 'auroraframe', flags: ['noAuroraFrame'], same: 'steam' },
    { tag: 'iceland-null', flags: ['noT2ProofNull'], same: 'steam' },
  ],
  rio: [
    { tag: 'bounce', flags: ['noRioBounce'], pin: [-20, 3.2, -12, -20, 9, 17] },
    { tag: 'rio-null', flags: ['noT2ProofNull'], same: 'bounce' },
  ],
  sahara: [
    { tag: 'zenith', flags: ['noSahZenith'], setup: async page => {
        await page.waitForTimeout(3000); await page.evaluate(`(${pose})(window.__capy)`);
      }, pin: pinPose },
    { tag: 'joints', flags: ['noSahStallSmoke'], same: 'zenith' },
    { tag: 'beam', flags: ['noSahRingBeam'],
      pin: `g => { const r = g.sahara.jet().rings[1], a = Math.atan2(-1, -1);
        g.camera.position.set(r[0] + Math.cos(a) * 150, 4, r[2] + Math.sin(a) * 150); g.camera.lookAt(r[0], r[1] + 8, r[2]) }` },
    { tag: 'sahara-null', flags: ['noT2ProofNull'], same: 'zenith' },
  ],
  cave: [
    { tag: 'ping', flags: ['noEchoPing'], block: 120, onBlock: `g => g.events.emit('capy:wheek')`, shotWheek: 1000,
      // the animal held in the dark passage, the lens on the east wall (ten-t2f-ping-shot's)
      pin: `g => { const b = g.capy.body, h = g.cave.terrainHeight(32, -14);
        b.position.set(32, h + 0.6, -14); b.velocity.set(0, 0, 0);
        g.camera.position.set(18, h + 4.5, 2); g.camera.lookAt(44, h + 2, -24) }` },
    { tag: 'fern', flags: ['noFern'],
      pin: `g => { const t = g.cave.terrainHeight, b = g.capy.body; b.position.set(4, t(4, -40) + 0.6, -40); b.velocity.set(0, 0, 0);
        g.camera.position.set(4, t(4, -31) + 7.5, -31); g.camera.lookAt(4, t(4, -50), -50) }` },
    { tag: 'swift', flags: ['noSwiftShape'],
      pin: `g => { const t = g.cave.terrainHeight, b = g.capy.body; b.position.set(10, t(10, -40) + 0.6, -40); b.velocity.set(0, 0, 0);
        const f = t(12, -38); g.camera.position.set(12, f + 2, -38); g.camera.lookAt(4, f + 16, -48) }` },
    { tag: 'roost', flags: ['noSwiftShape'], block: 60, onBlock: `g => g.events.emit('capy:wheek')`,
      pin: `g => { const t = g.cave.terrainHeight, b = g.capy.body; b.position.set(-26, t(-26, -122) + 0.6, -122); b.velocity.set(0, 0, 0);
        const f = t(-12, -118); g.camera.position.set(-12, f + 8, -118); g.camera.lookAt(-36, f + 20, -128) }` },
    { tag: 'cave-null', flags: ['noT2ProofNull'], same: 'fern' },
  ],
};

const list = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CASES);
const h = await openHarness({ url: process.env.CAPY_QA_URL || 'http://localhost:5199/', width: 1280, height: 720 });
const page = h.page;
const out = { at: new Date().toISOString(), renderer: h.metadata.renderer, ms: MS, rows: {} };
const lensSrc = L => Array.isArray(L)
  ? `g => { g.camera.position.set(${L.slice(0, 3)}); g.camera.lookAt(${L.slice(3)}) }` : L;
try {
  await h.start();
  for (const ch of list) {
    await h.arrive(ch);
    await page.bringToFront();
    await page.waitForTimeout(4000);
    const byTag = {};
    for (const c of CASES[ch]) byTag[c.tag] = c;
    const only = process.env.CAPY_AB_ONLY ? process.env.CAPY_AB_ONLY.split(',') : null;   // e.g. fern,cave-null
    for (const c0 of CASES[ch].filter(c => !only || only.includes(c.tag))) {
      const base = c0.same ? byTag[c0.same] : c0, c = { ...base, ...c0, setup: c0.same ? null : base.setup };
      if (!c0.same && c.setup) await c.setup(page);
      // the lens, pinned in post.render (the raw render is kept once per page)
      await page.evaluate(src => {
        const g = window.__capy;
        if (!window.__abRaw) window.__abRaw = g.post.render;
        const raw = window.__abRaw, pin = src ? (0, eval)('(' + src + ')') : null;
        g.post.render = function () {
          if (pin) { pin(g); g.camera.updateMatrixWorld(true); }
          return raw.apply(this, arguments);
        };
      }, c.pin ? lensSrc(c.pin) : null);
      await page.waitForTimeout(1500);
      const name = 'ten-t2-proof-' + c.tag;
      if (c.shotWheek) { await page.evaluate(() => window.__capy.events.emit('capy:wheek')); await page.waitForTimeout(c.shotWheek); }
      await h.screenshot(name + '-shot');
      // the frozen pair: live, then cut, one task, nothing moves between them
      if (c.shotWheek) { await page.evaluate(() => window.__capy.events.emit('capy:wheek')); await page.waitForTimeout(c.shotWheek); }
      await page.evaluate(async ([fl, base]) => {
        const g = window.__capy, grab = cut => {
          for (const f of fl) g.state[f] = cut;
          g.tick(1e-4, true);
          return g.renderer.domElement.toDataURL('image/png').split(',')[1];
        };
        const on = grab(false), off = grab(true);
        for (const f of fl) g.state[f] = false;
        await fetch('/shot?name=' + base + '-on', { method: 'POST', body: on });
        await fetch('/shot?name=' + base + '-off', { method: 'POST', body: off });
      }, [c.flags, name]);
      await page.waitForTimeout(1000);
      const row = await page.evaluate(async ([fl, block, onBlock, ms]) => {
        const g = window.__capy, gl = g.renderer.getContext();
        const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
        if (!ext) return { error: 'no timer query' };
        const hook = onBlock ? (0, eval)('(' + onBlock + ')') : null;
        const raw = g.post.render, pending = [], on = [], off = [];
        let frame = 0, cut = false;
        if (hook) hook(g);
        g.post.render = function () {
          const q = frame % 3 === 0 && pending.length < 8 ? gl.createQuery() : null;
          if (q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
          try { return raw.apply(this, arguments); } finally {
            if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push({ q, cut, settled: frame % block > 4 }); }
            if (++frame % block === 0) { cut = !cut; for (const f of fl) g.state[f] = cut; if (hook) hook(g); }
          }
        };
        const poll = () => {
          if (gl.getParameter(ext.GPU_DISJOINT_EXT)) { pending.forEach(p => gl.deleteQuery(p.q)); pending.length = 0; return; }
          for (let i = pending.length - 1; i >= 0; i--) {
            const p = pending[i];
            if (!gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) continue;
            if (p.settled) (p.cut ? off : on).push(gl.getQueryParameter(p.q, gl.QUERY_RESULT) / 1e6);
            gl.deleteQuery(p.q); pending.splice(i, 1);
          }
        };
        const t0 = performance.now();
        while (performance.now() - t0 < ms) { await new Promise(r => setTimeout(r, 50)); poll(); }
        g.post.render = raw; for (const f of fl) g.state[f] = false;
        const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? +s[s.length >> 1].toFixed(3) : null; };
        const info = g.renderer.info.render;
        return { frames: frame, nOn: on.length, nOff: off.length, liveMs: med(on), cutMs: med(off),
          deltaMs: med(on) != null && med(off) != null ? +(med(on) - med(off)).toFixed(3) : null,
          rung: g.state.perfRung, calls: info.calls, tris: info.triangles, lastError: g.state.lastError || null };
      }, [c.flags, c.block || 30, c.onBlock || null, MS]);
      out.rows[c.tag] = { chapter: ch, flags: c.flags, ...row };
      console.log(c.tag, JSON.stringify(out.rows[c.tag]));
    }
    await page.evaluate(() => { const g = window.__capy; if (window.__abRaw) { g.post.render = window.__abRaw; window.__abRaw = null; } });
  }
  out.errors = h.metadata.errors;
  await h.result('ten-t2-proof-ab' + (process.env.CAPY_AB_TAG || ''), out);
  console.log('errors', out.errors.length, JSON.stringify(out.errors.slice(0, 3)).slice(0, 600));
} finally { await h.close(); }
