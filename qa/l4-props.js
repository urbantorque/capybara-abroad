// qa/props.js, gated on the live biome (a Pasto bowl measured against Sydney's
// terrain is not a lost prop), plus: every "mid-air" sleeper is woken and
// watched for two seconds — a prop with something under it stays, a prop the
// broadphase has lost falls.
async page => {
  await page.reload(); await page.waitForTimeout(6000);
  await page.keyboard.press('Enter'); await page.waitForTimeout(3000);
  const out = {};
  for (const b of ['sydney', 'kyoto', 'pasto']) {
    await page.evaluate((name) => { window.__capy.hud.cross(name); }, b);
    await page.waitForTimeout(5000);
    for (let i = 0; i < 3; i++) await page.evaluate(() => new Promise(r => setTimeout(r, 4000)));
    out[b] = await page.evaluate(async () => {
      const g = window.__capy;
      const api = g.biome.current === 'sydney' ? g.env : g[g.biome.current];
      const gy = (x, z) => { const h = api && api.terrainHeight ? api.terrainHeight(x, z) : 0; return (typeof h === 'number' && h === h) ? h : 0; };
      const bad = [], air = [];
      let n = 0;
      for (const p of g.props) {
        if (!p || !p.body || p.removed || p.hidden || p.held || p.owner) continue;
        if (p.biome && p.biome !== g.biome.current) continue;
        n++;
        const q = p.body.position;
        if (!(q.x === q.x && q.y === q.y && q.z === q.z)) { bad.push(p.type + ' NaN'); continue; }
        const dy = q.y - gy(q.x, q.z);
        const wet = api && api.isOverWater && api.isOverWater(q.x, q.z);
        if (dy < -1.5 && !wet) bad.push(p.type + ' under ground by ' + (-dy).toFixed(1) + ' at ' + q.x.toFixed(0) + ',' + q.z.toFixed(0));
        else if (dy > 3.5 && p.body.sleepState === 2) air.push({ p, y0: q.y, dy });
      }
      for (const a of air) a.p.body.wakeUp();
      await new Promise(r => setTimeout(r, 2000));
      const airRows = air.map(a => ({ type: a.p.type, at: a.p.body.position.x.toFixed(0) + ',' + a.p.body.position.z.toFixed(0), agl: +a.dy.toFixed(1), fell: +(a.y0 - a.p.body.position.y).toFixed(2) }));
      return { props: n, bad: bad.slice(0, 12), midAirSleepers: airRows, err: g.state.lastError || null };
    });
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4-props.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
