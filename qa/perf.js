async page => {
  await page.reload(); await page.waitForTimeout(5000);
  const biomes = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift','venice','kowloon','palawan','goreme'];
  const out = [];
  await page.evaluate(() => {
    const g = window.__capy;
    g.renderer.setSize(1600, 900, false);
    g.camera.aspect = 1600/900; g.camera.updateProjectionMatrix();
    window.dispatchEvent(new KeyboardEvent('keydown', {code:'Space', key:' ', bubbles:true}));
  });
  await page.waitForTimeout(1500);
  for (const b of biomes) {
    const r = await page.evaluate(async (name) => {
      const g = window.__capy;
      g.biome.switchTo(name);
      const s = g.biome.spawnOf(name);
      if (g.capy && g.capy.body) { g.capy.body.position.set(s.x, s.y, s.z); g.capy.body.velocity.set(0,0,0); }
      for (let i=0;i<180;i++) g.tick(1/60,false);
      // measure render-only cost with real frames
      await new Promise(r => requestAnimationFrame(r));
      const t0 = performance.now();
      let n = 0;
      while (performance.now() - t0 < 1200) { g.tick(1/60, true); n++; }
      const ms = (performance.now() - t0) / n;
      const info = g.renderer.info;
      return { name, ms: +ms.toFixed(2), calls: info.render.calls, tris: info.render.triangles,
               progs: info.programs ? info.programs.length : -1, geoms: info.memory.geometries, texs: info.memory.textures };
    }, b);
    out.push(r);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=perf.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1))))});
  }, out);
}
