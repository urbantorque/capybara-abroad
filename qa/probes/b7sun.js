async page => {
  await page.reload();
  await page.waitForTimeout(5500);
  await page.keyboard.press('Digit1');
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(1000);
    const b = await page.evaluate(() => {
      const g = window.__capy;
      return g && g.biome ? g.biome.current : null;
    });
    if (b === 'sydney') break;
  }
  await page.waitForTimeout(2000);

  const names = ['sydney', 'pasto', 'iceland', 'sahara', 'drift', 'kowloon',
                 'palawan', 'goreme', 'antarctic', 'monaco'];
  const out = { tag: 'B7SUN', rows: [] };
  for (const n of names) {
    const row = await page.evaluate(name => {
      const g = window.__capy;
      g.biome.switchTo(name);
      const s = g.biome.spawnOf ? g.biome.spawnOf(name) : null;
      if (s && g.capy && g.capy.body) {
        g.capy.body.position.set(s.x, s.y + 0.4, s.z);
        g.capy.body.velocity.set(0, 0, 0);
      }
      for (let i = 0; i < 240; i++) g.tick(1 / 60, false);
      const r = { want: name, biome: g.biome.current };
      g.scene.traverse(o => {
        if (o.isDirectionalLight && o.castShadow) {
          const t = o.target ? o.target.position : { x: 0, y: 0, z: 0 };
          const dx = o.position.x - t.x, dy = o.position.y - t.y, dz = o.position.z - t.z;
          const L = Math.hypot(dx, dy, dz) || 1;
          r.sunElev = +(Math.asin(dy / L) * 180 / Math.PI).toFixed(1);
          r.sunAzi = +(Math.atan2(dz / L, dx / L) * 180 / Math.PI).toFixed(1);
          r.sunI = +o.intensity.toFixed(3);
          r.sunColor = '#' + o.color.getHexString();
        } else if (o.isHemisphereLight) {
          r.hemiI = +o.intensity.toFixed(3);
        } else if (o.isAmbientLight) {
          r.ambI = +o.intensity.toFixed(3);
        }
      });
      // how dark is this chapter, really
      if (g.weather && typeof g.weather.light === 'function') {
        try { const L = g.weather.light(); r.wxSunK = L && L.sunK !== undefined ? +L.sunK.toFixed(3) : null; }
        catch (e) { r.wxSunK = null; }
      }
      return r;
    }, n);
    out.rows.push(row);
  }
  await page.evaluate(payload => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 1))));
    return fetch('/shot?name=b7sun-result.json', { method: 'POST', body: s });
  }, out);
}
