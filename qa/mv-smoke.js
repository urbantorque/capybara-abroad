async page => {
  const out = [];
  const KEYS = [['Digit1', 'sydney'], ['Digit4', 'kyoto'], ['Digit0', 'venice']];
  for (let i = 0; i < KEYS.length; i++) {
    await page.reload();
    await page.waitForTimeout(4500);
    await page.keyboard.press(KEYS[i][0]);
    await page.waitForTimeout(3500);
    // run about, hop, and drive into whatever is ahead
    for (let k = 0; k < 3; k++) {
      await page.keyboard.down('ShiftLeft');
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(1800);
      await page.keyboard.press('Space');
      await page.waitForTimeout(900);
      await page.keyboard.up('KeyW');
      await page.keyboard.up('ShiftLeft');
      await page.waitForTimeout(700);
      await page.keyboard.down('KeyA');
      await page.waitForTimeout(600);
      await page.keyboard.up('KeyA');
    }
    await page.waitForTimeout(600);
    const r = await page.evaluate((want) => {
      const g = window.__capy;
      const p = g.capy && g.capy.position;
      return {
        want: want,
        biome: g.biome && g.biome.current,
        lastError: g.state && g.state.lastError ? String(g.state.lastError) : null,
        t: g.state && +g.state.time.toFixed(1),
        pos: p ? [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)] : null,
        finite: p ? (isFinite(p.x) && isFinite(p.y) && isFinite(p.z)) : false,
      };
    }, KEYS[i][1]);
    out.push(r);
  }
  await page.evaluate((o) => fetch('/shot?name=mv-smoke.json', {
    method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
