// CAN YOU ACTUALLY RIDE A CAR IN MONTE CARLO?
//
// The shelf entry says the cars reach 26.5 m/s and capyPLAT_VMAX clamps an
// inherited platform speed at 12. If that is what happens, an animal on the
// roof is being driven forward at 12 while the roof under it does 26.5, and it
// leaves over the back at 14.5 m/s — one car length in a sixth of a second.
//
// Put the animal on a roof at THREE different points of the lap, because the
// track is not one speed: the hairpin is 5.4 and the tunnel is the top end.
// Then hold nothing and log, every 100 ms: the car's speed, the frame the
// chapter declares, the animal's own velocity, and whether it is still on.
async page => {
  const out = { legs: [] };
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Period');            // 18 = monaco
  await page.waitForTimeout(7000);
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  out.vmax = await page.evaluate(() => {
    const g = window.__capy;
    // the three kinematic bodies that are moving are the cars
    return g.world.bodies.filter(b => b.type === window.__capy.CANNON.Body.KINEMATIC &&
      Math.hypot(b.velocity.x, b.velocity.z) > 3).length;
  });

  // Three spots on the lap, chosen by the car's own speed when we arrive.
  for (const leg of ['first', 'second', 'third']) {
    await page.evaluate(() => {
      const g = window.__capy;
      const cars = g.world.bodies.filter(b => b.type === window.__capy.CANNON.Body.KINEMATIC &&
        Math.hypot(b.velocity.x, b.velocity.z) > 2.5);
      if (!cars.length) { window.__rd = null; return; }
      // the fastest one, so the leg is the interesting case
      cars.sort((a, b) => Math.hypot(b.velocity.x, b.velocity.z) -
                          Math.hypot(a.velocity.x, a.velocity.z));
      const car = cars[0];
      window.__car = car;
      const c = g.capy;
      c.body.position.set(car.position.x, car.position.y + 1.35, car.position.z);
      c.body.velocity.set(car.velocity.x, 0, car.velocity.z);
      c.body.angularVelocity.setZero();
      c.body.aabbNeedsUpdate = true;
    });
    await page.waitForTimeout(260);
    const rows = await page.evaluate(async () => {
      const g = window.__capy, car = window.__car;
      if (!car) return null;
      const api = g[g.biome.current];
      const list = [];
      const t0 = performance.now();
      return await new Promise(res => {
        const id = setInterval(() => {
          const c = g.capy, cv = c.body.velocity, p = c.body.position;
          const fr = api.carryFrame ? api.carryFrame() : null;
          const dx = p.x - car.position.x, dz = p.z - car.position.z;
          list.push({
            t: +((performance.now() - t0) / 1000).toFixed(2),
            carV: +Math.hypot(car.velocity.x, car.velocity.z).toFixed(2),
            frame: fr ? +Math.hypot(fr.x, fr.z).toFixed(2) : null,
            capyV: +Math.hypot(cv.x, cv.z).toFixed(2),
            // how far behind the car the animal has slid, in the car's own frame
            lag: +Math.hypot(dx, dz).toFixed(2),
            dy: +(p.y - car.position.y).toFixed(2),
            riding: api.riding ? api.riding() : -2,
            rideSpd: api.ridingSpeed ? +api.ridingSpeed().toFixed(2) : -1,
          });
          if (list.length >= 40) { clearInterval(id); res(list); }
        }, 100);
      });
    });
    out.legs.push({ leg, rows });
  }
  await page.evaluate(o => fetch('/shot?name=px-ride-mon.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
