async page => {
  await page.waitForTimeout(3000);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    g.biome.switchTo('pasto');
    for (let i = 0; i < 120; i++) g.tick(1/60, false);
    const res = { meshes: [] };
    g.scene.traverse(o => {
      if (o.isMesh && o.name && o.name.indexOf('pasto') === 0) {
        o.geometry.computeBoundingBox();
        const b = o.geometry.boundingBox;
        res.meshes.push([o.name, o.castShadow, +b.min.y.toFixed(2), +b.max.y.toFixed(2)]);
      }
    });
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=zg.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
