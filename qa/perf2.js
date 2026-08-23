async page => {
  const names = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift','venice','kowloon','palawan','goreme'];
  const res = {};
  await page.evaluate(() => {
    const g = window.__capy;
    g.renderer.setSize(1600, 900, false);
    g.camera.aspect = 1600/900; g.camera.updateProjectionMatrix();
    window.dispatchEvent(new KeyboardEvent('keydown', {code:'Space', key:' ', bubbles:true}));
  });
  await page.waitForTimeout(1200);
  for (const n of names) {
    res[n] = await page.evaluate(async (name) => {
      function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
      const g = window.__capy;
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name), cb = g.capy.body;
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0,0,0);
      await sleep(1200);
      // real rAF frame times
      const ts = [];
      await new Promise(done => {
        let last = performance.now(), n2 = 0;
        function step(t){ ts.push(t - last); last = t; if (++n2 < 150) requestAnimationFrame(step); else done(); }
        requestAnimationFrame(step);
      });
      ts.sort((a,b)=>a-b);
      // scene-only draw calls: count what the scene render issues, before post
      const info = g.renderer.info;
      const prevAuto = info.autoReset;
      info.autoReset = false; info.reset();
      const rt = g.renderer.getRenderTarget();
      // MAIN PASS ONLY, which is what the numbers in CONTRACT.md have always been:
      // with autoReset on, three resets info after the shadow pass, so the
      // historic figures exclude it. Disabling the shadow map reproduces that.
      g.renderer.shadowMap.enabled = false;
      g.renderer.render(g.scene, g.camera);
      const calls = info.render.calls, tris = info.render.triangles;
      g.renderer.shadowMap.enabled = true;
      g.renderer.setRenderTarget(rt);
      info.autoReset = prevAuto;
      return { med: +ts[75].toFixed(2), p95: +ts[142].toFixed(2), calls, tris,
               progs: info.programs ? info.programs.length : -1 };
    }, n);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=perf2.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1))))});
  }, res);
}
