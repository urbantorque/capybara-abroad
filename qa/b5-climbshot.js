async page => {
  // ---- A PICTURE OF AN ANIMAL GOING UP SOMETHING ------------------------
  // Job 3's payoff, and a number cannot settle it: `climbAt` returning an
  // object says a hold EXISTS, and only the frame says the capybara is on a
  // wall in a chapter that never mentioned climbing.
  //
  // The stick is camera-relative and the climb solve reads it against the FACE
  // — push into the wall to go up — so the probe presses W, checks whether the
  // animal actually rose, and swaps to S if the rig had not finished swinging
  // round behind it. Which key it took is recorded: a shot that only works
  // because the harness guessed right is not a shot.
  const PLACES = ['sydney', 'quay', 'kyoto', 'venice', 'sahara', 'monaco'];
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);

  const log = [];
  for (const n of PLACES) {
    const spot = await page.evaluate((name) => {
      const g = window.__capy;
      g.biome.switchTo(name);
      const list = g.world.bodies.filter(b => {
        if (!b || b.mass > 0 || b.isTrigger) return false;
        if (b.type !== undefined && g.CANNON.Body && b.type !== g.CANNON.Body.STATIC) return false;
        if (b.userData && (b.userData.npc || b.userData.local)) return false;
        if (!b.aabb || !isFinite(b.aabb.upperBound.y)) return false;
        const a = b.aabb;
        const h = a.upperBound.y - a.lowerBound.y;
        return h > 4.0 && h < 60 && (a.upperBound.x - a.lowerBound.x) < 120 &&
                                    (a.upperBound.z - a.lowerBound.z) < 120;
      });
      // the tallest wall the chapter has, so the shot has somewhere to go
      list.sort((p, q) => (q.aabb.upperBound.y - q.aabb.lowerBound.y) -
                          (p.aabb.upperBound.y - p.aabb.lowerBound.y));
      for (const b of list.slice(0, 40)) {
        const a = b.aabb, y = a.lowerBound.y + 0.55;
        const mx = (a.lowerBound.x + a.upperBound.x) / 2;
        const mz = (a.lowerBound.z + a.upperBound.z) / 2;
        const tries = [[mx, a.lowerBound.z - 0.8, 0], [mx, a.upperBound.z + 0.8, Math.PI],
                       [a.lowerBound.x - 0.8, mz, Math.PI / 2], [a.upperBound.x + 0.8, mz, -Math.PI / 2]];
        for (const t of tries) {
          const h = g.capy.climbAt(t[0], y, t[1], t[2]);
          if (h && h.top - y > 4.0) return { x: t[0], y: y, z: t[1], yaw: t[2], top: h.top };
        }
      }
      return null;
    }, n);
    if (!spot) { log.push({ n: n, ok: false, why: 'no wall over 4 m' }); continue; }

    const place = async () => page.evaluate((o) => {
      const g = window.__capy, b = g.capy.body;
      b.position.set(o.x, o.y + 0.1, o.z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.capy.face(o.yaw);
      return g.capy.position.y;
    }, spot);

    let key = 'KeyW', rose = 0, y0 = await place();
    await page.keyboard.press('KeyC');
    await page.waitForTimeout(1500);
    await page.keyboard.down('KeyE');
    await page.waitForTimeout(500);
    await page.keyboard.down(key);
    await page.waitForTimeout(1400);
    rose = await page.evaluate((a) => window.__capy.capy.position.y - a, y0);
    if (rose < 0.4) {
      // the rig had not swung round; the stick was pointing out of the wall
      await page.keyboard.up(key);
      await page.keyboard.up('KeyE');
      await page.waitForTimeout(400);
      key = 'KeyS';
      y0 = await place();
      await page.keyboard.press('KeyC');
      await page.waitForTimeout(1500);
      await page.keyboard.down('KeyE');
      await page.waitForTimeout(500);
      await page.keyboard.down(key);
      await page.waitForTimeout(1400);
    }
    await page.waitForTimeout(1800);
    const st = await page.evaluate((a) => {
      const g = window.__capy;
      return { climbing: g.capy.climbing, rose: +(g.capy.position.y - a).toFixed(2),
               y: +g.capy.position.y.toFixed(2), brought: !!g.noticed('brought-climb') };
    }, y0);
    await page.screenshot({ path: 'qa/B5-climb-' + n + '.png' });
    await page.keyboard.up(key);
    await page.keyboard.up('KeyE');
    await page.waitForTimeout(600);
    log.push({ n: n, ok: true, key: key, wallTop: +spot.top.toFixed(1),
               at: [+spot.x.toFixed(1), +spot.z.toFixed(1)], climbing: st.climbing,
               rose: st.rose, y: st.y, brought: st.brought });
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b5-climbshot.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, log);
}
