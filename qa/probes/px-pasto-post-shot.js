async page => {
  // The animal against a bunting post, so the collider is looked at and not
  // only measured. Nothing DRAWN changed here — the whole change is a body —
  // so what this has to show is that it stops flush against the post it can
  // see, and not a third of a metre short of it in mid-air.
  await page.reload();
  await page.waitForTimeout(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(8000);
  await page.evaluate(() => {
    const g = window.__capy;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    g.biome.switchTo('pasto');
    tick(60 * 12);
    const b = g.capy.body;
    // z 40 and not 22: the post at z 22 stands beside the market, and the first
    // attempt drove through a stall on the way to it, ticked "bring down a
    // market stall" and photographed the inside of the wreckage.
    b.position.set(19.0, g.pasto.terrainHeight(19.0, 40) + 0.4, 40);
    b.velocity.set(0, 0, 0);
    tick(45);
    // ...and hold the LINE as well as the speed. The second attempt drifted
    // 0.9 m south over three seconds and walked cleanly past a 22 cm post,
    // which is a photograph of the animal missing rather than of it stopping.
    for (let i = 0; i < 60 * 3; i++) { b.velocity.x = 4; b.velocity.z = 0; g.tick(1 / 60, false); }
    b.velocity.set(0, 0, 0);
    tick(30);
    g.frameShot({ dist: 11, pitch: 0.13, raise: 1.6, hold: 8, w: 1 });
    tick(60 * 3);
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'qa/PX-pasto-post.png' });
  const where = await page.evaluate(() => {
    const p = window.__capy.capy.position;
    return { x: +p.x.toFixed(2), z: +p.z.toFixed(2), postAt: 22.5,
             postFace: 22.39, gap: +(22.39 - (p.x + 0.32)).toFixed(3) };
  });
  await page.evaluate((o) => fetch('/shot?name=px-pasto-post.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), where);
}
