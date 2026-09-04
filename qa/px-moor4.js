// THE MOORING FIELDS, AGAINST THE WATER THEY ARE SUPPOSED TO BE IN.
//
// Field 1 at (-104, -172) reports terrain 21 and isOverWater false: thirteen
// yachts drawn at the waterline, twenty-one metres inside a headland. This
// samples each field's own ellipse to say how much of it is dry, and then looks
// for a cove that would actually hold it — water, off the fairway, and away
// from the pier furniture.
async page => {
  const out = {};
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(7000);
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  out.fields = await page.evaluate(() => {
    const g = window.__capy, a = g[g.biome.current];
    const F = [{ x: -104, z: -172, rx: 34, rz: 26 },
               { x: 176, z: -262, rx: 30, rz: 34 },
               { x: -64, z: -330, rx: 26, rz: 22 }];
    return F.map(f => {
      let wet = 0, n = 0, maxT = -999;
      for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) {
        const x = f.x + (i / 19 - 0.5) * 2 * f.rx;
        const z = f.z + (j / 19 - 0.5) * 2 * f.rz;
        n++;
        if (a.isOverWater(x, z)) wet++;
        const t = a.terrainHeight(x, z);
        if (t === t && t > maxT) maxT = t;
      }
      return { at: [f.x, f.z], cells: n, wet, dry: n - wet, maxTerrain: +maxT.toFixed(1) };
    });
  });
  // Where could field 1 go? Scan the western half of the harbour for a disc of
  // open water 40 m across with nothing hard in it.
  out.coves = await page.evaluate(() => {
    const g = window.__capy, a = g[g.biome.current];
    const good = [];
    for (let x = -300; x <= 60; x += 12) {
      for (let z = -420; z <= -60; z += 12) {
        let wet = 0, n = 0, hard = 0;
        for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
          const px = x + i * 16, pz = z + j * 13;
          n++;
          if (a.isOverWater(px, pz)) wet++;
          if (a.hardAt && a.hardAt(px, pz)) hard++;
        }
        if (wet === n && hard === 0) good.push({ x, z });
      }
    }
    // the one nearest the original centre, so the picture changes as little as
    // possible: a mooring field belongs in a cove off the fairway.
    good.sort((p, q) => Math.hypot(p.x + 104, p.z + 172) - Math.hypot(q.x + 104, q.z + 172));
    return { n: good.length, nearest: good.slice(0, 8) };
  });
  await page.evaluate(o => fetch('/shot?name=px-moor4.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
