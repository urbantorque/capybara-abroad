async page => {
  // Two reloads to actually clear the save — see the note in o2-shot.js.
  await page.reload();
  await page.waitForTimeout(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2000);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    const rec0 = () => {
      const f = g.palAudit().found.filter(x => x.b === 'venice')[0];
      return (g.locals || []).filter(l => l.biome === 'venice' &&
        Math.abs(l.x - f.x) < 0.2 && Math.abs(l.z - f.z) < 0.2)[0];
    };
    // three quiet visits: nothing is knocked over, so no incident card
    for (let v = 0; v < 3; v++) {
      g.biome.switchTo('venice'); tick(40);
      const rec = rec0();
      g.capy.body.position.set(rec.x + 2.3, g.venice.terrainHeight(rec.x + 2.3, rec.z + 0.4) + 0.35, rec.z + 0.4);
      g.capy.body.velocity.set(0, 0, 0);
      tick(60 * 50);
      if (v < 2) { g.biome.switchTo('kyoto'); tick(60 * 15); }
    }
    const rec = rec0();
    let put = null, n = 0;
    const real = g.physics.spawnProp;
    g.physics.spawnProp = function (t, x, z, y, yaw) {
      const p = real.call(this, t, x, z, y, yaw);
      if (t === 'winebottle' && p) { put = p; n++; }
      return p;
    };
    rec.talkCd = 0;
    for (let i = 0; i < 60 * 130 && !put; i++) g.tick(1 / 60, false);
    tick(30);
    rec.talkCd = 0;
    g.palArm(3);
    tick(150);
    return { tier: g.palDebug().tier, put: !!put, bottles: n, giftOut: g.palAudit().giftOut,
             where: put ? { d: +Math.hypot(put.body.position.x - rec.x, put.body.position.z - rec.z).toFixed(2) } : null };
  });
  await page.evaluate(() => {
    let alive = true;
    const loop = () => { if (!alive) return; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    window.__pinStop = () => { alive = false; };
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'qa/O2-gift.png' });
  await page.evaluate(() => { if (window.__pinStop) window.__pinStop(); });
  await page.evaluate((o) => fetch('/shot?name=o2-gshot.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
