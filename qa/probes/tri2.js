async page => {
  await page.reload();
  await page.waitForFunction(() => window.__capy && window.__capy.biome, null, { timeout: 30000 });
  await page.keyboard.press('Digit1');
  await page.waitForFunction(() => window.__capy.state.started, null, { timeout: 20000 });
  await page.evaluate(() => window.__capy.biome.switchTo('palawan'));
  await page.waitForTimeout(3500);
  const total = await page.evaluate(() => {
    const g = window.__capy;
    let root = null, n = 0;
    g.scene.traverse(o => { if (o.name === 'palawan') root = o; });
    root.traverse(c => {
      if (!c.isMesh || !c.geometry) return;
      const idx = c.geometry.index ? c.geometry.index.count : c.geometry.attributes.position.count;
      n += (idx / 3) * (c.isInstancedMesh ? c.count : 1);
    });
    return Math.round(n);
  });
  // stand on the reef and look at it
  for (let i = 0; i < 16; i++) {
    await page.evaluate(() => {
      const g = window.__capy;
      g.palawan.rig = function () { return { w: 1, dist: 22, pitch: 0.34, raise: 2.0, lambda: 3 }; };
      g.capy.body.position.set(2, 0.2, 34);
      g.capy.body.velocity.set(0, 0, 0);
    });
    await page.waitForTimeout(220);
  }
  await page.screenshot({ path: 'qa/pal-reef.png' });
  await page.evaluate(async o => {
    await fetch('/shot?name=tri2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, { total: total });
}
