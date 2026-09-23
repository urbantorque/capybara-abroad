// AAA: what a chapter's frame is made of. Times the GPU cost of post.render
// (scene + passes) by timer query while one experiment at a time alternates
// on/off in blocks of 30 frames: all shadow casting off, the biggest meshes
// hidden, the instanced meshes hidden, the scene's biggest-triangle meshes'
// shadows off. Diagnostic: tells where the milliseconds are, not what to cut.
//   node qa/aaa-cost.mjs <chapter>
import { openHarness } from './reimagine-harness.mjs';

const chapter = process.argv[2] || 'hanoi';
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ width: 1280, height: 720 });
try {
  await h.start(); await h.arrive(chapter); await h.page.bringToFront(); await h.page.waitForTimeout(5000);
  const out = await h.page.evaluate(async () => {
    const g = window.__capy, gl = g.renderer.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const all = []; g.scene.traverse(o => { if (o.isMesh && o.visible) all.push(o); });
    const tris = o => ((o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3) * (o.isInstancedMesh ? o.count : 1);
    all.sort((a, b) => tris(b) - tris(a));
    const inst = all.filter(o => o.isInstancedMesh);
    const casters = all.filter(o => o.castShadow);
    const exps = {
      'shadows off': [casters, o => { o.castShadow = false; }, o => { o.castShadow = true; }],
      'top 10 meshes hidden': [all.slice(0, 10), o => { o.visible = false; }, o => { o.visible = true; }],
      'instanced hidden': [inst, o => { o.visible = false; }, o => { o.visible = true; }],
      'top 10 no shadow': [all.slice(0, 10).filter(o => o.castShadow), o => { o.castShadow = false; }, o => { o.castShadow = true; }],
    };
    const res = { meshes: all.length, instanced: inst.length, casters: casters.length,
      top: all.slice(0, 10).map(o => ({ name: o.name || (o.parent && o.parent.name) || o.type, tris: tris(o), shadow: o.castShadow, inst: o.isInstancedMesh ? o.count : 0 })) };
    for (const [name, [set, on, off]] of Object.entries(exps)) {
      const raw = g.post.render, pending = [], a = [], b = [];
      let frame = 0, cut = false;
      g.post.render = function () {
        const q = frame % 3 === 0 && pending.length < 8 ? gl.createQuery() : null;
        if (q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
        try { return raw.apply(this, arguments); } finally {
          if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push({ q, cut, settled: frame % 30 > 4 }); }
          if (++frame % 30 === 0) { cut = !cut; set.forEach(cut ? on : off); }
        }
      };
      const t0 = performance.now();
      while (performance.now() - t0 < 8000) {
        await new Promise(r => setTimeout(r, 50));
        if (gl.getParameter(ext.GPU_DISJOINT_EXT)) { pending.forEach(p => gl.deleteQuery(p.q)); pending.length = 0; continue; }
        for (let i = pending.length - 1; i >= 0; i--) { const p = pending[i]; if (!gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) continue; if (p.settled) (p.cut ? b : a).push(gl.getQueryParameter(p.q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(p.q); pending.splice(i, 1); }
      }
      g.post.render = raw; set.forEach(off);
      const med = x => { const s = x.slice().sort((p, q) => p - q); return s.length ? +s[s.length >> 1].toFixed(2) : null; };
      res[name] = { live: med(a), cut: med(b), saves: med(a) != null && med(b) != null ? +(med(a) - med(b)).toFixed(2) : null };
    }
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
} finally { await h.close(); }
