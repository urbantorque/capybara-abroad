async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(3000);
  await page.keyboard.press('KeyQ');
  await wait(500);

  await page.evaluate(() => {
    const g = window.__capy;
    const C = { audio: 0, audioBy: {}, geoSites: {}, ft: [] };
    window.__rv = C;
    const B = window.BaseAudioContext && window.BaseAudioContext.prototype;
    if (B) for (const k of Object.getOwnPropertyNames(B)) {
      if (!/^create/.test(k)) continue;
      let d; try { d = Object.getOwnPropertyDescriptor(B, k); } catch (e) { continue; }
      if (!d || typeof d.value !== 'function') continue;
      const raw = d.value;
      B[k] = function () { C.audio++; C.audioBy[k] = (C.audioBy[k] || 0) + 1; return raw.apply(this, arguments); };
    }
    // Attribute first-render of a geometry to the src line that made it render.
    const P = g.THREE.BufferGeometry.prototype;
    const rawCBS = P.computeBoundingSphere;
    P.computeBoundingSphere = function () {
      if (!this.__rvSeen) {
        this.__rvSeen = 1;
        if (C.on) {
          const st = (new Error().stack || '').split('\n').map(s => s.trim());
          const src = st.filter(s => /\/src\//.test(s)).slice(0, 3).map(s => s.replace(/^at\s+/, '').replace(/.*\/src\//, 'src/').replace(/\)$/, ''));
          const key = src.join(' <- ') || 'unknown';
          C.geoSites[key] = (C.geoSites[key] || 0) + 1;
        }
      }
      return rawCBS.apply(this, arguments);
    };
    let last = performance.now();
    const raf = () => { const n = performance.now(); C.ft.push(n - last); last = n; requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    return true;
  });

  const ftStats = () => page.evaluate(() => {
    const C = window.__rv; const a = C.ft.slice().sort((x, y) => x - y); C.ft.length = 0;
    return a.length ? { n: a.length, med: +a[a.length >> 1].toFixed(2), p95: +a[Math.floor(a.length * 0.95)].toFixed(2), mean: +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(2) } : null;
  });
  const geos = () => page.evaluate(() => window.__capy.renderer.info.memory.geometries);

  const out = { fresh: {}, churn: [], after: {} };
  await wait(2000);
  await ftStats();
  await wait(15000);
  out.fresh.ft = await ftStats();
  out.fresh.geos = await geos();
  out.fresh.audio = await page.evaluate(() => window.__rv.audio);

  const CH = ['hanoi', 'goreme', 'palawan', 'monaco', 'iceland', 'venice', 'kyoto', 'cali', 'pantanal', 'sahara'];
  for (const name of CH) {
    await page.evaluate(function (n) {
      const g = window.__capy; g.biome.switchTo(n);
      const sp = g.biome.spawnOf(n), b = g.capy.body;
      if (sp) { b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0); }
      return true;
    }, name);
    await wait(3000);
    const g0 = await geos();
    const a0 = await page.evaluate(() => { const C = window.__rv; C.geoSites = {}; C.on = true; return C.audio; });
    await wait(10000);
    const g1 = await geos();
    const row = await page.evaluate(function (n) {
      const g = window.__capy, C = window.__rv; C.on = false;
      const sites = Object.entries(C.geoSites).sort((a, b) => b[1] - a[1]).slice(0, 6);
      return { n: n, biome: g.biome.current, audio: C.audio, sites: sites, audioBy: C.audioBy };
    }, name);
    row.geos0 = g0; row.geos1 = g1; row.dGeosPer10s = g1 - g0; row.dAudio = row.audio - a0;
    out.churn.push(row);
  }

  await page.evaluate(function () {
    const g = window.__capy; g.biome.switchTo('sydney');
    const sp = g.biome.spawnOf('sydney'), b = g.capy.body;
    if (sp) { b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0); }
    return true;
  });
  await wait(3000);
  await ftStats();
  await wait(15000);
  out.after.ft = await ftStats();
  out.after.geos = await geos();
  out.after.progs = await page.evaluate(() => window.__capy.renderer.info.programs.length);
  out.after.audioBy = await page.evaluate(() => window.__rv.audioBy);

  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=rv-churn.json', { method: 'POST', body: s }), bl);
}
