async page => {
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(6500);
  await page.keyboard.press('Space');
  await page.waitForTimeout(3000);

  // The rig TIDIES ITSELF after 1.1 s of standing still (sysCAM_IDLE_T), so a
  // camYaw written once is gone by the time the shutter opens — the first pass
  // of this framed the Uji bridge and photographed a field. Yaw is held on the
  // same interval as the body.
  async function shot(biome, x, z, yaw, lift, name) {
    await page.evaluate((o) => {
      const g = window.__capy;
      try { g.hud.cross(o.b); } catch (e) { g.biome.switchTo(o.b); }
    }, { b: biome });
    await page.waitForTimeout(4500);
    await page.evaluate((o) => {
      const g = window.__capy;
      const f = g[o.b] && g[o.b].terrainHeight;
      const th = f ? f(o.x, o.z) : 0;
      const y = (th === th ? th : 0) + (o.lift || 1.0);
      if (window.__pin) clearInterval(window.__pin);
      window.__pin = setInterval(function () {
        const b = g.capy && g.capy.body;
        if (b) {
          b.position.set(o.x, y, o.z);
          b.velocity.set(0, 0, 0);
          b.angularVelocity.set(0, 0, 0);
        }
        if (g.input) g.input.camYaw = o.yaw;
      }, 16);
    }, { b: biome, x: x, z: z, yaw: yaw, lift: lift });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'qa/BIO-' + name + '.png' });
    await page.evaluate(() => { if (window.__pin) { clearInterval(window.__pin); window.__pin = null; } });
  }

  // KYOTO — on the south bank, camera behind (south of) the animal looking north
  // up the bridge. camYaw is the bearing FROM the animal TO the eye.
  await shot('kyoto', 4, 99, Math.PI, 1.0, 'kyoto-bridge');
  // ...and from the side, so the height of the deck above the bank is plain.
  await shot('kyoto', 15, 118, -Math.PI / 2, 1.0, 'kyoto-bridge-side');

  // CALI — on the road south of the bridge, looking north across it.
  await shot('cali', -6, -20, Math.PI, 1.0, 'cali-bridge');
  // ...and standing ON the deck beside the parapet you can walk through.
  await shot('cali', -6, 0, Math.PI / 2, 1.4, 'cali-bridge-deck');

  await page.evaluate(async () => {
    await fetch('/shot?name=BIO-SHOT2', { method: 'POST', body: btoa('ok') });
  });
}
