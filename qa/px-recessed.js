async page => {
  // ---------------------------------------------------------------------------
  // qa/px-recessed.js — HOW FAR DO YOU GET INSIDE THE PICTURE? (X9's last item)
  //
  // ROADMAP-PHYSICS area 2 recorded a `recessed` category and X9 left it as the
  // one thing on its list that "was never re-measured at all": a collider that
  // sits BEHIND its own drawn face, so you walk into a cliff before it stops
  // you. Thirty-two samples across ten chapters, from `qa/px-solid-audit`.
  //
  // THE ORIGINAL NUMBER IS NOT THE PLAYER'S NUMBER. The audit compared two rays
  // from the same point — a drawn hit at `dg`, a physics hit at `pd` — and
  // called `pd − dg > 0.7` recessed. That is a fact about two rays. What a
  // player meets is how far their own body ends up INSIDE the drawn surface,
  // which is `(how far they got) + (their own radius) − (where the face is)`,
  // and nobody has measured it.
  //
  // So each of the thirty-two is re-walked: stand at the sample, look for the
  // drawn face again (it may not be there any more — five passes have moved
  // geometry since), then drive at it until it stops and see where the nose
  // ended up. A sample that cannot be reached, or whose face has gone, is
  // reported as that rather than as a defect.
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

  // the thirty-two, as the audit left them: [x, z, dx, dz, drawn, phys]
  const S = {
    manly:   [[-2, 30, 1, 0, 2.11, 4.06], [-50, 38, 0, 1, 0.13, 1.5], [51, 38, 0, 1, 0.13, 1.5]],
    sahara:  [[170, -85, 1, 0, 0.21, 2.04], [195, 30, 0, -1, 1.65, 2.38]],
    drift:   [[-7, 0, 1, 0, 0.1, 1.88], [49, -140, -1, 0, 0.56, 2.14],
              [-47, -110, 1, 0, 1.93, 3.29], [-42, -117, -1, 0, 0.55, 1.78],
              [-42, -115, -1, 0, 0.5, 1.3]],
    goreme:  [[-71, -37, -1, 0, 0.39, 1.92], [-71, -15, -1, 0, 1.71, 3.12],
              [-90, -72, 0, 1, 0.95, 2.3], [-87, -72, 0, 1, 0.95, 2.3],
              [-85, -72, 0, 1, 0.95, 2.3], [-73, -72, 0, 1, 0.95, 2.3],
              [-21, -2, 0, -1, 0.92, 2.27], [-40, 48, 0, 1, 0.4, 1.5],
              [-4, 53, 0, 1, 1.91, 2.97], [15, 40, 1, 0, 2.33, 3.27],
              [-42, 65, 0, -1, 1.1, 2]],
    kyoto:   [[-5, -45, 0, -1, 0.62, 2.12], [-68, -65, 0, -1, 0.36, 1.56]],
    cali:    [[18, 45, 0, 1, 0.25, 1.7], [42, 70, 0, -1, 2.42, 3.2]],
    kowloon: [[13, -60, -1, 0, 0.8, 2.1], [-7, -42, -1, 0, 1.58, 2.3]],
    rio:     [[-16, 83, 0, 1, 0.45, 1.74]],
    iceland: [[-17, 133, 0, -1, 0.85, 2], [-3, 133, 0, -1, 0.85, 2],
              [36, 133, 0, -1, 0.89, 2]],
    pasto:   [[68, -10, 0, 1, 2.05, 2.83]],
  };

  const out = { errs: errs, rows: [] };
  for (const b of Object.keys(S)) {
    const rows = await page.evaluate(async (arg) => {
      const g = window.__capy, THREE = g.THREE;
      const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
      g.biome.switchTo(arg.b);
      tick(60 * 12);
      const mod = g[arg.b];
      const terr = mod && mod.terrainHeight;
      // the animal's own half-width, so "inside the picture" is its NOSE and
      // not its centre. Read off the body rather than assumed.
      let rad = 0.32;
      try {
        const sh = g.capy.body.shapes[0];
        if (sh && sh.halfExtents) rad = Math.max(sh.halfExtents.x, sh.halfExtents.z);
        else if (sh && sh.radius) rad = sh.radius;
      } catch (e) {}
      const ray = new THREE.Raycaster();
      const drawnAt = function (x, y, z, dx, dz) {
        ray.set(new THREE.Vector3(x, y, z), new THREE.Vector3(dx, 0, dz).normalize());
        ray.far = 6;
        const hits = ray.intersectObjects(g.scene.children, true);
        for (const h of hits) {
          let ok = true;
          for (let p = h.object; p; p = p.parent) if (!p.visible) { ok = false; break; }
          if (!ok) continue;
          const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
          if (m && m.transparent && m.opacity < 0.6) continue;
          const bs = h.object.geometry && h.object.geometry.boundingSphere;
          if (bs && bs.radius > 400) continue;
          // ...and not the ground rising in front of us
          if (h.point.y <= (terr ? terr(h.point.x, h.point.z) : 0) + 0.4) continue;
          const chain = [];
          for (let p = h.object; p && chain.length < 3; p = p.parent) chain.push(p.name || p.type);
          return { d: +h.distance.toFixed(2), what: chain.join('<') };
        }
        return null;
      };
      const res = [];
      for (const s of arg.list) {
        const [x, z, dx, dz] = s;
        const y0 = (terr ? terr(x, z) : 0) + 0.55;
        const face = drawnAt(x, y0, z, dx, dz);
        const b2 = g.capy.body;
        b2.position.set(x, (terr ? terr(x, z) : 0) + 0.5, z);
        b2.velocity.set(0, 0, 0);
        tick(50);
        const sx = b2.position.x, sz = b2.position.z;
        // did it even stay put? a sample in water or on a slope is not a sample
        const drift0 = Math.hypot(sx - x, sz - z);
        let stuck = 0, lastD = 0;
        for (let i = 0; i < 60 * 9; i++) {
          b2.velocity.x = dx * 4; b2.velocity.z = dz * 4;
          if (dx) b2.velocity.z = 0; else b2.velocity.x = 0;
          g.tick(1 / 60, false);
          const d = (b2.position.x - sx) * dx + (b2.position.z - sz) * dz;
          if (Math.abs(d - lastD) < 0.004) stuck++; else stuck = 0;
          lastD = d;
          if (stuck > 45) break;
        }
        const went = (b2.position.x - sx) * dx + (b2.position.z - sz) * dz;
        res.push({
          b: arg.b, at: [x, z], dir: dx + ',' + dz,
          auditDrawn: s[4], auditPhys: s[5],
          faceNow: face ? face.d : null, what: face ? face.what : null,
          went: +went.toFixed(2), drift0: +drift0.toFixed(2),
          // positive = the animal's nose finished INSIDE the drawn surface
          inside: face ? +(went + rad - face.d).toFixed(2) : null,
          rad: +rad.toFixed(2),
        });
      }
      return res;
    }, { b: b, list: S[b] });
    for (const r of rows) out.rows.push(r);
  }

  out.errN = errs.length;
  await page.evaluate((o) => fetch('/shot?name=px-recessed.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
