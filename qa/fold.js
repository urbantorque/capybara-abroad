async page => {
  await page.reload();
  await page.waitForTimeout(5500);
  await page.keyboard.press('Slash');
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(1000);
    const b = await page.evaluate(() => {
      const g = window.__capy;
      return g && g.biome ? g.biome.current : null;
    });
    if (b === 'hanoi') break;
  }
  await page.waitForTimeout(2000);

  const out = await page.evaluate(() => {
    const g = window.__capy;
    const r = { biome: g.biome.current };
    const root = g.scene.getObjectByName('hanoi');
    if (!root) { r.err = 'no root'; return r; }
    for (let i = 0; i < 300; i++) g.tick(1 / 60, false);
    const yaws = [];
    root.traverse(o => {
      if (!o.isMesh) return;
      let y = o.rotation.y % (Math.PI * 2);
      if (y > Math.PI) y -= Math.PI * 2;
      if (y < -Math.PI) y += Math.PI * 2;
      yaws.push(Math.abs(y));
    });
    r.total = yaws.length;
    r.openBand = yaws.filter(v => v <= 0.45).length;
    r.foldBand = yaws.filter(v => v > 0.45 && v < 1.45).length;
    r.other = yaws.filter(v => v >= 1.45).length;
    r.sample = yaws.map(v => +v.toFixed(2)).sort((a, b) => a - b).slice(0, 60);
    return r;
  });

  await page.evaluate(payload => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 1))));
    return fetch('/shot?name=fold-result.json', { method: 'POST', body: s });
  }, out);
}
