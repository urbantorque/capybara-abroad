async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2000);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    g.biome.switchTo('manly');
    tick(120);
    const sp = g.biome.spawnOf('manly');
    const api = g.manly;
    const spots = [];
    // the spawn, and a ring of eight points at 6, 14 and 26 m from it
    spots.push({ n: 'spawn', x: sp.x, z: sp.z });
    for (const r of [6, 14, 26]) {
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4;
        spots.push({ n: 'r' + r + '/' + k, x: sp.x + Math.cos(a) * r, z: sp.z + Math.sin(a) * r });
      }
    }
    // ...and beside every local in the chapter
    const L = (g.locals || []).filter(l => l.biome === 'manly');
    L.forEach((l, i) => spots.push({ n: 'local' + i, x: l.x + 2.0, z: l.z, y: l.y + 0.5,
      who: String((typeof l.lines[0] === 'string' ? l.lines[0] : l.lines[0].t)).slice(0, 26) }));
    const rows = [];
    for (const s of spots) {
      const y = s.y !== undefined ? s.y : api.terrainHeight(s.x, s.z) + 0.5;
      g.capy.body.position.set(s.x, y, s.z);
      g.capy.body.velocity.set(0, 0, 0);
      tick(60 * 12);
      const p = g.capy.position;
      rows.push({ n: s.n, who: s.who || '', rest: +(g.capy.restT || 0).toFixed(1),
        v: +Math.hypot(g.capy.velocity.x, g.capy.velocity.z).toFixed(2),
        gnd: !!g.capy.grounded, swim: !!g.capy.swimming,
        moved: +Math.hypot(p.x - s.x, p.z - s.z).toFixed(2) });
    }
    // and a control: the same ring in Venice, which does rest
    g.biome.switchTo('venice'); tick(120);
    const vs = g.biome.spawnOf('venice');
    const vrows = [];
    for (const r of [0, 8, 18]) {
      const x = vs.x + r, z = vs.z;
      g.capy.body.position.set(x, g.venice.terrainHeight(x, z) + 0.5, z);
      g.capy.body.velocity.set(0, 0, 0);
      tick(60 * 12);
      vrows.push({ n: 'venice+' + r, rest: +(g.capy.restT || 0).toFixed(1),
        v: +Math.hypot(g.capy.velocity.x, g.capy.velocity.z).toFixed(2) });
    }
    return { manly: rows, venice: vrows };
  });
  await page.evaluate((o) => fetch('/shot?name=o1-rest.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
