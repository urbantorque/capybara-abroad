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

  const out = await page.evaluate(() => {
    const g = window.__capy;
    const r = { biome: g.biome.current };
    r.hasEnv = !!g.env;
    r.hasQuay = !!g.quay;
    const f = g.env && g.env.ferry;
    r.ferryKeys = f ? Object.keys(f) : null;
    if (f) {
      r.gangwayX = f.gangwayX;
      r.gangwayZ = f.gangwayZ;
      r.deckY = f.deckY;
      r.bodyPos = [f.body.position.x, f.body.position.y, f.body.position.z];
      r.groupPos = f.group ? [f.group.position.x, f.group.position.z] : null;
      r.apiPos = f.position ? [f.position.x, f.position.z] : null;
      r.sameGroupName = f.group ? f.group.name : null;
    }
    if (g.quay && g.quay.ferry) {
      const q = g.quay.ferry;
      r.quayFerry = {
        gangwayX: q.gangwayX === undefined ? null : q.gangwayX,
        gangwayZ: q.gangwayZ === undefined ? null : q.gangwayZ,
      };
    }
    r.sceneFerryGroups = [];
    g.scene.traverse(o => {
      if (o.name && /ferry/i.test(o.name)) {
        r.sceneFerryGroups.push([o.name, +o.position.x.toFixed(3), +o.position.z.toFixed(3)]);
      }
    });
    return r;
  });

  await page.evaluate(payload => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 1))));
    return fetch('/shot?name=ferry2-result.json', { method: 'POST', body: s });
  }, out);
}
