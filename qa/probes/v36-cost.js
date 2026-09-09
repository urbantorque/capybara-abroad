async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);

  const chapters = ['sydney', 'quay', 'venice', 'cali', 'monaco', 'hanoi', 'kowloon'];
  const rows = [];
  for (const nm of chapters) {
    let row;
    try {
      row = await page.evaluate(async (n) => {
        const g = window.__capy;
        if (g.biome.current !== n) g.biome.switchTo(n);
        for (let i = 0; i < 90; i++) g.tick(1 / 60, false);   // settle
        const ms = [];
        for (let i = 0; i < 300; i++) {
          const t0 = performance.now();
          g.world.step(1 / 60, 1 / 60, 3);
          ms.push(performance.now() - t0);
        }
        ms.sort((a, b) => a - b);
        return { biome: n, bodies: g.world.bodies.length,
                 med: +ms[150].toFixed(3), p90: +ms[270].toFixed(3) };
      }, nm);
    } catch (e) { row = { biome: nm, error: String(e).slice(0, 200) }; }
    rows.push(row);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=v36-cost.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, { rows: rows });
}
