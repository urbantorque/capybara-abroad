// qa/l4-podcam.js — THE SYDNEY CAMERA ON THE PODIUM (L4, E6 / player #1).
//
// Stands the animal on three spots of the Opera House podium (the red stage,
// the deck beside the shells, the ceremonial stair), turns the camera through
// 360 degrees with a right-button drag in 45 degree steps, and at every step
// records where the eye is against the solid geometry under and around it:
//
//   camY      the rendered eye's height
//   solidTop  the highest static-box top under (camX, camZ) — the deck, a tread,
//             a stair cheek, or 0 for the forecourt
//   inside    the eye is INSIDE a static box (below its top, above its bottom,
//             within its footprint)
//   blocked   a static body between the eye and the animal's shoulder
//   ndc       the animal's projected position; onScreen when |x|,|y| < 1
//   clear     sysCamClear's factor last frame (game.camInfo.clear)
//
// Output: qa/l4-podcam-<tag>.json.png (JSON) and frames qa/l4-podcam-<tag>-<spot>-<yaw>.png.
// Run with  npx playwright-cli -s=<you> run-code --filename=qa/l4-podcam.js
// The tag is the constant at the top of the body: 'before' for the baseline, 'after' after the fix.
async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4000);
  const tag = 'after';   // 'before' for the baseline
  // The red stage is NOT one of them: standing there fires the marquee's own
  // frameShot, which owns the yaw, so a drag is undone within a second and the
  // sweep measures the shot rather than the rig.
  const spots = [
    { name: 'mouth', x: 4.5, y: 1.9, z: 0.9 },      // nose to the concert hall's face (collider z 0.2)
    { name: 'foot',  x: -13.7, y: 0.6, z: -2.0 },   // forecourt, at the plinth's west face (x -13)
    { name: 'cheek', x: 13.5, y: 0.6, z: 5.9 },     // beside the stair cheek (x 12 +- 0.85)
    { name: 'stair', x: 0, y: 1.3, z: 5.6 },        // on the flight
  ];
  const out = { tag, biome: null, rows: [] };
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  const W = 1280, H = 720;
  await page.setViewportSize({ width: W, height: H });
  for (const s of spots) {
    await page.evaluate((s) => {
      const g = window.__capy;
      const b = g.capy.body;
      b.position.set(s.x, s.y, s.z);
      b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
      if (b.wakeUp) b.wakeUp();
    }, s);
    await page.waitForTimeout(2500);
    let yaw0 = await page.evaluate(() => window.__capy.input.camYaw);
    for (let k = 0; k < 8; k++) {
      const want = yaw0 + k * Math.PI / 4;
      // right-button drag: camYawTarget -= dx * 0.005, so a negative dx turns +
      for (let tries = 0; tries < 3; tries++) {
        const have = await page.evaluate(() => window.__capy.input.camYaw);
        let d = want - have;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        if (Math.abs(d) < 0.03) break;
        const dx = -d / 0.005;
        await page.mouse.move(W / 2, H / 2);
        await page.mouse.down({ button: 'right' });
        await page.mouse.move(W / 2 + dx, H / 2, { steps: 8 });
        await page.mouse.up({ button: 'right' });
        await page.waitForTimeout(1200);
      }
      for (const phase of ['early', 'late']) {
      await page.waitForTimeout(phase === 'early' ? 0 : 2000);
      const row = await page.evaluate(() => {
        const g = window.__capy;
        const cam = g.camera, cp = g.capy.position;
        const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
        let solidTop = 0, inside = false, insideName = '';
        for (const b of g.world.bodies) {
          if (b.mass > 0 || b.isTrigger) continue;
          if (b.userData && (b.userData.npc || b.userData.local)) continue;
          for (let i = 0; i < b.shapes.length; i++) {
            const sh = b.shapes[i];
            if (!sh.halfExtents) continue;
            const p = b.position, o = b.shapeOffsets[i];
            const bx = p.x + o.x, by = p.y + o.y, bz = p.z + o.z;
            const h = sh.halfExtents;
            if (Math.abs(cx - bx) < h.x && Math.abs(cz - bz) < h.z) {
              const top = by + h.y;
              if (top > solidTop) solidTop = top;
              if (cy > by - h.y && cy < top) { inside = true; insideName = 'box@' + bx.toFixed(1) + ',' + by.toFixed(1) + ',' + bz.toFixed(1); }
            }
          }
        }
        // a static body between the eye and the animal's shoulder
        let blocked = false;
        try {
          const C = g.CANNON || (g.world && g.world.constructor && null);
          const from = new g.world.bodies[0].position.constructor(cx, cy, cz);
          const to = new g.world.bodies[0].position.constructor(cp.x, cp.y + 0.45, cp.z);
          g.world.raycastAll(from, to, { skipBackfaces: false }, (res) => {
            const b = res.body;
            if (!b || b.mass > 0 || b.isTrigger) return;
            if (b === g.capy.body) return;
            if (b.userData && (b.userData.npc || b.userData.local)) return;
            const t = res.shape && res.shape.type;
            if (t === 32 || t === 2) return; // heightfield, plane
            blocked = true;
          });
        } catch (e) { blocked = null; }
        const v = { x: cp.x, y: cp.y + 0.3, z: cp.z };
        const V = new cam.position.constructor(v.x, v.y, v.z).project(cam);
        const ci = g.camInfo || {};
        return {
          capy: [+cp.x.toFixed(2), +cp.y.toFixed(2), +cp.z.toFixed(2)],
          cam: [+cx.toFixed(2), +cy.toFixed(2), +cz.toFixed(2)],
          yawDeg: Math.round(g.input.camYaw * 180 / Math.PI),
          camY: +cy.toFixed(2), solidTop: +solidTop.toFixed(2), over: +(cy - solidTop).toFixed(2),
          inside, insideName, blocked,
          ndc: [+V.x.toFixed(2), +V.y.toFixed(2)], onScreen: Math.abs(V.x) < 1 && Math.abs(V.y) < 1 && V.z < 1,
          clear: +(ci.clear || 0).toFixed(2), dist: +(ci.dist || 0).toFixed(2),
          pitchDeg: Math.round((ci.pitch || 0) * 180 / Math.PI),
        };
      });
      row.spot = s.name; row.step = k * 45; row.phase = phase;
      out.rows.push(row);
      // Frames for every settled step and for any transient that is wrong; a
      // screenshot on a loaded machine can take a while, so it may not kill the sweep.
      if (phase === 'late' || row.inside || row.blocked || !row.onScreen) {
        try {
          await page.screenshot({ path: 'qa/l4-podcam-' + tag + '-' + s.name + '-' + (k * 45) + '-' + phase + '.png', timeout: 90000 });
        } catch (e) { row.shotErr = String(e && e.message || e).slice(0, 60); }
      }
      }
    }
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4-podcam-' + o.tag + '.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
