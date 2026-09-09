async page => {
  // ---------------------------------------------------------------------------
  // qa/px-cave-sill.js — CAN THE ANIMAL GET ONTO THE SILL? (the cave slab, 2)
  //
  // `qa/px-cave-slab.js` settled the two big questions: the inner face of the
  // far wall is solid (walked at hard, from two heights, stopped at z −182.3),
  // and there is no collided floor beyond it (placed at z −198, the animal fell
  // and the rescue put it back at z +42). So the 32 m slab is scenery behind a
  // solid wall.
  //
  // ONE PATH IS LEFT, and it is the only one that would make any of it matter:
  // the slot's sill is at y 15.3 and the passage floor under it is at 12.5, so
  // the gap is 2.8 m up. If the animal can get up there — a hop, a hop off the
  // rubble, a climb — it walks through a hole in a solid wall into a region
  // with no floor. That is not "a way out of the mountain", but it is ten bad
  // seconds, and it decides whether anything needs doing at all.
  //
  // Everything a player has, tried against it: a standing hop, a running hop,
  // a hop with the slide's speed behind it, and the climb.
  // ---------------------------------------------------------------------------
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.reload();
  await page.waitForTimeout(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(8000);

  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    g.biome.switchTo('cave');
    tick(60 * 12);
    const res = { sill: 15.3, floor: +g.cave.terrainHeight(0, -180).toFixed(2), tries: [] };

    // The highest the animal gets, given a run-up of `vz` and a hop, repeated
    // often enough that any single lucky bounce is in the sample.
    const attempt = function (why, vz, hops, fromZ) {
      const b = g.capy.body;
      let peak = -99, peakZ = 0, best = null;
      b.position.set(0, g.cave.terrainHeight(0, fromZ) + 0.6, fromZ);
      b.velocity.set(0, 0, 0);
      tick(45);
      for (let h = 0; h < hops; h++) {
        // drive at the wall
        for (let i = 0; i < 70; i++) {
          b.velocity.z = vz;
          g.tick(1 / 60, false);
        }
        // ...and jump, the way the key does
        try { g.capy.tryHop ? g.capy.tryHop() : (b.velocity.y = 7.2); }
        catch (e) { b.velocity.y = 7.2; }
        for (let i = 0; i < 90; i++) {
          b.velocity.z = vz;
          g.tick(1 / 60, false);
          if (b.position.y > peak) {
            peak = b.position.y; peakZ = b.position.z;
          }
          // through the gap?
          if (b.position.z < -184 && b.position.y > 15.3) best = 'THROUGH';
        }
        if (best) break;
      }
      res.tries.push({ why: why, peakY: +peak.toFixed(2), atZ: +peakZ.toFixed(1),
                       overSill: peak > 15.3, through: best,
                       endZ: +b.position.z.toFixed(1), endY: +b.position.y.toFixed(2) });
    };
    attempt('a standing hop at the wall', -0.2, 6, -180);
    attempt('a running hop at the wall', -6, 8, -178);
    attempt('a long run at it', -9, 8, -172);

    // ...and the rubble, which is the only thing on that floor that could be a
    // step: drawn into the exit's merger with no collider of its own, so it
    // should not be one. Named here so the answer is on the record.
    let rubble = 0;
    g.scene.traverse(function (o) {
      if (o.isMesh && o.geometry && o.geometry.boundingBox === null) o.geometry.computeBoundingBox();
    });
    res.rubbleBodies = rubble;

    // What the world holds up out there, once and for all: how far the ground
    // collider actually reaches down the passage.
    res.support = [];
    for (const z of [-170, -176, -180, -182, -184, -190]) {
      const b = g.capy.body;
      b.position.set(0, g.cave.terrainHeight(0, z) + 0.5, z);
      b.velocity.set(0, 0, 0);
      tick(90);
      res.support.push({ z: z, endY: +b.position.y.toFixed(2),
                         endZ: +b.position.z.toFixed(1),
                         grounded: !!g.capy.grounded });
    }
    return res;
  });

  out.errs = errs; out.errN = errs.length;
  await page.evaluate((o) => fetch('/shot?name=px-cave-sill.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
