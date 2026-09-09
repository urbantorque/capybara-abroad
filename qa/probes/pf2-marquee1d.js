async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const g = window.__capy;
    g.capy.body.position.set(0, 1.0, 12.0);
    g.capy.body.velocity.set(0, 0, 0);
  });
  await page.waitForTimeout(2500);
  const pitch = () => page.evaluate(() => {
    const g = window.__capy, c = g.camera.position, p = g.capy.position;
    return { z: +p.z.toFixed(1), y: +p.y.toFixed(2), score: g.state.score,
             pitch: +(Math.atan2(c.y - p.y, Math.hypot(c.x - p.x, c.z - p.z)) * 180 / Math.PI).toFixed(1),
             camY: +c.y.toFixed(2), horiz: +Math.hypot(c.x - p.x, c.z - p.z).toFixed(2) };
  });
  const out = { baseline: await pitch(), trail: [], atFire: null };
  await page.keyboard.down('KeyS');
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(350);
    const s = await pitch();
    if (i % 3 === 0) out.trail.push(s);
    if (s.score > 0) { out.atFire = s; break; }
  }
  await page.keyboard.up('KeyS');
  await page.waitForTimeout(800);
  out.afterFire = await pitch();
  await page.evaluate(o => fetch('/shot?name=pf2-marquee1d.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
