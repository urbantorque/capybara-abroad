// ROADMAP-TEN T4 proof slot: every flag the wave added, A/B on the reference
// GPU in headful Edge, and the payoff frame of each item. qa/aaa-ab.mjs's
// method (a same-instant canvas pair, then post.render's GPU time by timer
// query while the cut alternates in blocks of 30 frames), with a set-up per
// case, because none of T4's terms is on screen at a chapter's arrival.
//   CAPY_QA_URL=http://localhost:5199/ node qa/ten-t4-proof-ab.mjs <case[,case]>
// cases: cloud, cloudin, cloudin1, wisps, nullcloud (drift); herd, pansky,
// panriver (pantanal); karst, clear (palawan); ring, concert, fold, nullsyd,
// and plinth, finflash on a finished story file (sydney). prefs pf 1 pins the
// governor, so a case that writes state.perfRung keeps it — into the next
// case too, so a case that needs rung 0 after one at rung 1 says so. The
// first two blocks are dropped, and the first case after an arrival still
// reads high: the null cases are the noise floor (±0.6 ms in the cloud). Pictures go to
// qa/ten-t4-proof-<case>-{off,on}.png and -shot*.png, numbers to
// qa/ten-t4-proof-ab-<cases>.json.png. Diagnostic, not an FPS claim.
import { openHarness } from './reimagine-harness.mjs';

const want = (process.argv[2] || 'cloud').split(',');
process.env.CAPY_QA_MUTE_AUDIO = '1';
process.env.CAPY_QA_NO_THROTTLE = '1';

// toggle: page-side source of (g, cut) => void; default sets the flags.
const CASES = {
  cloud: { chapter: 'drift', flags: ['noCloudSoft'] },
  herd: { chapter: 'pantanal', flags: ['noHerdCascade'] },
  // the fallback sky exists only while the mirror is parked
  pansky: { chapter: 'pantanal', flags: ['noPanSkyFresnel'], rung: 1 },
  // the reviewer's lagoon-wall spot: the animal at the base of the front wall
  karst: { chapter: 'palawan', flags: ['noPalKarstSolid'], setup: `g => {
    const b = g.capy.body; b.position.set(-6, 0.3, -24); b.velocity.set(0, 0, 0);
    if (g.input) g.input.camYaw = Math.PI; }` },
  // the lens pinned under the water over the coral garden (T4e's reef view)
  clear: { chapter: 'palawan', flags: ['noPalClear'], setup: `g => {
    const p = g.palawan, cx = -13, cz = 2, lz = -8;
    const fy = p.camFloor(cx, cz) - 0.95, ly = p.camFloor(cx, lz) - 0.95;
    const P = { x: cx, y: Math.min(-1.2, fy + 1.4), z: cz, lx: cx, ly: ly + 0.8, lz };
    g.state.noLensCap = true;
    const raw = window.__proofRaw = g.post.render;
    g.post.render = function () {
      const c = g.camera; c.position.set(P.x, P.y, P.z); c.lookAt(P.lx, P.ly, P.lz); c.updateMatrixWorld();
      return raw.apply(this, arguments);
    }; }` },
  // the ring before the first note: the animal held on the red
  ring: { chapter: 'sydney', flags: ['noConcertBeat'], hold: [0, 1.9, 1.6] },
  // ...and the sails and the ring while the concert is on (Q every 3 s)
  concert: { chapter: 'sydney', flags: ['noConcertBeat'], hold: [0, 1.9, 1.6], wheek: true },
  fold: { chapter: 'sydney', flags: ['noPlaceFold'] },
  // THE FINALE (seed: a story file with every task done, T4a's fast-forward).
  // noFinPlinth clears the lawn for good once set (props.js physPlinthStep),
  // so the A/B alternates what the flag draws instead: the plinth mesh.
  plinth: { chapter: 'sydney', seed: true, flags: ['noFinPlinth'], setup: `g => {
    const t = g.travFinAt ? g.travFinAt() : null, mo = t ? t.mouth : Math.PI;
    const b = g.capy.body; b.position.set(30 + Math.cos(mo) * 6.5, b.position.y + 1.2, 26 + Math.sin(mo) * 6.5); b.velocity.set(0, 0, 0);
    if (g.input) g.input.camYaw = mo; }`,
    toggle: `(g, cut) => { const m = g.scene.getObjectByName('finPlinths'); if (m) m.visible = !cut; }` },
  // noFinPolish's one GPU term is the held flash: a keepsake re-flashed every
  // 45 ms while it is live, as the coda does for its note (systems.js ~39440)
  finflash: { chapter: 'sydney', seed: true, flags: ['noFinPolish'], setup: `g => {
    const ph = g.physics, k = ['pasto', 'kyoto', 'rio', 'venice'].map(n => ph.keepOut(n)).find(Boolean);
    clearInterval(window.__proofFlash);
    window.__proofFlash = setInterval(() => { if (k && !g.state.noFinPolish) ph.flash(k, 24); }, 45); }` },
  // the noise floor: a flag nothing reads, measured the same way
  nullsyd: { chapter: 'sydney', flags: ['proofNothing'], hold: [0, 1.9, 1.6] },
  nulldrift: { chapter: 'drift', flags: ['proofNothing'] },
  // the cloud from inside it: the animal set down in open cloud (T4f's search)
  cloudin: { chapter: 'drift', flags: ['noCloudSoft'], rung: 0, setup: `g => {
    const d = g.drift, s = d.SPAWN;
    const clear = (x, z) => { for (let a = 0; a < 16; a++) for (const r of [0, 8, 16]) { if (d.terrainHeight(x + Math.cos(a * 0.3927) * r, z + Math.sin(a * 0.3927) * r) > d.waterLevel + 0.01) return false; } return true; };
    for (let r = 30; r <= 80; r += 5) for (let a = 0; a < 24; a++) {
      const x = s.x + Math.cos(a * 0.2618) * r, z = s.z + Math.sin(a * 0.2618) * r;
      if (clear(x, z)) { const b = g.capy.body; b.position.set(x, d.waterLevel + 1, z); b.velocity.set(0, 0, 0); return; }
    } }` },
  // the noise floor in the same frame, and the twelve low wisps on their own
  // (their visibility is written only when the flag's answer changes)
  get nullcloud() { return Object.assign({}, this.cloudin, { flags: ['proofNothing'] }); },
  get wisps() { return Object.assign({}, this.cloudin, { toggle: `(g, cut) => {
    let w = null; g.scene.traverse(o => { if (!w && o.isInstancedMesh && o.count === 12 && o.material && o.material.side === 1 && o.material.transparent) w = o; });
    if (w) w.visible = !cut; }` }); },
  // ...and at rung 1, where the low wisps park and the soft lobes and banks stay
  get cloudin1() { return Object.assign({}, this.cloudin, { rung: 1 }); },
  // the flood filling the frame at rung 1: T4d's river lens, pinned
  panriver: { chapter: 'pantanal', flags: ['noPanSkyFresnel'], rung: 1, setup: `g => {
    const raw = window.__proofRaw = g.post.render;
    g.post.render = function () {
      const c = g.camera; c.position.set(-18, 6.5, -44); c.lookAt(-40, 0, -78); c.updateMatrixWorld();
      return raw.apply(this, arguments);
    }; }` },
};

