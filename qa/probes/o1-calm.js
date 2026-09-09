async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2000);
  const list = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift','venice',
                'kowloon','palawan','goreme','manly','pantanal','cave','antarctic','monaco','hanoi'];
  const rows = [];
  for (const nm of list) {
    rows.push(await page.evaluate(async (nm) => {
      const g = window.__capy;
      const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
      g.biome.switchTo(nm);
      tick(120);
      const sp = g.biome.spawnOf(nm);
      g.capy.body.position.set(sp.x, sp.y + 0.4, sp.z);
      g.capy.body.velocity.set(0, 0, 0);
      let calmSum = 0, chaosSum = 0, chaosMax = 0, n = 0, calmEnd = 0;
      for (let i = 0; i < 60 * 60; i++) {
        g.tick(1 / 60, false);
        if (i > 60 * 20) {   // after the calm has had time to come up
          n++; calmSum += g.state.calm || 0;
          chaosSum += g.state.chaos || 0;
          if ((g.state.chaos || 0) > chaosMax) chaosMax = g.state.chaos;
        }
      }
      calmEnd = g.state.calm || 0;
      return { biome: nm, calm: +(calmSum / n).toFixed(3), calmEnd: +calmEnd.toFixed(3),
               chaos: +(chaosSum / n).toFixed(3), chaosMax: +chaosMax.toFixed(3),
               rest: +(g.capy.restT || 0).toFixed(1) };
    }, nm));
  }
  await page.evaluate((o) => fetch('/shot?name=o1-calm.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), rows);
}
