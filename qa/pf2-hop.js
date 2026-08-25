async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const e = g.env || {};
    const r = { spawn: null, tables: null, podium: null, stepOver: null };
    try { const sp = g.biome.spawnOf('sydney'); r.spawn = { x: +sp.x.toFixed(1), z: +sp.z.toFixed(1) }; } catch (x) {}
    try {
      const t = e.cafeTables;
      if (t && t.length) {
        r.tables = t.slice(0, 3).map(function (o) {
          const p = o.position || o;
          return { x: +(p.x).toFixed(1), y: +(p.y).toFixed(2), z: +(p.z).toFixed(1) };
        });
      } else r.tables = 'none on game.env';
    } catch (x) { r.tables = 'err ' + x; }
    // the opera podium: sample terrain/surface height inside the operaStage zone
    try {
      const z = e.zones ? e.zones.operaStage : null;
      r.podiumZone = z || 'no zones export';
    } catch (x) { r.podiumZone = 'err'; }
    try { r.surfAtPodium = g.physics && g.physics.surfaceY ? g.physics.surfaceY(0, 2.5) : 'no surfaceY'; } catch (x) {}
    r.envKeys = Object.keys(e).slice(0, 40);
    return r;
  });
  await page.evaluate(o => fetch('/shot?name=pf2-hop.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
