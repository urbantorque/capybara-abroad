async page => {
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(6000);

  // put the animal on the helm and take the wheel
  const took = await page.evaluate(() => {
    const g = window.__capy;
    const h = g.quay.boat.helm;
    g.capy.body.position.set(h.x, h.y + 0.4, h.z);
    g.capy.body.velocity.set(0, 0, 0);
    return { biome: g.biome.current, helm: { x: h.x, y: h.y, z: h.z } };
  });
  await page.waitForTimeout(600);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(1200);

  // hold full ahead for a while, sampling the rig
  await page.keyboard.down('KeyW');
  const samples = [];
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(900);
    const s = await page.evaluate(() => {
      const g = window.__capy;
      const c = g.renderer ? null : null;
      const cam = g.camera;
      const p = g.capy.body.position;
      const info = g.camInfo;
      const dx = cam.position.x - p.x, dy = cam.position.y - p.y, dz = cam.position.z - p.z;
      const flat = Math.hypot(dx, dz);
      return {
        atHelm: g.quay.boat.atHelm,
        sailing: !!g.state.sailing,
        speed: +g.quay.boat.speed.toFixed(2),
        heading: +g.quay.boat.heading.toFixed(2),
        eyeDist: +Math.hypot(dx, dy, dz).toFixed(2),
        eyeUp: +dy.toFixed(2),
        eyeBack: +flat.toFixed(2),
        viewPitchDeg: +(Math.atan2(dy, flat) * 180 / Math.PI).toFixed(1),
        reach: +info.reach.toFixed(2),
        clear: +info.clear.toFixed(3),
        pitchDeg: +(info.pitch * 180 / Math.PI).toFixed(1),
        lift: +info.lift.toFixed(2),
        lift2: +info.lift2.toFixed(2),
        floor: +info.floor.toFixed(2),
        rig: +info.rig.toFixed(3),
        shot: +info.shot.toFixed(3),
      };
    });
    samples.push(s);
  }
  await page.keyboard.up('KeyW');

  const out = { took, samples };
  await page.evaluate(o => {
    return fetch('/shot?name=helmcam.json', {
      method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
