// ROADMAP-TEN T3 proof slot: qa/aaa-ab.mjs with the flag replaced by a part.
//   node qa/ten-t3-proof-ab.mjs <tag> <chapter> <part> [x,z]
// Same timer-query alternation (blocks of 30 frames, every third frame
// queried, eight in flight) as aaa-ab, but what alternates is one piece of a
// flagged term, so a live cost over budget can be split into its parts:
//   willow        game.state.noHanWillow (the whole term, as aaa-ab)
//   willowShadow  the crowns', trunks' and boat's castShadow
//   willowSway    the crowns' swayed material against the plain one
//   flag:noX      any game.state flag (aaa-ab on a chosen spot)
//   null          nothing (the noise floor on the same lens)
// [x,z] sets the animal down there first and waits for the lens; torii:k sets
// it on Kyoto's gate k (game.kyoto.toriiPath()), where the rail lens frames it.
import { openHarness } from './reimagine-harness.mjs';

const [tag = 'part', chapter = 'hanoi', part = 'null', at = ''] = process.argv.slice(2);
process.env.CAPY_QA_MUTE_AUDIO = '1';
process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ width: 1280, height: 720 });
const out = { tag, chapter, part, at, errors: h.metadata.errors };
try {
  await h.start();
  await h.arrive(chapter);
  await h.page.bringToFront();
  if (at) {
    await h.page.evaluate(at => {
      const g = window.__capy, b = g.capy.body;
      let x, z;
      if (at.startsWith('torii:')) { const P = g.kyoto.toriiPath(), k = +at.slice(6); x = P[k * 2]; z = P[k * 2 + 1]; }
      else [x, z] = at.split(',').map(Number);
      const y = g.kyoto && g.kyoto.terrainHeight ? g.kyoto.terrainHeight(x, z) : (g.groundY ? g.groundY(x, z) : b.position.y);
      b.position.set(x, y + 0.6, z); b.velocity.set(0, 0, 0);
    }, at);
  }
  await h.page.waitForTimeout(4000);
  out.row = await h.page.evaluate(async part => {
    const g = window.__capy, gl = g.renderer.getContext();
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (!ext) return { error: 'no timer query' };
    // the willow group: trunks (n), crowns (n), lotus, boat, in that order
    let W = null;
    g.scene.traverse(o => {
      const c = o.children;
      if (!W && o.isGroup && c.length === 4 && c[0].isInstancedMesh && c[1].isInstancedMesh &&
          c[2].isInstancedMesh && c[3].isMesh && !c[3].isInstancedMesh &&
          g.hanoi && c[0].count === g.hanoi.willow().n) W = c;
    });
    const sway = W && W[1].material;
    // the game's own plain crown material: the one hanWillowTick swaps in at
    // rung 1 (a hand-made copy dropped mat()'s own hooks and read 0.45-0.77 ms
    // of work that is not the sway's)
    let flatMat = null;
    if (W && part === 'willowSway') {
      g.state.perfRung = 1; g.tick(1e-4, false); flatMat = W[1].material;
      g.state.perfRung = 0; g.tick(1e-4, false);
    }
    const set = cut => {
      if (part === 'willow') g.state.noHanWillow = cut;
      else if (part.startsWith('flag:')) g.state[part.slice(5)] = cut;
      else if (part === 'willowShadow' && W) { W[0].castShadow = W[1].castShadow = W[3].castShadow = !cut; }
      else if (part === 'willowSway' && W) {
        W[1].material = cut ? flatMat : sway;
      }
    };
    const raw = g.post.render, pending = [], on = [], off = [];
    let frame = 0, cut = false;
    g.post.render = function () {
      const q = frame % 3 === 0 && pending.length < 8 ? gl.createQuery() : null;
      if (q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      try { return raw.apply(this, arguments); } finally {
        if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push({ q, cut, settled: frame % 30 > 4 }); }
        if (++frame % 30 === 0) { cut = !cut; set(cut); }
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
    while (performance.now() - t0 < 16000) { await new Promise(r => setTimeout(r, 50)); poll(); }
    g.post.render = raw; set(false);
    const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? +s[s.length >> 1].toFixed(3) : null; };
    return { found: !!W, flatIsOwn: !!(flatMat && flatMat !== sway), frames: frame, nOn: on.length, nOff: off.length, liveMs: med(on), cutMs: med(off),
      deltaMs: med(on) != null && med(off) != null ? +(med(on) - med(off)).toFixed(3) : null,
      rung: g.state.perfRung, lastError: g.state.lastError || null };
  }, part);
  console.log(chapter, part, JSON.stringify(out.row));
  await h.result(`ten-t3-proof-ab-${tag}`, out);
} finally { await h.close(); }
