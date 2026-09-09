async page => {
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(9000);

  const out = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const res = performance.getEntriesByType('resource').map(r => ({
      n: r.name.split('/').pop(), ms: Math.round(r.duration), kb: Math.round((r.transferSize || r.encodedBodySize || 0) / 1024)
    })).filter(r => r.kb > 20 || r.ms > 60);
    res.sort((a, b) => b.ms - a.ms);
    const g = window.__capy;
    // when did the boot splash go away
    const boot = document.getElementById('boot');
    return {
      navType: nav.type,
      domInteractive: Math.round(nav.domInteractive || 0),
      domComplete: Math.round(nav.domComplete || 0),
      loadEnd: Math.round(nav.loadEventEnd || 0),
      firstPaint: Math.round((performance.getEntriesByType('paint')[0] || {}).startTime || 0),
      resources: res.slice(0, 14),
      totalResourceKb: Math.round(performance.getEntriesByType('resource')
        .reduce((s, r) => s + (r.transferSize || r.encodedBodySize || 0), 0) / 1024),
      bootGone: !boot || boot.classList.contains('hidden'),
      hasGame: !!g,
      started: g && g.state && g.state.started,
      biome: g && g.biome && g.biome.current,
      gameTime: g && g.state && Math.round(g.state.time * 10) / 10,
      dpr: window.devicePixelRatio,
      canvasSize: (() => { const c = document.querySelector('canvas'); return c ? c.width + 'x' + c.height : null; })(),
      lastError: g && g.state && g.state.lastError || null
    };
  });

  // frame-time sample at native size, 60 frames
  const perf = await page.evaluate(() => new Promise(resolve => {
    const t = [];
    let last = performance.now();
    function f() {
      const n = performance.now(); t.push(n - last); last = n;
      if (t.length < 120) requestAnimationFrame(f);
      else { t.sort((a, b) => a - b); resolve({ median: Math.round(t[60] * 100) / 100, p95: Math.round(t[113] * 100) / 100, worst: Math.round(t[119] * 100) / 100 }); }
    }
    requestAnimationFrame(f);
  }));
  out.frame = perf;

  await page.evaluate(o => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1))));
    return fetch('/shot?name=v52-boot.json', { method: 'POST', body: s });
  }, out);
}
