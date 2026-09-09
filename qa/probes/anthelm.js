async page => {
  await page.setViewportSize({ width: 1280, height: 760 });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(4500);
  await page.keyboard.press('Comma');
  await page.waitForTimeout(6500);
  const took = await page.evaluate(() => {
    const g = window.__capy;
    const h = g.antarctic.boat.helm;
    g.capy.body.position.set(h.x, h.y + 0.4, h.z);
    g.capy.body.velocity.set(0, 0, 0);
    return { biome: g.biome.current, helm: { x: +h.x.toFixed(2), y: +h.y.toFixed(2), z: +h.z.toFixed(2) } };
  });
  await page.waitForTimeout(700);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(1200);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(9000);
  const s = await page.evaluate(() => {
    const g = window.__capy, i = g.camInfo, c = g.capy;
    const dx = g.camera.position.x - c.position.x;
    const dy = g.camera.position.y - c.position.y;
    const dz = g.camera.position.z - c.position.z;
    return { sailing: !!g.state.sailing, atHelm: !!c.atHelm, ride: !!c.rideBody,
             clear: +i.clear.toFixed(3), reach: +i.reach.toFixed(2),
             eyeDist: +Math.hypot(dx, dy, dz).toFixed(2), eyeUp: +dy.toFixed(2) };
  });
  await page.screenshot({ path: 'qa/CAM-ant-helm.png' });
  await page.keyboard.up('KeyW');
  await page.evaluate(o => fetch('/shot?name=anthelm.json', {
    method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), { took, s });
}
