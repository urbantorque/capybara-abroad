async page => {
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(8000);

  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const rows = [];
    // Defeat vsync: render N times inside one turn and divide. Measures the real
    // cost of a frame (CPU submit + GPU if the driver blocks), not the refresh.
    function cost(n) {
      // warm
      for (let i = 0; i < 4; i++) g.tick(1 / 60, true);
      const t0 = performance.now();
      for (let i = 0; i < n; i++) g.tick(1 / 60, true);
      return (performance.now() - t0) / n;
    }
    const c = document.querySelector('canvas');
    const cssW = window.innerWidth, cssH = window.innerHeight;
    const gl = g.renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');

    for (const scale of [0.5, 1.0, 1.5, 2.0, 2.5]) {
      g.renderer.setPixelRatio(scale);
      g.renderer.setSize(cssW, cssH, false);
      if (g.post && g.post.resize) g.post.resize();
      await new Promise(r => requestAnimationFrame(r));
      rows.push({ scale: scale, px: c.width + 'x' + c.height,
                  ms: Math.round(cost(30) * 100) / 100 });
    }
    g.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    g.renderer.setSize(cssW, cssH, false);
    if (g.post && g.post.resize) g.post.resize();

    // cost with post off, at scale 1, to separate scene from composite
    let postOff = null;
    if (g.post) {
      const was = g.post.enabled;
      g.post.enabled = false;
      postOff = Math.round(cost(30) * 100) / 100;
      g.post.enabled = was;
    }
    const withPost = Math.round(cost(30) * 100) / 100;

    // shadow map cost
    const sm = g.renderer.shadowMap;
    const shadowWas = sm.enabled;
    sm.enabled = false;
    g.scene.traverse(o => { if (o.isLight && o.shadow) o.castShadow = false; });
    const noShadow = Math.round(cost(30) * 100) / 100;
    sm.enabled = shadowWas;

    return {
      gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown',
      dpr: window.devicePixelRatio,
      viewport: cssW + 'x' + cssH,
      scaleSweep: rows,
      withPost: withPost, postOff: postOff, noShadow: noShadow,
      shadowMapSize: (() => { let s = null; g.scene.traverse(o => { if (o.isLight && o.shadow && o.castShadow) s = o.shadow.mapSize.width; }); return s; })(),
      drawCalls: (() => { g.renderer.info.autoReset = false; g.renderer.info.reset(); g.tick(1 / 60, true); return g.renderer.info.render.calls; })(),
      // is there ANY adaptive-quality state exposed?
      hasQualityApi: !!(g.quality || g.settings || (g.post && g.post.quality))
    };
  });

  await page.evaluate(o => fetch('/shot?name=v52-gpu.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
