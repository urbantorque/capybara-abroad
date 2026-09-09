async page => {
  await page.reload(); await page.waitForTimeout(6500);
  await page.mouse.click(500, 400);
  await page.waitForTimeout(2500);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const res = {};
    for (const bn of ['venice','kowloon','palawan']) {
      g.biome.switchTo(bn);
      for (let i=0;i<180;i++) g.tick(1/60,false);
      g.renderer.render(g.scene, g.camera);
      const tri = g.renderer.info.render.triangles;
      const t0 = performance.now();
      for (let i=0;i<120;i++) g.tick(1/60,true);
      const ms = (performance.now()-t0)/120;
      res[bn] = { tri, ms: +ms.toFixed(2), calls: g.renderer.info.render.calls };
    }
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=w7.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
