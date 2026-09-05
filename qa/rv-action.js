async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(3000);
  await page.evaluate(() => {
    const g = window.__capy;
    const C = { geoSites: {}, on: false, geoMade: 0 };
    window.__rv = C;
    const P = g.THREE.BufferGeometry.prototype;
    const rawCBS = P.computeBoundingSphere;
    P.computeBoundingSphere = function () {
      if (!this.__rvSeen) {
        this.__rvSeen = 1;
        if (C.on) {
          C.geoMade++;
          const st = (new Error().stack || '').split('\n').map(s => s.trim());
          const src = st.filter(s => /\/src\//.test(s)).slice(0, 4).map(s => s.replace(/^at\s+/, '').replace(/.*\/src\//, 'src/').replace(/\)$/, ''));
          const key = src.join(' <- ') || 'unknown';
          C.geoSites[key] = (C.geoSites[key] || 0) + 1;
        }
      }
      return rawCBS.apply(this, arguments);
    };
    return true;
  });
  const geos = () => page.evaluate(() => window.__capy.renderer.info.memory.geometries);
  const begin = () => page.evaluate(() => { const C = window.__rv; C.geoSites = {}; C.geoMade = 0; C.on = true; return true; });
  const end = () => page.evaluate(() => { const C = window.__rv; C.on = false; return { made: C.geoMade, sites: Object.entries(C.geoSites).sort((a, b) => b[1] - a[1]).slice(0, 5) }; });
  const out = [];
  const go = n => page.evaluate(function (n) {
    const g = window.__capy; g.biome.switchTo(n);
    const sp = g.biome.spawnOf(n), b = g.capy.body;
    if (sp) { b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0); }
    return true;
  }, n);
  const phases = [
    { name: 'idle', run: async () => { await wait(8000); } },
    { name: 'wheek x10', run: async () => { for (let i = 0; i < 10; i++) { await page.keyboard.press('KeyQ'); await wait(700); } } },
    { name: 'grab/dig E x10', run: async () => { for (let i = 0; i < 10; i++) { await page.keyboard.down('KeyE'); await wait(300); await page.keyboard.up('KeyE'); await wait(500); } } },
    { name: 'hop x10', run: async () => { for (let i = 0; i < 10; i++) { await page.keyboard.press('Space'); await wait(800); } } },
    { name: 'walk W 8s', run: async () => { await page.keyboard.down('KeyW'); await wait(8000); await page.keyboard.up('KeyW'); } },
    { name: 'run Shift+W 8s', run: async () => { await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await wait(8000); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft'); } },
    { name: 'slide G while run 6s', run: async () => { await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await wait(1500); await page.keyboard.down('KeyG'); await wait(4500); await page.keyboard.up('KeyG'); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft'); } },
  ];
  for (const n of ['hanoi', 'goreme']) {
    await go(n);
    await wait(3000);
    for (const ph of phases) {
      const g0 = await geos();
      await begin();
      await ph.run();
      await wait(600);
      const r = await end();
      const g1 = await geos();
      out.push({ biome: n, phase: ph.name, geos0: g0, geos1: g1, d: g1 - g0, made: r.made, sites: r.sites });
    }
  }
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), { out });
  await page.evaluate(s => fetch('/shot?name=rv-action.json', { method: 'POST', body: s }), bl);
}
