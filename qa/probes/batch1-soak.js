async page => {
  const out = { tag: 'SOAK', rows: [] };
  const plan = [
    ['Digit1', 'sydney'],
    ['Digit2', 'pasto'],
    ['Digit3', 'quay'],
    ['Digit0', 'venice'],
    ['Slash', 'hanoi'],
  ];

  for (const pair of plan) {
    const key = pair[0], want = pair[1];
    await page.reload();
    await page.waitForTimeout(5500);
    await page.keyboard.press(key);
    let got = null;
    for (let i = 0; i < 25; i++) {
      await page.waitForTimeout(1000);
      got = await page.evaluate(() => {
        const g = window.__capy;
        return g && g.biome ? g.biome.current : null;
      });
      if (got === want) break;
    }
    if (got !== want) { out.rows.push({ want: want, reached: got, err: 'never arrived' }); continue; }
    await page.waitForTimeout(1500);

    const row = await page.evaluate(wanted => {
      const g = window.__capy;
      let nan = 0;
      for (let c = 0; c < 4; c++) {
        for (let i = 0; i < 600; i++) g.tick(1 / 60, false);
        const p = g.capy && g.capy.position;
        if (p && (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z))) nan++;
      }
      return {
        want: wanted,
        biome: g.biome.current,
        bodies: g.world.bodies.length,
        props: (g.props || []).length,
        nanSamples: nan,
        lastError: g.state.lastError || null,
      };
    }, want);
    out.rows.push(row);
  }

  await page.evaluate(payload => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 1))));
    return fetch('/shot?name=soak-result.json', { method: 'POST', body: s });
  }, out);
}
