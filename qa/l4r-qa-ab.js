async page => {
  await page.reload();
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  const out = {};
  for (const n of ['hanoi', 'goreme', 'monaco', 'kyoto']) {
    await page.evaluate((name) => { window.__capy.hud.cross(name); }, n);
    await page.waitForTimeout(5000);
    out[n] = await page.evaluate(async () => {
      const g = window.__capy, R = g.renderer;
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
      const mean = arr => arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 0;
      const q = (arr, p) => { if (!arr.length) return 0; const s = arr.slice().sort((a, b) => a - b); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2); };
      let sun = null; g.scene.traverse(o => { if (o.isDirectionalLight && o.castShadow) sun = o; });
      const measure = async (label, ms) => {
        const ft = [], po = [], tk = []; let lastF = 0, calls = 0, tris = 0, n = 0;
        R.info.autoReset = false;
        const rawTick = g.tick, rawPost = g.post.render;
        g.post.render = function () { const t = performance.now(); const o = rawPost.apply(g.post, arguments); po.push(performance.now() - t); return o; };
        g.tick = function (dt, r) { const a = performance.now(); if (lastF) ft.push(a - lastF); lastF = a; R.info.reset(); const o = rawTick.call(g, dt, r); tk.push(performance.now() - a); calls += R.info.render.calls; tris += R.info.render.triangles; n++; return o; };
        await sleep(ms);
        g.tick = rawTick; g.post.render = rawPost;
        return { label, frames: n, frameMs: mean(ft), p95: q(ft, 0.95), tickMs: mean(tk), postMs: mean(po), simMs: +(mean(tk) - mean(po)).toFixed(2), calls: Math.round(calls / Math.max(1, n)), tris: Math.round(tris / Math.max(1, n)) };
      };
      const rows = [];
      // standing still: the same frame each time
      rows.push(await measure('base', 6000));
      R.shadowMap.enabled = false; R.shadowMap.needsUpdate = true; g.scene.traverse(o => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) m.needsUpdate = true; } });
      await sleep(800);
      rows.push(await measure('noShadow', 6000));
      R.shadowMap.enabled = true; R.shadowMap.needsUpdate = true; g.scene.traverse(o => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) m.needsUpdate = true; } });
      await sleep(800);
      rows.push(await measure('base2', 5000));
      if (sun) { sun.shadow.mapSize.set(1024, 1024); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } await sleep(500); rows.push(await measure('shadow1024', 6000)); sun.shadow.mapSize.set(2048, 2048); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } await sleep(500); }
      g.state.noDof = true; g.state.noAir = true; g.state.noCrease = true; g.state.noAirLight = true; g.state.noDepth = true;
      await sleep(800);
      rows.push(await measure('noPostTerms', 6000));
      g.state.noDof = false; g.state.noAir = false; g.state.noCrease = false; g.state.noAirLight = false; g.state.noDepth = false;
      const pr = R.getPixelRatio();
      R.setPixelRatio(pr * 0.5); R.setSize(innerWidth, innerHeight);
      await sleep(800);
      rows.push(await measure('halfDPR', 6000));
      R.setPixelRatio(pr); R.setSize(innerWidth, innerHeight);
      await sleep(800);
      rows.push(await measure('base3', 5000));
      // shadow casters by size
      let casters = 0, small = 0, smallTris = 0; const sph = new g.THREE.Sphere();
      g.scene.traverse(o => { if (!o.isMesh || !o.castShadow) return; let v = true; for (let p = o; p; p = p.parent) if (!p.visible) { v = false; break; } if (!v) return; casters++; const geo = o.geometry; if (!geo.boundingSphere) geo.computeBoundingSphere(); const s = o.getWorldScale(new g.THREE.Vector3()); const r = geo.boundingSphere.radius * Math.max(s.x, s.y, s.z); if (r < 0.35) { small++; const idx = geo.index; smallTris += (idx ? idx.count : geo.attributes.position.count) / 3; } });
      return { biome: g.biome.current, dpr: pr, drawing: (() => { const s = R.getDrawingBufferSize(new g.THREE.Vector2()); return [s.x, s.y]; })(), rows, casters, smallCasters: small, smallCasterTris: Math.round(smallTris), err: g.state.lastError || null };
    });
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4r-qa-ab.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
