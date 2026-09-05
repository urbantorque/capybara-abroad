// THREE MORE REACHABILITY CLAIMS IN COMMENTS, TESTED THE WAY THE BRADLEYS HEAD
// ONE SHOULD HAVE BEEN.
//
// quay.js said of Bradleys Head "the one you can actually swim to: the animal
// stands on the rim at 21 m" and a swimmer tops out at 2.3. That comment was
// written from a probe that PUT the animal there. This sweeps the other
// comments in src that assert the same kind of thing — that the player can, or
// cannot, get to a named place — and measures each with a leg that starts
// somewhere the chapter agrees is legal ground or legal water.
//
//   1. quay.js  "Bennelong Point, which is a podium you can swim to and climb
//                out on"                                   — POSITIVE claim
//   2. antarctic.js  "the whalers' beach ... is exactly why the wreck is
//                somewhere you can climb on"               — POSITIVE claim
//   3. drift.js  "the arch legs are solid; the ring is over four metres up and
//                out of reach"                             — NEGATIVE claim
//
// A positive claim fails if the animal never gets up. A negative one fails if it
// does. Both are the same measurement: drive at the thing on every key and log
// the highest the animal ever is, and whether it was ever grounded up there.
async page => {
  const out = {};

  const legs = async (label, setup, keys, holdMs, jumps) => {
    const rows = [];
    for (const key of keys) {
      await page.evaluate(setup);
      await page.waitForTimeout(700);
      const base = await page.evaluate(() => +window.__capy.capy.position.y.toFixed(2));
      await page.evaluate(() => {
        const g = window.__capy;
        window.__m = -999; window.__gndHigh = -999;
        if (window.__t) clearInterval(window.__t);
        window.__t = setInterval(() => {
          const p = g.capy.position;
          if (p.y > window.__m) window.__m = p.y;
          if (g.capy.grounded && p.y > window.__gndHigh) window.__gndHigh = p.y;
        }, 40);
      });
      if (key) await page.keyboard.down(key);
      for (let k = 0; k < jumps; k++) {
        await page.waitForTimeout(holdMs);
        await page.keyboard.press('Space');
      }
      if (key) await page.keyboard.up(key);
      await page.waitForTimeout(500);
      rows.push(await page.evaluate(a => {
        const g = window.__capy, p = g.capy.position;
        clearInterval(window.__t);
        return { key: a.key || '(still)', base: a.base,
                 maxY: +window.__m.toFixed(2),
                 maxGroundedY: window.__gndHigh < -900 ? null : +window.__gndHigh.toFixed(2),
                 end: [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)],
                 gnd: !!g.capy.grounded, swim: !!g.capy.swimming };
      }, { key, base }));
    }
    out[label] = rows;
  };

  // ---- 1. Bennelong Point, Circular Quay --------------------------------
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(7000);
  out.quayBiome = await page.evaluate(() => window.__capy.biome.current);
  out.benTop = await page.evaluate(() => {
    const a = window.__capy.quay;
    return { podiumTop: +a.terrainHeight(78, 6).toFixed(2), water: a.waterLevel };
  });
  await legs('bennelong', () => {
    // in genuine water off the point's north face, found by asking the chapter
    const g = window.__capy, a = g.quay;
    let s = null;
    for (let d = 28; d < 120; d += 2) {
      const x = 78, z = 6 - d;
      if (a.isOverWater(x, z) && a.terrainHeight(x, z) < 1) { s = { x, z }; break; }
    }
    if (!s) s = { x: 78, z: -40 };
    g.capy.body.position.set(s.x, 0.3, s.z);
    g.capy.body.velocity.set(0, 0, 0);
    g.capy.body.aabbNeedsUpdate = true;
  }, ['KeyW', 'KeyS', 'KeyA', 'KeyD'], 620, 10);

  // ---- 2. the wreck on the whalers' beach, Antarctica --------------------
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Comma');
  await page.waitForTimeout(7000);
  out.antBiome = await page.evaluate(() => window.__capy.biome.current);
  // the wreck's own drawn top, from the scene, so the claim is tested against
  // the thing that is drawn rather than against a constant
  out.wreck = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE, box = new T.Box3(), v = new T.Vector3();
    let best = null;
    g.scene.traverse(o => {
      if (!o.isMesh || o.visible === false) return;
      box.setFromObject(o);
      box.getCenter(v);
      // the whalers' beach is centred on (122, 30)
      if (Math.hypot(v.x - 122, v.z - 30) > 45) return;
      if (box.max.y - box.min.y < 0.8 || box.max.y > 30) return;
      if (!best || box.max.y > best.top) {
        best = { name: o.name || o.type, top: +box.max.y.toFixed(2),
                 at: [+v.x.toFixed(1), +v.z.toFixed(1)] };
      }
    });
    return best;
  });
  await legs('wreck', () => {
    const g = window.__capy, a = g.antarctic;
    // stand on the beach 12 m short of the wreck's centre
    const h = a.terrainHeight(122, 42);
    g.capy.body.position.set(122, (h === h ? h : 0) + 0.6, 42);
    g.capy.body.velocity.set(0, 0, 0);
    g.capy.body.aabbNeedsUpdate = true;
  }, ['KeyW', 'KeyS', 'KeyA', 'KeyD'], 560, 10);

  // ---- 3. the arch ring, the Drift ---------------------------------------
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Digit9');
  await page.waitForTimeout(7000);
  out.driBiome = await page.evaluate(() => window.__capy.biome.current);
  out.arch = await page.evaluate(() => {
    const g = window.__capy;
    // driARCH is {x:5, z:-106, y:84}; SPRING 3.6 and R 2.6 in driBuildRoosts,
    // so the ring's underside is 3.6 m over the island and its crown 6.2.
    const a = g.drift;
    return { island: +a.terrainHeight(5, -106).toFixed(2), springline: 3.6, crown: 6.2,
             gravity: g.world.gravity.y };
  });
  // standing under it, jumping: the only verb that could reach a ring
  await legs('archRing', () => {
    const g = window.__capy, a = g.drift;
    const h = a.terrainHeight(5, -106);
    g.capy.body.position.set(5, (h === h ? h : 84) + 0.6, -106);
    g.capy.body.velocity.set(0, 0, 0);
    g.capy.body.aabbNeedsUpdate = true;
  }, [null, 'KeyW'], 900, 8);

  out.err = await page.evaluate(() =>
    (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null);
  await page.evaluate(o => fetch('/shot?name=px-claims.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
