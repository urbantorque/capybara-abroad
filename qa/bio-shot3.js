async page => {
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(6500);
  await page.keyboard.press('Space');
  await page.waitForTimeout(3000);
  await page.evaluate(() => { const g = window.__capy; try { g.hud.cross('kyoto'); } catch (e) { g.biome.switchTo('kyoto'); } });
  await page.waitForTimeout(4500);
  async function at(x, z, yaw, name) {
    await page.evaluate((o) => {
      const g = window.__capy;
      const th = g.kyoto.terrainHeight(o.x, o.z);
      const y = (th === th ? th : 0) + 1.0;
      if (window.__pin) clearInterval(window.__pin);
      window.__pin = setInterval(function () {
        const b = g.capy && g.capy.body;
        if (b) { b.position.set(o.x, y, o.z); b.velocity.set(0,0,0); b.angularVelocity.set(0,0,0); }
        if (g.input) g.input.camYaw = o.yaw;
      }, 16);
    }, { x: x, z: z, yaw: yaw });
    await page.waitForTimeout(4500);
    await page.screenshot({ path: 'qa/BIO-' + name + '.png' });
  }
  await at(4, 92, Math.PI, 'kyoto-ramp');
  await page.evaluate(() => { if (window.__pin) clearInterval(window.__pin); });
}