const h = await openHarness({ url: process.env.CAPY_QA_URL || 'http://localhost:5199/', width: 1280, height: 720 });
const p = h.page;
const out = { cases: want, rows: {}, renderer: h.metadata.renderer, errors: h.metadata.errors };
const wheek = async () => { await p.keyboard.down('KeyQ'); await p.waitForTimeout(90); await p.keyboard.up('KeyQ'); };
try {
  if (want.some(n => CASES[n] && CASES[n].seed)) {
    await p.evaluate(async () => {
      const m = await import('/src/shared.js');
      const seen = []; for (let k = 1; k <= 19; k++) seen.push(k);
      localStorage.setItem('capy3.journey.v1', JSON.stringify({ v: 1, tasks: m.TASKS.map(t => t.id), seen, recs: {}, told: 1, rtold: 1,
        ms: 9000000, chapms: {}, finds: [], foundAt: {}, biome: 'sydney', fin: 0, tut: 1, journeyMode: 'story', arcV1: 1 }));
    });
    await p.reload({ timeout: 150000 });
    await p.waitForFunction(() => !!window.__capy && !!document.querySelector('.capyui-go'), null, { timeout: 150000 });
    await p.waitForTimeout(1500);
  }
  await h.start();
  for (const name of want) {
    const C = CASES[name];
    if (!C) throw new Error('Unknown case ' + name);
    await h.arrive(C.chapter);
    await p.bringToFront();
    await p.waitForTimeout(3000);
    await p.evaluate(C => {
      const g = window.__capy;
      clearInterval(window.__proofHold);
      if (C.rung != null) g.state.perfRung = C.rung;
      if (C.setup) (0, eval)('(' + C.setup + ')')(g);
      if (C.hold) window.__proofHold = setInterval(() => {
        const b = g.capy.body, [x, y, z] = C.hold;
        if ((b.position.x - x) ** 2 + (b.position.z - z) ** 2 > 0.25 || b.position.y < y - 0.5) {
          b.position.set(x, y, z); b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
          b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        }
      }, 100);
    }, { setup: C.setup || null, rung: C.rung ?? null, hold: C.hold || null });
    await p.waitForTimeout(4500);
    if (C.wheek) { await wheek(); await p.waitForTimeout(1200); }
    const tog = C.toggle || `(g, cut) => { for (const f of ${JSON.stringify(C.flags)}) g.state[f] = cut; }`;
    // the same instant twice, canvas only (aaa-ab's grab)
    await p.evaluate(async ([tog, base]) => {
      const g = window.__capy, T = (0, eval)('(' + tog + ')');
      const grab = cut => { T(g, cut); g.tick(1e-4, true); return g.renderer.domElement.toDataURL('image/png').split(',')[1]; };
      const off = grab(true), on = grab(false);
      await fetch('/shot?name=' + base + '-off', { method: 'POST', body: off });
      await fetch('/shot?name=' + base + '-on', { method: 'POST', body: on });
    }, [tog, 'ten-t4-proof-' + name]);
    // the timer, with the notes kept coming for the concert
    const timed = p.evaluate(async ([tog, rung]) => {
      const g = window.__capy, gl = g.renderer.getContext(), T = (0, eval)('(' + tog + ')');
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      if (!ext) return { error: 'no timer query' };
      const raw = g.post.render, pending = [], on = [], off = [];
      let frame = 0, cut = false;
      g.post.render = function () {
        if (rung != null) g.state.perfRung = rung;
        const q = frame % 3 === 0 && pending.length < 8 ? gl.createQuery() : null;
        if (q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
        try { return raw.apply(this, arguments); } finally {
          if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push({ q, cut, settled: frame % 30 > 4 && frame >= 60 }); }
          if (++frame % 30 === 0) { cut = !cut; T(g, cut); }
        }
      };
      const poll = () => {
        if (gl.getParameter(ext.GPU_DISJOINT_EXT)) { pending.forEach(x => gl.deleteQuery(x.q)); pending.length = 0; return; }
        for (let i = pending.length - 1; i >= 0; i--) {
          const x = pending[i];
          if (!gl.getQueryParameter(x.q, gl.QUERY_RESULT_AVAILABLE)) continue;
          if (x.settled) (x.cut ? off : on).push(gl.getQueryParameter(x.q, gl.QUERY_RESULT) / 1e6);
          gl.deleteQuery(x.q); pending.splice(i, 1);
        }
      };
      const t0 = performance.now();
      while (performance.now() - t0 < 14000) { await new Promise(r => setTimeout(r, 50)); poll(); }
      g.post.render = raw; T(g, false);
      const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? +s[s.length >> 1].toFixed(3) : null; };
      return { frames: frame, nOn: on.length, nOff: off.length, liveMs: med(on), cutMs: med(off),
        deltaMs: med(on) != null && med(off) != null ? +(med(on) - med(off)).toFixed(3) : null,
        rung: g.state.perfRung, calls: g.renderer.info.render.calls, focus: document.hasFocus(),
        hidden: document.hidden, lastError: g.state.lastError || null };
    }, [tog, C.rung ?? null]);
    if (C.wheek) for (let i = 0; i < 3; i++) { await p.waitForTimeout(3000); await wheek(); }
    out.rows[name] = await timed;
    console.log(name, JSON.stringify(out.rows[name]));
    // ---- the payoff frame, live, the whole page (HUD included)
    if (name === 'concert') {
      out.rows[name].beat = await p.evaluate(() => { const e = window.__capy.env; return { beat: e.beatAudit(), concert: e.concertAudit() }; });
      await p.evaluate(() => window.__capy.env.operaShot(4));
      await p.waitForTimeout(2600);
    }
    if (name === 'cloud') {
      // a fall into open cloud, 30-80 m from the spawn (T4f's own search)
      out.rows[name].drop = await p.evaluate(() => {
        const g = window.__capy, d = g.drift, s = d.SPAWN;
        const clear = (x, z) => { for (let a = 0; a < 16; a++) for (const r of [0, 8, 16]) { if (d.terrainHeight(x + Math.cos(a * 0.3927) * r, z + Math.sin(a * 0.3927) * r) > d.waterLevel + 0.01) return false; } return true; };
        for (let r = 30; r <= 80; r += 5) for (let a = 0; a < 24; a++) {
          const x = s.x + Math.cos(a * 0.2618) * r, z = s.z + Math.sin(a * 0.2618) * r;
          if (clear(x, z)) { const b = g.capy.body; b.position.set(x, d.waterLevel + 14, z); b.velocity.set(0, 0, 0); return { x, z }; }
        }
        return null;
      });
      await p.waitForTimeout(2300);
    }
    await h.screenshot('ten-t4-proof-' + name + '-shot');
    if (name === 'pansky' || name === 'panriver') {
      await p.evaluate(() => { window.__capy.state.noPanSkyFresnel = true; });
      await p.waitForTimeout(1200);
      await h.screenshot('ten-t4-proof-' + name + '-shot-cut');
      await p.evaluate(() => { const g = window.__capy; g.state.noPanSkyFresnel = false; g.state.perfRung = 0; });
    }
    await p.evaluate(() => { const g = window.__capy; clearInterval(window.__proofHold); g.state.noLensCap = false; clearInterval(window.__proofFlash);
      if (window.__proofRaw) { g.post.render = window.__proofRaw; window.__proofRaw = null; } });
  }
  out.errors = h.metadata.errors;
  await h.result('ten-t4-proof-ab-' + want.join('-'), out);
  console.log('errors', out.errors.length, JSON.stringify(out.errors.slice(0, 3)).slice(0, 600));
} finally { await h.close(); }
