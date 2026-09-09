async page => {
  const plan = [['Digit1','sydney'],['Digit2','pasto'],['BracketLeft', 'goreme'], ['Digit7', 'iceland'], ['Digit8', 'sahara']];
  const tag = 'PASTOSUN';
  for (const pair of plan) {
    await page.reload();
    await page.waitForTimeout(5500);
    await page.keyboard.press(pair[0]);
    let got = null;
    for (let i = 0; i < 25; i++) {
      await page.waitForTimeout(1000);
      got = await page.evaluate(() => {
        const g = window.__capy;
        return g && g.biome ? g.biome.current : null;
      });
      if (got === pair[1]) break;
    }
    if (got !== pair[1]) continue;
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
      const g = window.__capy;
      for (let i = 0; i < 240; i++) g.tick(1 / 60, false);
    });
    await page.waitForTimeout(2500);
    await page.evaluate(o => {
      const g = window.__capy;
      const s = g.scene.getObjectByName('__sunProbe') || null;
      const info = { biome: g.biome.current, tag: o.tag };
      g.scene.traverse(n => {
        if (n.isDirectionalLight && n.castShadow) {
          // DIRECTION, NOT POSITION: the sun follows the capybara, so its
          // absolute position is mostly wherever the animal is standing.
          const t = n.target ? n.target.position : { x: 0, y: 0, z: 0 };
          const dx = n.position.x - t.x, dy = n.position.y - t.y, dz = n.position.z - t.z;
          const L = Math.hypot(dx, dy, dz) || 1;
          info.sunDir = [+(dx / L).toFixed(3), +(dy / L).toFixed(3), +(dz / L).toFixed(3)];
          info.elevationDeg = +(Math.asin(dy / L) * 180 / Math.PI).toFixed(1);
          info.azimuthDeg = +(Math.atan2(dz / L, dx / L) * 180 / Math.PI).toFixed(1);
          info.dist = +L.toFixed(1);
        }
      });
      return fetch('/shot?name=sun-' + o.tag + '-' + g.biome.current + '.json',
        { method: 'POST',
          body: btoa(unescape(encodeURIComponent(JSON.stringify(info, null, 1)))) });
    }, { tag: tag });
  }
}
