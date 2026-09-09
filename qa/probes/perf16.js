async page => {
  const names = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                 'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic'];
  await page.setViewportSize({width:1600, height:900});
  await page.waitForFunction(() => !!window.__capy && !!window.__capy.biome, null, {timeout: 25000});
  await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',bubbles:true})); });
  await page.waitForTimeout(1800);
  const res = {};
  for (const n of names) {
    res[n] = await page.evaluate(async (name) => {
      const g = window.__capy;
      g.biome.switchTo(name);
      const s = g.biome.spawnOf(name);
      g.capy.body.position.set(s.x, s.y, s.z); g.capy.body.velocity.set(0,0,0);
      await new Promise(r => setTimeout(r, 700));
      const ts = [];
      for (let i = 0; i < 90; i++) {
        const t0 = performance.now();
        await new Promise(r => requestAnimationFrame(r));
        ts.push(performance.now() - t0);
      }
      ts.sort((a,b)=>a-b);
      return { med: +ts[45].toFixed(1), p95: +ts[85].toFixed(1),
               draws: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles,
               bodies: g.world.bodies.length };
    }, n);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=perf16.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))});
  }, res);
}
