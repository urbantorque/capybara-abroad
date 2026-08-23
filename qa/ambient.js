async page => {
  await page.reload();
  await page.waitForFunction(() => window.__capy && window.__capy.biome, null, { timeout: 30000 });
  await page.keyboard.press('Digit1');
  await page.waitForFunction(() => window.__capy.biome.current === 'sydney', null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const e = window.__capy.env;
    if (e) e.rig = function () { return { w: 1, dist: 26, pitch: 0.42, raise: 2.0, lambda: 3 }; };
  });
  const trace = [];
  let shot = 0;
  for (let i = 0; i < 46; i++) {
    const s = await page.evaluate(() => {
      const g = window.__capy;
      let p = null;
      g.scene.traverse(x => { if (x.name === 'seaplane') p = x; });
      if (p && g.capy && g.capy.body) {
        g.capy.body.position.set(p.position.x + 20, Math.max(0.2, p.position.y - 10), p.position.z + 22);
        g.capy.body.velocity.set(0, 0, 0);
      }
      return p ? [+p.position.x.toFixed(1), +p.position.y.toFixed(1), +p.position.z.toFixed(1)] : null;
    });
    trace.push(s);
    if (!shot && s && s[1] > 22) { shot = 1; await page.waitForTimeout(400); await page.screenshot({ path: 'qa/amb-plane.png' }); }
    await page.waitForTimeout(900);
  }
  await page.evaluate(async o => {
    await fetch('/shot?name=amb.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, { trace: trace, shot: shot });
}
