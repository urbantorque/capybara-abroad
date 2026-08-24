async page => {
  await page.reload(); await page.waitForTimeout(5200);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const res = {};
    const vis = (n) => { let p = n; while (p) { if (!p.visible) return false; p = p.parent; } return true; };
    const measure = () => {
      let t = 0, m = 0;
      g.scene.traverse(n => {
        if (!n.isMesh || !n.geometry || !vis(n)) return;
        const ix = n.geometry.index;
        const c = ix ? ix.count : (n.geometry.attributes.position ? n.geometry.attributes.position.count : 0);
        t += (c / 3) * (n.isInstancedMesh ? n.count : 1); m++;
      });
      return { tris: Math.round(t), meshes: m };
    };
    for (const b of ['iceland', 'sahara', 'drift']) {
      g.biome.switchTo(b);
      for (let i = 0; i < 200; i++) g.tick(1 / 60, false);
      const r = measure();
      r.bodies = g.world.bodies.length;
      r.calls = g.renderer.info.render.calls;
      res[b] = r;
    }
    res.err = g.state.lastError || null;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=y7.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
