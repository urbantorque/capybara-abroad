async page => {
  await page.reload();
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi'];
  const out = { started: null, viewport: null, rows: {} };
  out.started = await page.evaluate(() => !!(window.__capy && window.__capy.state.started));
  out.viewport = await page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio, window.__capy.renderer.getPixelRatio()]);
  for (const n of names) {
    await page.evaluate((name) => { window.__capy.hud.cross(name); }, n);
    await page.waitForTimeout(4500);
    await page.evaluate(() => {
      const g = window.__capy;
      const R = g.renderer;
      R.info.autoReset = false;
      const S = { ft: [], tk: [], st: [], calls: [], tris: [], contacts: [], heap0: 0, heap1: 0, t0: g.state.time, long: 0, n: 0 };
      S.heap0 = performance.memory ? performance.memory.usedJSHeapSize : -1;
      const rawTick = g.tick, rawStep = g.world.step.bind(g.world), rawPost = g.post.render; S.po = [];
      g.post.render = function () { const t = performance.now(); const o = rawPost.apply(g.post, arguments); S.po.push(performance.now() - t); return o; };
      let lastF = 0;
      g.world.step = function (a, b, c) { const t = performance.now(); const o = rawStep(a, b, c); S.st.push(performance.now() - t); return o; };
      g.tick = function (dt, r) {
        const a = performance.now();
        if (lastF) { const f = a - lastF; S.ft.push(f); if (f > 50) S.long++; }
        lastF = a;
        R.info.reset();
        const o = rawTick.call(g, dt, r);
        S.tk.push(performance.now() - a);
        S.calls.push(R.info.render.calls); S.tris.push(R.info.render.triangles);
        S.contacts.push(g.world.contacts.length);
        S.n++;
        return o;
      };
      g.__l4 = { S, rawTick, rawStep, rawPost };
      // walk: W held, run, a turn every 2.5 s
      const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
      const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
      down('KeyW'); down('ShiftLeft');
      let k = 0;
      g.__l4.timer = setInterval(() => {
        k++;
        const key = (k & 1) ? 'KeyA' : 'KeyD';
        down(key); setTimeout(() => up(key), 700);
        if (k % 4 === 0) { down('Space'); setTimeout(() => up('Space'), 120); }
      }, 2500);
    });
    for (let i = 0; i < 4; i++) await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));
    out.rows[n] = await page.evaluate(() => {
      const g = window.__capy;
      const L = g.__l4;
      const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
      up('KeyW'); up('ShiftLeft'); up('KeyA'); up('KeyD'); up('Space');
      clearInterval(L.timer);
      g.tick = L.rawTick; g.world.step = L.rawStep; g.post.render = L.rawPost;
      const S = L.S;
      S.heap1 = performance.memory ? performance.memory.usedJSHeapSize : -1;
      const q = (arr, p) => { if (!arr.length) return 0; const s = arr.slice().sort((a, b) => a - b); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2); };
      const mean = arr => arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 0;
      const R = g.renderer;
      const mem = R.info.memory;
      let meshes = 0, inst = 0, lights = 0, shadowCasters = 0, texBytes = 0;
      const seenTex = new Set();
      g.scene.traverse(o => {
        let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) { vis = false; break; }
        if (!vis) return;
        if (o.isMesh) { meshes++; if (o.isInstancedMesh) inst++; if (o.castShadow) shadowCasters++; }
        if (o.isLight) lights++;
        const m = o.material; const mats = Array.isArray(m) ? m : (m ? [m] : []);
        for (const mm of mats) for (const key in mm) { const v = mm[key]; if (v && v.isTexture && v.image && !seenTex.has(v)) { seenTex.add(v); const im = v.image; const w = im.width || 0, h = im.height || 0; texBytes += w * h * 4 * (v.generateMipmaps ? 1.33 : 1); } }
      });
      const heapDelta = (S.heap1 > 0 && S.heap0 > 0) ? +((S.heap1 - S.heap0) / 1048576).toFixed(1) : null;
      return {
        biome: g.biome.current, started: g.state.started, timeAdv: +(g.state.time - S.t0).toFixed(1),
        frames: S.n, fps: S.ft.length ? +(1000 / mean(S.ft)).toFixed(1) : 0,
        frameMs: { mean: mean(S.ft), p95: q(S.ft, 0.95), max: q(S.ft, 1), over50: S.long },
        tickMs: { mean: mean(S.tk), p95: q(S.tk, 0.95), max: q(S.tk, 1) },
        stepMs: { mean: mean(S.st), p95: q(S.st, 0.95), max: q(S.st, 1) },
        postMs: { mean: mean(S.po), p95: q(S.po, 0.95), max: q(S.po, 1) },
        bodyShapes: (() => { const h = {}; for (const b of g.world.bodies) { const k = (b.mass <= 0 ? (b.type === 4 ? 'K' : 'S') : 'D') + ':' + (b.shapes[0] ? b.shapes[0].constructor.name : '?') + (b.sleepState === 2 ? ':zz' : ''); h[k] = (h[k] || 0) + 1; } return h; })(),
        calls: { mean: Math.round(mean(S.calls)), max: q(S.calls, 1) },
        tris: { mean: Math.round(mean(S.tris)), max: q(S.tris, 1) },
        programs: R.info.programs ? R.info.programs.length : -1,
        geometries: mem.geometries, textures: mem.textures, texMB: +(texBytes / 1048576).toFixed(1),
        meshes, instanced: inst, lights, shadowCasters,
        bodies: g.world.bodies.length, contacts: { mean: Math.round(mean(S.contacts)), max: q(S.contacts, 1) },
        props: g.props.length, npcs: g.npcs.length, locals: (g.locals || []).length,
        sceneChildren: g.scene.children.length,
        heapMB: S.heap1 > 0 ? +(S.heap1 / 1048576).toFixed(1) : null, heapDeltaMB: heapDelta,
        dpr: +R.getPixelRatio().toFixed(2),
        pos: [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(1), +g.capy.position.z.toFixed(1)],
        lastError: g.state.lastError || null,
      };
    });
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4r-qa-perf.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
