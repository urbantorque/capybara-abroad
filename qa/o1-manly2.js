async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2000);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    g.biome.switchTo('manly');
    tick(120);
    const L = (g.locals || []).filter(l => l.biome === 'manly');
    const pick = (frag) => L.filter(l => String(typeof l.lines[0] === 'string' ? l.lines[0] : l.lines[0].t).indexOf(frag) >= 0)[0];
    const cands = [['chips', pick('minimum chips')], ['lifeguard', pick('Swim between the flags')]];
    const rows = [];
    for (const [nm, rec] of cands) {
      if (!rec) { rows.push({ nm, err: 'not found' }); continue; }
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4;
        rec.fam = 0; rec.wary = 0;
        const x = rec.x + Math.cos(a) * 2.4, z = rec.z + Math.sin(a) * 2.4;
        g.capy.body.position.set(x, rec.y + 0.5, z);
        g.capy.body.velocity.set(0, 0, 0);
        let cross = -1;
        for (let i = 0; i < 60 * 45; i++) {
          g.tick(1 / 60, false);
          if (cross < 0 && (rec.fam || 0) > 0.45) cross = +(i / 60).toFixed(1);
        }
        const p = g.capy.position;
        rows.push({ nm, k, cross, fam: +(rec.fam || 0).toFixed(2),
          rest: +(g.capy.restT || 0).toFixed(1),
          d: +Math.hypot(p.x - rec.x, p.z - rec.z).toFixed(1),
          slid: +Math.hypot(p.x - x, p.z - z).toFixed(1) });
      }
    }
    return rows;
  });
  await page.evaluate((o) => fetch('/shot?name=o1-manly2.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
