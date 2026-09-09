async page => {
  await page.reload(); await page.waitForTimeout(5500);
  await page.mouse.click(400, 400); await page.waitForTimeout(2500);
  // WORST CASE ON PURPOSE: all seventeen keepsakes out, in every chapter.
  await page.evaluate(() => {
    const g = window.__capy;
    const places = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                    'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic'];
    const c = g.capy.position;
    for (let i = 0; i < places.length; i++) {
      const a = i * 2.4, r = 1.5 + i * 0.25;
      g.physics.spawnKeep(places[i], c.x + Math.cos(a) * r, c.z + Math.sin(a) * r);
    }
  });
  await page.waitForTimeout(1500);
  const names = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                 'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic'];
  const out = {};
  for (const n of names) {
    out[n] = await page.evaluate(async (name) => {
      function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
      const g = window.__capy;
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name), b = g.capy.body;
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      await sleep(2600);
      g.renderer.info.reset();
      const ts = []; let last = performance.now(); const t0 = last;
      while (performance.now() - t0 < 4000) {
        await new Promise(r => requestAnimationFrame(r));
        const now = performance.now(); ts.push(now - last); last = now;
      }
      ts.sort((a,c)=>a-c);
      const inf = g.renderer.info.render;
      return { median: +ts[(ts.length*0.5)|0].toFixed(2), p95: +ts[(ts.length*0.95)|0].toFixed(2),
               calls: inf.calls, tris: inf.triangles,
               bodies: g.world.bodies.length,
               keeps: g.props.filter(p => p.keep && !p.removed).length,
               err: g.state.lastError || null };
    }, n);
  }
  await page.evaluate((o) => fetch('/shot?name=w34perf.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
