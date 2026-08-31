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

  const out = { tag: 'FERRY' };
  out.rows = [];
  for (let k = 0; k < 5; k++) {
    const row = await page.evaluate(() => {
      const g = window.__capy;
      const f = g.env && g.env.ferry;
      if (!f || !f.body) return { err: 'no ferry' };
      const nodeX = f.gangwayX - 2.45, nodeZ = f.gangwayZ;
      return {
        t: +g.state.time.toFixed(2),
        gangwayX: +f.gangwayX.toFixed(4),
        gangwayZ: +f.gangwayZ.toFixed(4),
        nodeX: +nodeX.toFixed(4),
        nodeZ: +nodeZ.toFixed(4),
        bodyX: +f.body.position.x.toFixed(4),
        bodyZ: +f.body.position.z.toFixed(4),
        offX: +(f.body.position.x - nodeX).toFixed(4),
        offZ: +(f.body.position.z - nodeZ).toFixed(4),
        velX: +f.body.velocity.x.toFixed(3),
        velZ: +f.body.velocity.z.toFixed(3),
      };
    });
    out.rows.push(row);
    await page.waitForTimeout(1200);
  }

  await page.evaluate(payload => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 1))));
    return fetch('/shot?name=ferry-result.json', { method: 'POST', body: s });
  }, out);
}
