async page => {
  await page.reload();
  await page.waitForFunction(() => window.__capy && window.__capy.biome, null, { timeout: 30000 });
  await page.keyboard.press('Digit1');
  await page.waitForFunction(() => window.__capy.state.started, null, { timeout: 20000 });
  await page.evaluate(() => window.__capy.biome.switchTo('palawan'));
  await page.waitForTimeout(3500);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    let root = null;
    g.scene.traverse(o => { if (o.name === 'palawan') root = o; });
    const per = [];
    root.traverse(c => {
      if (!c.isMesh || !c.geometry) return;
      const idx = c.geometry.index ? c.geometry.index.count : c.geometry.attributes.position.count;
      const n = (idx / 3) * (c.isInstancedMesh ? c.count : 1);
      if (n < 5000) return;
      c.geometry.computeBoundingBox();
      const b = c.geometry.boundingBox;
      per.push({ n: Math.round(n), name: c.name || '(unnamed)',
                 inst: c.isInstancedMesh ? c.count : 1,
                 min: [Math.round(b.min.x), Math.round(b.min.y), Math.round(b.min.z)],
                 max: [Math.round(b.max.x), Math.round(b.max.y), Math.round(b.max.z)],
                 mat: c.material && c.material.transparent ? 'transparent' : 'opaque',
                 vc: !!(c.geometry.attributes.color) });
    });
    per.sort((a, b) => b.n - a.n);
    return per;
  });
  await page.evaluate(async o => {
    await fetch('/shot?name=tri.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
