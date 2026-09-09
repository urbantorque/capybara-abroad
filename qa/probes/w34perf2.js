async page => {
  await page.reload(); await page.waitForTimeout(5500);
  await page.mouse.click(400, 400); await page.waitForTimeout(2500);
  const names = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                 'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic'];
  const out = { base: {}, withKeeps: {} };
  const sweep = async (bucket) => {
    for (const n of names) {
      out[bucket][n] = await page.evaluate(async (name) => {
        function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
        const g = window.__capy;
        g.biome.switchTo(name);
        const sp = g.biome.spawnOf(name), b = g.capy.body;
        b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        await sleep(2200);
        // autoReset OFF, or every render() in the post chain wipes the counters
        // and what comes back is the composite quad: one call, one triangle.
        g.renderer.info.autoReset = false;
        g.renderer.info.reset();
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => requestAnimationFrame(r));
        const inf = g.renderer.info.render;
        const res = { calls: inf.calls, tris: inf.triangles,
                      bodies: g.world.bodies.length,
                      keeps: g.props.filter(p => p.keep && !p.removed).length };
        g.renderer.info.autoReset = true;
        return res;
      }, n);
    }
  };
  await sweep('base');
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
  await sweep('withKeeps');
  await page.evaluate((o) => fetch('/shot?name=w34perf2.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
