async page => {
  await page.reload();
  await page.waitForTimeout(5500);
  await page.keyboard.press('Digit1');
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(1000);
    const b = await page.evaluate(() => {
      const g = window.__capy;
      return g && g.biome ? g.biome.current : null;
    });
    if (b === 'sydney') break;
  }
  await page.waitForTimeout(2000);

  const out = await page.evaluate(() => {
    const g = window.__capy;
    const own = m => !!(m && Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile'));
    const r = { biome: g.biome.current, hits: [] };
    // dust pool is a direct child of scene (physSceneAddLoose), tetrahedra
    g.scene.traverse(o => {
      if (!o.isInstancedMesh && !o.isMesh) return;
      const geo = o.geometry;
      const type = geo && geo.type ? geo.type : '';
      if (type === 'TetrahedronGeometry') {
        r.hits.push({ what: 'dust', rim: own(o.material) });
      }
    });
    // and the palawan school, fixed back in batch 2, as a control
    g.biome.switchTo('palawan');
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
    const fish = g.scene.getObjectByName('palSchools');
    if (fish) r.hits.push({ what: 'palSchools (batch 2 control)', rim: own(fish.material) });
    g.biome.switchTo('sydney');
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
    r.lastError = g.state.lastError || null;
    return r;
  });

  await page.evaluate(payload => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 1))));
    return fetch('/shot?name=b7rim-result.json', { method: 'POST', body: s });
  }, out);
}
