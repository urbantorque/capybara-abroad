async page => {
  // ---- DOES THE ANIMAL ACTUALLY GO UP, AND DOES THE FIND FIRE? -----------
  // Job 3c. A footprint measurement says a hold EXISTS; it does not say the
  // verb works, and it certainly does not say `brought-climb` can fire — that
  // find has been unreachable by construction since the day it was written,
  // because `sysCLIMB_TAUGHT` named exactly the three chapters that published
  // `climbHold` and the test is `climbing && !TAUGHT[chapter]`.
  //
  // Real keys, real clock, CLEARED SAVE (harness trap 8: a completed find
  // survives a reload for ever, and reads back true on tick zero with the
  // animal fifty metres from the wall).
  const CHAPTERS = ['sydney', 'venice', 'kyoto', 'sahara', 'hanoi', 'quay'];

  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);

  const out = { rows: [], finds: null };
  for (const n of CHAPTERS) {
    // Find a wall this chapter actually has: walk the outside of its static
    // bodies exactly as qa/b5-climb.js does, and stop at the first point where
    // some facing finds a hold with at least three metres of wall over it.
    const spot = await page.evaluate((name) => {
      const g = window.__capy;
      g.biome.switchTo(name);
      const list = g.world.bodies.filter(b => {
        if (!b || b.mass > 0 || b.isTrigger) return false;
        if (b.type !== undefined && g.CANNON.Body && b.type !== g.CANNON.Body.STATIC) return false;
        if (b.userData && (b.userData.npc || b.userData.local)) return false;
        if (!b.aabb || !isFinite(b.aabb.upperBound.y)) return false;
        const h = b.aabb.upperBound.y - b.aabb.lowerBound.y;
        return h > 3.0 && (b.aabb.upperBound.x - b.aabb.lowerBound.x) < 200;
      });
      for (const b of list) {
        const a = b.aabb, y = a.lowerBound.y + 0.55;
        const tries = [
          [(a.lowerBound.x + a.upperBound.x) / 2, a.lowerBound.z - 0.8, 0],
          [(a.lowerBound.x + a.upperBound.x) / 2, a.upperBound.z + 0.8, Math.PI],
          [a.lowerBound.x - 0.8, (a.lowerBound.z + a.upperBound.z) / 2, Math.PI / 2],
          [a.upperBound.x + 0.8, (a.lowerBound.z + a.upperBound.z) / 2, -Math.PI / 2],
        ];
        for (const t of tries) {
          const h = g.capy.climbAt(t[0], y, t[2] === 0 || t[2] === Math.PI ? t[1] : t[1], t[2]);
          if (h && h.top - y > 3.0) return { x: t[0], y: y, z: t[1], yaw: t[2], top: h.top };
        }
      }
      return null;
    }, n);
    if (!spot) { out.rows.push({ n: n, ok: false, why: 'no wall found' }); continue; }

    const start = await page.evaluate((o) => {
      const g = window.__capy, b = g.capy.body;
      b.position.set(o.x, o.y + 0.1, o.z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.capy.face(o.yaw);
      return { y: g.capy.position.y, chapter: g.biome.current };
    }, spot);
    // Camera behind the animal, so that W means "into the wall" — which is the
    // whole reason the climb needs no key of its own. See capyCLIMB_UP.
    await page.keyboard.press('KeyC');
    await page.waitForTimeout(900);
    await page.keyboard.down('KeyE');
    await page.waitForTimeout(600);
    const clung = await page.evaluate(() => window.__capy.capy.climbing);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(2600);
    const now = await page.evaluate(() => {
      const g = window.__capy;
      return { climbing: g.capy.climbing, y: g.capy.position.y,
               brought: !!g.noticed('brought-climb'), err: g.state.lastError || '' };
    });
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyE');
    await page.waitForTimeout(500);
    out.rows.push({ n: n, ok: true, spot: [+spot.x.toFixed(1), +spot.z.toFixed(1)],
                    wallTop: +spot.top.toFixed(1), clungOnGrab: clung,
                    climbing: now.climbing, y0: +start.y.toFixed(2), y1: +now.y.toFixed(2),
                    rose: +(now.y - start.y).toFixed(2), brought: now.brought, err: now.err });
  }
  out.finds = await page.evaluate(() => ({ brought: !!window.__capy.noticed('brought-climb'),
                                           total: window.__capy.noticed() }));
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b5-brought.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
