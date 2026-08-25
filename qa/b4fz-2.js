async page => {
  await page.waitForTimeout(4000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                 'manly', 'pantanal', 'cave', 'antarctic'];
  const res = {};
  for (const n of names) {
    res[n] = await page.evaluate((name) => {
      const g = window.__capy, P = g.physics;
      const kp = P.keepOut('sydney') || P.spawnKeep('sydney', 0, 0);
      if (g.biome.current !== name) g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name);
      const cb = g.capy.body;
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0);
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
      for (let i = 0; i < 150; i++) g.tick(1 / 60, false);
      const restY = kp.body.position.y;
      const hx = kp.homeX, hy = kp.homeY, hz = kp.homeZ;
      kp.body.wakeUp();
      kp.body.position.set(950, 12, 950);
      kp.body.velocity.set(0, 0, 0); kp.body.angularVelocity.set(0, 0, 0);
      kp.body.previousPosition.copy(kp.body.position);
      kp.body.interpolatedPosition.copy(kp.body.position);
      let resc = 0, lx = 950, ly = 12, lz = 950;
      for (let i = 0; i < 300; i++) {
        g.tick(1 / 60, false);
        const b = kp.body.position;
        if (Math.hypot(b.x - lx, b.y - ly, b.z - lz) > 3) resc++;
        lx = b.x; ly = b.y; lz = b.z;
      }
      const rescY = kp.body.position.y;
      return {
        home: [+hx.toFixed(2), +hy.toFixed(2), +hz.toFixed(2)],
        spawnY: +sp.y.toFixed(2),
        keepRestY: +restY.toFixed(2),
        keepRescueY: +rescY.toFixed(2),
        HOVER: +(rescY - restY).toFixed(2),
        rescues: resc, sleeping: kp.body.sleepState,
      };
    }, n);
    await page.evaluate(async o => {
      await fetch('/shot?name=b4fz-2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
    }, res);
  }
}
