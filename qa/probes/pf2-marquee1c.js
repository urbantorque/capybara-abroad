async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);
  // Put the animal on the FORECOURT in front of the podium, not on it, then
  // walk the last few metres under its own power so the camera settles the way
  // it would for a player. A teleport alone leaves the camera mid-transition
  // and that reads as a camera bug when it is not one.
  await page.evaluate(() => {
    const g = window.__capy;
    g.capy.body.position.set(0, 1.0, 12.0);
    g.capy.body.velocity.set(0, 0, 0);
  });
  await page.waitForTimeout(2500);
  const camBefore = await page.evaluate(() => {
    const g = window.__capy;
    return { camY: +g.camera.position.y.toFixed(2), capyY: +g.capy.position.y.toFixed(2),
             capyZ: +g.capy.position.z.toFixed(1) };
  });
  // walk north onto the podium
  const trail = [];
  await page.keyboard.down('KeyW');
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(400);
    const s = await page.evaluate(() => {
      const g = window.__capy;
      return { z: +g.capy.position.z.toFixed(1), y: +g.capy.position.y.toFixed(2),
               camY: +g.camera.position.y.toFixed(2), score: g.state.score };
    });
    if (i % 4 === 0) trail.push(s);
    if (s.score > 0) { trail.push(Object.assign({ FIRED: true }, s)); break; }
  }
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => {
    const g = window.__capy;
    const c = g.camera.position, p = g.capy.position;
    return { score: g.state.score, camY: +c.y.toFixed(2),
             camAboveCapy: +(c.y - p.y).toFixed(2),
             horizDist: +Math.hypot(c.x - p.x, c.z - p.z).toFixed(2),
             pitchDeg: +(Math.atan2(c.y - p.y, Math.hypot(c.x - p.x, c.z - p.z)) * 180 / Math.PI).toFixed(1),
             capy: { x: +p.x.toFixed(1), y: +p.y.toFixed(2), z: +p.z.toFixed(1) } };
  });
  await page.evaluate(o => fetch('/shot?name=pf2-marquee1c.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), { camBefore: camBefore, trail: trail, after: after });
}
