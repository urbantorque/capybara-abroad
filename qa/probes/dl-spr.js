async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2600);
  const out = await page.evaluate(() => {
    const g = window.__capy; const R = { samples: [] };
    const e = g.env;
    function tp(x, z) {
      const b = g.capy.body; const y = 0;
      b.position.set(x, y + 0.45, z); b.previousPosition.copy(b.position);
      b.interpolatedPosition.copy(b.position); b.velocity.set(0,0,0); b.wakeUp();
      g.capy.position.set(b.position.x, b.position.y, b.position.z);
    }
    R.count = e.sprinklers.length;
    R.spots = e.sprinklers.map(s => ({x:s.x, z:s.z, reach:s.reach, spread:+s.spread.toFixed(2), base:+s.base.toFixed(2)}));
    const sp = e.sprinklers[0];
    tp(sp.x, sp.z); for (let i=0;i<40;i++) g.tick(1/60,false);
    R.onAfterTread = e.sprinklers.map(s => s.on);
    tp(sp.x + Math.cos(sp.base) * 1.9, sp.z + Math.sin(sp.base) * 1.9);
    for (let i = 0; i < 540; i++) {
      g.tick(1/60, false);
      if (i % 45 === 0) {
        const p = g.capy.position;
        R.samples.push({ f: i, on: sp.on, ang: +sp.angle.toFixed(2),
          d: +Math.hypot(p.x-sp.x, p.z-sp.z).toFixed(2),
          spr: sp.sprays(p.x, p.z), soak: +e.soaking(p.x, p.z).toFixed(2),
          wet: +g.capy.wet.toFixed(2), gr: g.capy.grounded, sw: !!g.capy.swimming });
      }
    }
    R['the-sprinkler'] = g.noticed('the-sprinkler');
    return R;
  });
  await page.evaluate((o) => fetch('/shot?name=dl-spr.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
