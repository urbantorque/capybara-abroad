// AAA pass: one flag, A/B, on the reference GPU in headful Edge.
//   node qa/aaa-ab.mjs <tag> <flag[,flag]> [chapter ...]
// For each chapter: a picture with the flag set (the term cut) and one with
// it clear (live), 300 ms apart, and the GPU elapsed time of post.render
// (scene + every pass) sampled by timer query while the flag alternates in
// blocks of 30 frames — alternation is what cancels the scene's own drift.
// Pictures go to qa/aaa-<tag>-<chapter>-{off,on}.png, numbers to
// qa/aaa-<tag>.json.png. Diagnostic, not an FPS claim.
import { openHarness } from './reimagine-harness.mjs';

const [tag = 'ab', flagArg = 'noAO', ...rest] = process.argv.slice(2);
const flags = flagArg.split(',');
const list = rest.length ? rest : ['sydney', 'kyoto', 'venice', 'sahara'];
process.env.CAPY_QA_MUTE_AUDIO = '1';
process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ width: 1280, height: 720 });
const out = { tag, flags, rows: {}, errors: h.metadata.errors };
const setFlags = v => h.page.evaluate(([fl, v]) => { for (const f of fl) window.__capy.state[f] = v; }, [flags, v]);
try {
  await h.start();
  // AB_PRESET=noX,noY: flags set true once, before any chapter below is BUILT
  // (ROADMAP-TEN V4: noBevelWorld is read at build, so it cannot alternate)
  if (process.env.AB_PRESET) await h.page.evaluate(fl => { for (const f of fl) window.__capy.state[f] = true; }, process.env.AB_PRESET.split(','));
  for (const c of list) {
    await h.arrive(c);
    await h.page.bringToFront();
    await h.page.waitForTimeout(4000);
    // The same instant twice: a 0.1 ms tick straight after the flag, read
    // back in the same task (the drawing buffer is not preserved, but it has
    // not been presented yet). Nothing between the two draws can move, so the
    // difference is the term and nothing else. Canvas only, no HUD.
    const at = await h.page.evaluate(async ([fl, base]) => {
      // Both drawn and read before the first await: an await is a yield, and
      // a yield is a rAF that moves the world between the two pictures.
      const g = window.__capy, grab = cut => {
        for (const f of fl) g.state[f] = cut;
        // a tick, not a bare render: uniforms written in update (the shadow
        // switch) would otherwise keep the last frame's value. 1e-4 s moves nothing.
        g.tick(1e-4, true);
        return g.renderer.domElement.toDataURL('image/png').split(',')[1];
      };
      const off = grab(true), on = grab(false);
      await fetch('/shot?name=' + base + '-off', { method: 'POST', body: off });
      await fetch('/shot?name=' + base + '-on', { method: 'POST', body: on });
      // where the animal is on the canvas, for a crop
      const v = g.capy.group.position.clone(); v.y += 0.4; v.project(g.camera);
      const c = g.renderer.domElement;
      return [Math.round((v.x * 0.5 + 0.5) * c.width), Math.round((0.5 - v.y * 0.5) * c.height)];
    }, [flags, `aaa-${tag}-${c}`]);
    console.log('capy-at', c, at.join(' '));
    out.rows[c] = await h.page.evaluate(async fl => {
      const g = window.__capy, gl = g.renderer.getContext();
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      if (!ext) return { error: 'no timer query' };
      const raw = g.post.render, pending = [], on = [], off = [];
      let frame = 0, cut = false;
      // Every third frame, never more than eight in flight: a query per frame
      // with no cap stalled ANGLE to one frame a second (measured, 12 frames
      // in 12 s), which is qa/homecoming-gpu.mjs's reason for the same rule.
      g.post.render = function () {
        const q = frame % 3 === 0 && pending.length < 8 ? gl.createQuery() : null;
        if (q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
        try { return raw.apply(this, arguments); } finally {
          if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push({ q, cut, settled: frame % 30 > 4 }); }
          if (++frame % 30 === 0) { cut = !cut; for (const f of fl) g.state[f] = cut; }
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
      let raf = 0; const tick = () => { raf++; if (performance.now() - t0 < 12000) requestAnimationFrame(tick); };
      const t0 = performance.now(); requestAnimationFrame(tick);
      while (performance.now() - t0 < 12000) { await new Promise(r => setTimeout(r, 50)); poll(); }
      g.post.render = raw; for (const f of fl) g.state[f] = false;
      const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? +s[s.length >> 1].toFixed(3) : null; };
      return { frames: frame, raf, hold: !!g.state.renderHold, paused: !!g.state.paused, focus: document.hasFocus(), hidden: document.hidden, nOn: on.length, nOff: off.length, liveMs: med(on), cutMs: med(off),
        deltaMs: med(on) != null && med(off) != null ? +(med(on) - med(off)).toFixed(3) : null,
        rung: g.state.perfRung, lastError: g.state.lastError || null };
    }, flags);
    console.log(c, JSON.stringify(out.rows[c]));
  }
  await h.result(`aaa-${tag}`, out);
  console.log('errors', out.errors.length, JSON.stringify(out.errors.slice(0, 3)).slice(0, 600));
} finally { await h.close(); }
