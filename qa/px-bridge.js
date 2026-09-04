// IS THE HARBOUR BRIDGE DECK SOLID, AND CAN A PLAYER GET ON IT?
//
// The last shelf item: "Sydney's ferries, Quay's moored yachts and the bridge
// traffic are drawn and not solid. All are on water or on a deck whose
// reachability is unproven. Confirm reachability first; collide only what a
// player can reach."
//
// Thirty-eight cars and a three-carriage train run on Quay's bridge deck at
// y 25. Reading quayBuildBridge, the pylons, the eight approach piers and the
// two abutments all get a quayStaticBox and the DECK gets none — so before
// asking whether the cars should be solid, ask whether the road under them is.
//
// Three questions, in order:
//   A. does the physics world contain anything at deck height, anywhere along
//      the 380 m carriageway?
//   B. if the animal is put ON the deck, does it stand or does it fall?
//   C. is there a route up at all — the deck lands on a bluff at each end, and
//      a bluff is a solid headland. Swim to one and try to get out of the water.
async page => {
  const out = {};
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Digit3');            // 3 = quay
  await page.waitForTimeout(7000);
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  out.bridge = await page.evaluate(() => {
    const b = window.__capy.quay.bridge;
    return { x: b.x, z: b.z, deck: b.deck, span: b.span, yaw: b.yaw };
  });

  // ---- A. what is under the deck line, in the PHYSICS world ---------------
  out.deckRay = await page.evaluate(() => {
    const g = window.__capy, C = g.CANNON;
    const B = g.quay.bridge;
    const cs = Math.cos(B.yaw), sn = Math.sin(B.yaw);
    const rows = [];
    // every 20 m along the carriageway, from bluff to bluff
    for (let u = -190; u <= 190; u += 20) {
      const x = B.x + u * cs, z = B.z - u * sn;
      // from just over the deck to just under it: a deck collider would be here
      const res = new C.RaycastResult();
      g.world.raycastClosest(new C.Vec3(x, B.deck + 3, z), new C.Vec3(x, B.deck - 3.5, z),
                             { skipBackfaces: true }, res);
      // ...and what the world DOES have under this point, however far down
      const res2 = new C.RaycastResult();
      g.world.raycastClosest(new C.Vec3(x, B.deck + 3, z), new C.Vec3(x, -6, z),
                             { skipBackfaces: true }, res2);
      rows.push({ u, atDeck: res.hasHit ? +res.hitPointWorld.y.toFixed(2) : null,
                  anythingBelow: res2.hasHit ? +res2.hitPointWorld.y.toFixed(2) : null });
    }
    return rows;
  });

  // ---- B. put the animal on the deck and see whether it is there in 3 s ---
  out.stand = [];
  for (const u of [0, 60, 120, 175]) {
    await page.evaluate(uu => {
      const g = window.__capy, B = g.quay.bridge;
      const cs = Math.cos(B.yaw), sn = Math.sin(B.yaw);
      g.capy.body.position.set(B.x + uu * cs, B.deck + 1.0, B.z - uu * sn);
      g.capy.body.velocity.set(0, 0, 0);
      g.capy.body.aabbNeedsUpdate = true;
    }, u);
    await page.waitForTimeout(3000);
    out.stand.push(await page.evaluate(uu => {
      const g = window.__capy, B = g.quay.bridge, p = g.capy.position;
      return { u: uu, y: +p.y.toFixed(2), fell: +(B.deck + 1.0 - p.y).toFixed(2),
               grounded: !!g.capy.grounded, swimming: !!g.capy.swimming };
    }, u));
  }

  // ---- C. can the animal get OUT OF THE WATER onto the landfall bluff? ----
  // The bluff is a headland: an octagonal box from the water to h, with two
  // domed tiers over it. If its face is sheer there is no way up and the deck
  // is unreachable however solid it is.
  out.climb = [];
  for (const u of [190, -190]) {
    await page.evaluate(uu => {
      const g = window.__capy, B = g.quay.bridge;
      const cs = Math.cos(B.yaw), sn = Math.sin(B.yaw);
      // in the water, 30 m out from the bluff centre on the harbour side
      const bx = B.x + uu * cs, bz = B.z - uu * sn;
      g.capy.body.position.set(bx, 0.4, bz + 34);
      g.capy.body.velocity.set(0, 0, 0);
      g.capy.body.aabbNeedsUpdate = true;
      window.__maxY = -99;
      if (window.__cw) clearInterval(window.__cw);
      window.__cw = setInterval(() => {
        const y = g.capy.position.y;
        if (y > window.__maxY) window.__maxY = y;
      }, 50);
    }, u);
    await page.waitForTimeout(600);
    // swim at it, then hold forward and jump repeatedly for eight seconds
    await page.keyboard.down('KeyW');
    for (let k = 0; k < 8; k++) {
      await page.waitForTimeout(700);
      await page.keyboard.press('Space');
    }
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(600);
    out.climb.push(await page.evaluate(uu => {
      const g = window.__capy, p = g.capy.position;
      clearInterval(window.__cw);
      return { u: uu, maxY: +window.__maxY.toFixed(2), y: +p.y.toFixed(2),
               at: [+p.x.toFixed(1), +p.z.toFixed(1)],
               grounded: !!g.capy.grounded, swimming: !!g.capy.swimming };
    }, u));
    await page.screenshot({ path: 'qa/px-bridge-bluff' + (u > 0 ? 'E' : 'W') + '.png' });
  }
  out.err = await page.evaluate(() =>
    (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null);
  await page.evaluate(o => fetch('/shot?name=px-bridge.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
