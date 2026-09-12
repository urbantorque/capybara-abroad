// THE CARRIER STILL CARRIES. After the mass-zero broadphase rule (props.js,
// physSAPBroadphase) the capybara — DYNAMIC — must still stand on every
// KINEMATIC deck: the Quay ferry (berthed, then sailing), an Antarctic floe
// (drifting on its own) and the boat, the chiva's roof, a Venice gondola.
// "A carrier drops its passenger" is a known failure class; each case reports
// grounded / rideBody / height over the body's top after settling, and how far
// the animal and the body each moved over the next three seconds.
async page => {
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.reload(); await page.waitForTimeout(6000);
  await page.keyboard.press('Enter'); await page.waitForTimeout(3000);
  const out = {};
  const tp = (x, y, z) => page.evaluate(([x, y, z]) => {
    const g = window.__capy, b = g.capy.body;
    b.position.set(x, y, z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    b.wakeUp();
  }, [x, y, z]);
  const snap = (bodyPick) => page.evaluate((pick) => {
    const g = window.__capy, c = g.capy, p = c.body.position;
    let body = null;
    if (pick === 'ride') body = c.rideBody;
    else if (pick) body = g.world.bodies.find(b => b.id === pick) || null;
    let top = null, bx = null, bz = null;
    if (body) { body.updateAABB(); top = body.aabb.upperBound.y; bx = body.position.x; bz = body.position.z; }
    return { grounded: !!c.grounded, ride: !!c.rideBody, rideId: c.rideBody ? c.rideBody.id : null,
             x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2),
             overTop: top === null ? null : +(p.y - top).toFixed(2), bx: bx === null ? null : +bx.toFixed(2), bz: bz === null ? null : +bz.toFixed(2),
             kinPairs: g.world.contacts.filter(k => k.bi === c.body || k.bj === c.body).length,
             err: g.state.lastError || null };
  }, bodyPick);
  const settle = async (label, pickId) => {
    await page.waitForTimeout(2500);
    const a = await snap(pickId || 'ride');
    await page.waitForTimeout(3000);
    const b = await snap(pickId || a.rideId || 'ride');
    out[label] = { settled: a, later: b,
      capyMoved: +Math.hypot(b.x - a.x, b.z - a.z).toFixed(2),
      bodyMoved: (a.bx !== null && b.bx !== null) ? +Math.hypot(b.bx - a.bx, b.bz - a.bz).toFixed(2) : null };
  };

  // ---- 1. the Quay ferry: berthed, then under way ---------------------------
  await page.evaluate(() => { window.__capy.hud.cross('quay'); }); await page.waitForTimeout(5000);
  const helm = await page.evaluate(() => { const h = window.__capy.quay.boat.helm; return { x: h.x, y: h.y, z: h.z }; });
  await tp(helm.x, helm.y + 0.4, helm.z);
  await settle('ferryBerthed');
  await page.keyboard.press('KeyE'); await page.waitForTimeout(1200);
  await page.keyboard.down('KeyW');
  await settle('ferrySailing');
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyE'); await page.waitForTimeout(800);

  // ---- 2. Antarctica: the boat deck, then a floe ---------------------------
  await page.evaluate(() => { window.__capy.hud.cross('antarctic'); }); await page.waitForTimeout(5000);
  const ah = await page.evaluate(() => { const h = window.__capy.antarctic.boat.helm; return { x: h.x, y: h.y, z: h.z }; });
  await tp(ah.x, ah.y + 0.4, ah.z);
  await settle('antBoat');
  const floe = await page.evaluate(() => {
    const g = window.__capy, K = g.CANNON.Body.KINEMATIC;
    const fl = g.world.bodies.filter(b => b.type === K && b.shapes.length && b.shapes[0].constructor.name === 'Cylinder');
    if (!fl.length) return null;
    // the biggest one, so a stumble does not go over the edge
    fl.sort((a, b) => b.shapes[0].radiusTop - a.shapes[0].radiusTop);
    const b = fl[0]; b.updateAABB();
    return { id: b.id, x: b.position.x, z: b.position.z, top: b.aabb.upperBound.y, r: b.shapes[0].radiusTop, n: fl.length };
  });
  out.floeFound = floe;
  if (floe) { await tp(floe.x, floe.top + 0.5, floe.z); await settle('floe', floe.id); }

  // ---- 3. Cali: the chiva's roof --------------------------------------------
  await page.evaluate(() => { window.__capy.hud.cross('cali'); }); await page.waitForTimeout(5000);
  const ch = await page.evaluate(() => { const c = window.__capy.cali.chivaAt(); return { x: c.x, y: c.y, z: c.z }; });
  await tp(ch.x, ch.y + 4.2, ch.z);
  await settle('chivaRoof');
  out.chivaRoof.onChiva = await page.evaluate(() => window.__capy.cali.onChiva());

  // ---- 4. Venice: a gondola -------------------------------------------------
  await page.evaluate(() => { window.__capy.hud.cross('venice'); }); await page.waitForTimeout(5000);
  const gon = await page.evaluate(() => {
    const g = window.__capy, K = g.CANNON.Body.KINEMATIC;
    const gs = g.world.bodies.filter(b => b.type === K && b.shapes.length === 1 && b.shapes[0].constructor.name === 'Box');
    if (!gs.length) return null;
    // the one with the longest deck
    gs.sort((a, b) => Math.max(b.shapes[0].halfExtents.x, b.shapes[0].halfExtents.z) - Math.max(a.shapes[0].halfExtents.x, a.shapes[0].halfExtents.z));
    const b = gs[0]; b.updateAABB();
    return { id: b.id, x: b.position.x, z: b.position.z, top: b.aabb.upperBound.y, he: [b.shapes[0].halfExtents.x, b.shapes[0].halfExtents.y, b.shapes[0].halfExtents.z], n: gs.length };
  });
  out.gondolaFound = gon;
  if (gon) { await tp(gon.x, gon.top + 0.5, gon.z); await settle('gondola', gon.id); }

  // ---- 5. Sydney: a crowd collider still blocks -----------------------------
  await page.evaluate(() => { window.__capy.hud.cross('sydney'); }); await page.waitForTimeout(5000);
  out.crowd = await page.evaluate(async () => {
    const g = window.__capy, K = g.CANNON.Body.KINEMATIC, c = g.capy.body;
    const ws = g.world.bodies.filter(b => b.type === K && b.shapes.length === 1 && b.shapes[0].constructor.name === 'Box' && b.shapes[0].halfExtents.y > 0.5 && b.shapes[0].halfExtents.y < 1.2);
    if (!ws.length) return { walkers: 0 };
    const w = ws[0];
    // drop the animal INTO the walker's box and see whether the solver pushes it out
    c.position.set(w.position.x, w.position.y, w.position.z); c.velocity.set(0, 0, 0);
    c.previousPosition.copy(c.position); c.interpolatedPosition.copy(c.position); c.wakeUp();
    await new Promise(r => setTimeout(r, 1200));
    const d = Math.hypot(c.position.x - w.position.x, c.position.z - w.position.z);
    return { walkers: ws.length, pushedOut: +d.toFixed(2), contactsWithWalker: g.world.contacts.filter(k => (k.bi === c && k.bj === w) || (k.bj === c && k.bi === w)).length, err: g.state.lastError || null };
  });

  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4-ride.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
