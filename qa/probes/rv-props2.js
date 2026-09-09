async page => {
  await page.reload(); await page.waitForTimeout(6500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2000);
  const out = {};
  for (const b of ['sydney', 'pasto', 'quay', 'manly', 'kyoto']) {
    await page.evaluate((name) => {
      const g = window.__capy;
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name), bd = g.capy.body;
      bd.position.set(sp.x, sp.y, sp.z); bd.velocity.set(0, 0, 0);
      bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position);
    }, b);
    await page.waitForTimeout(1500);
    for (let i = 0; i < 5; i++) await page.evaluate(() => new Promise(r => setTimeout(r, 4000)));
    out[b] = await page.evaluate((name) => {
      const g = window.__capy;
      const api = name === 'sydney' ? g.env : g[name];
      const gy = (x, z) => {
        const h = api && api.terrainHeight ? api.terrainHeight(x, z) : 0;
        return (typeof h === 'number' && h === h) ? h : 0;
      };
      const bad = [];
      let n = 0, held = 0, owned = 0, other = 0, notag = 0;
      for (const p of g.props) {
        if (!p || !p.body || p.removed) continue;
        // ONLY the props that belong to the live chapter. Without this the
        // audit measures every other chapter's props against this chapter's
        // terrain and reports a dozen phantom finds.
        if (p.biome && p.biome !== name) { other++; continue; }
        if (!p.biome) notag++;
        n++;
        if (p.held) { held++; continue; }
        if (p.owner) { owned++; continue; }
        const q = p.body.position;
        if (!(q.x === q.x && q.y === q.y && q.z === q.z)) { bad.push(p.type + ' NaN'); continue; }
        const dy = q.y - gy(q.x, q.z);
        const wet = api && api.isOverWater && api.isOverWater(q.x, q.z);
        if (dy < -1.5 && !wet) bad.push(p.type + ' under ground by ' + (-dy).toFixed(1) + ' at ' + q.x.toFixed(0) + ',' + q.z.toFixed(0));
        else if (dy > 3.5 && p.body.sleepState === 2) bad.push(p.type + ' asleep in mid-air ' + dy.toFixed(1) + ' at ' + q.x.toFixed(0) + ',' + q.z.toFixed(0));
        if (Math.abs(q.x) > 200 || Math.abs(q.z) > 300) bad.push(p.type + ' far ' + q.x.toFixed(0) + ',' + q.z.toFixed(0));
      }
      return { props: n, otherBiome: other, untagged: notag, held, owned, bad: bad.slice(0, 14), solverSaves: g.state.solverSaves || 0 };
    }, b);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-props2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
