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
        await sleep(2000);
        // ONE scene render, straight to the canvas, with the post chain out of
        // it entirely — which is the figure CONTRACT's 43-to-122 was measured as.
        const sm = g.renderer.shadowMap.enabled;
        g.renderer.shadowMap.enabled = false;
        g.renderer.setRenderTarget(null);
        g.renderer.info.autoReset = false;
        g.renderer.info.reset();
        g.renderer.render(g.scene, g.camera);
        const inf = g.renderer.info.render;
        const res = { calls: inf.calls, tris: inf.triangles, bodies: g.world.bodies.length };
        g.renderer.info.autoReset = true;
        g.renderer.shadowMap.enabled = sm;
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
  await page.evaluate((o) => fetch('/shot?name=w34calls.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
