// HOW HIGH DOES THE ANIMAL ACTUALLY GET OVER THE ARCH ISLAND?
//
// Two runs of px-claims disagreed: one reported a 4.54 m apex over the island
// and the next reported 0.74 to 2.73 with three of four legs ending at y 42,
// which is off the island altogether. A number that moves by 1.8 m between runs
// is not a number, and the claim under test — "the ring is over four metres up
// and out of reach" — turns on exactly that.
//
// The fault in both was measuring height against ONE datum, the terrain at the
// arch centre, while the animal ran somewhere else: a jump from higher ground,
// or a fall off the lip, both corrupt it. So this measures the apex against the
// GROUND UNDER THE ANIMAL at every sample, pins it near the arch, and reports
// the clearance a jump actually buys.
async page => {
  const out = { runs: [] };
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Digit9');
  await page.waitForTimeout(7000);
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  out.gravity = await page.evaluate(() => window.__capy.world.gravity.y);

  for (const mode of ['standing', 'running']) {
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.evaluate(() => {
        const g = window.__capy, a = g.drift;
        const h = a.terrainHeight(5, -106);
        g.capy.body.position.set(5, (h === h ? h : 84) + 0.5, -106);
        g.capy.body.velocity.set(0, 0, 0);
        g.capy.body.aabbNeedsUpdate = true;
        window.__cl = -999; window.__samples = 0; window.__offIsland = 0;
        if (window.__t) clearInterval(window.__t);
        window.__t = setInterval(() => {
          const p = g.capy.position;
          const gy = g.drift.terrainHeight(p.x, p.z);
          window.__samples++;
          // CLEARANCE OVER THE GROUND UNDER THE ANIMAL, not over a fixed datum
          if (gy === gy && gy > 40) {
            const c = p.y - gy;
            if (c > window.__cl) window.__cl = c;
          } else window.__offIsland++;
        }, 33);
      });
      await page.waitForTimeout(600);
      if (mode === 'running') await page.keyboard.down('KeyW');
      for (let k = 0; k < 6; k++) { await page.waitForTimeout(750); await page.keyboard.press('Space'); }
      if (mode === 'running') await page.keyboard.up('KeyW');
      await page.waitForTimeout(500);
      out.runs.push(await page.evaluate(a => {
        const g = window.__capy, p = g.capy.position;
        clearInterval(window.__t);
        return { mode: a.mode, attempt: a.attempt,
                 maxClearance: +window.__cl.toFixed(2),
                 offIslandSamples: window.__offIsland, samples: window.__samples,
                 end: [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)] };
      }, { mode, attempt }));
    }
  }
  // and the lowest drawn stone over the archway floor, on a finer grid
  out.lowestDrawn = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE;
    const rc = new T.Raycaster(), up = new T.Vector3(0, 1, 0);
    const vis = o => { while (o) { if (o.visible === false) return false; o = o.parent; } return true; };
    let lo = 1e9, at = null;
    for (let u = -5; u <= 5; u += 0.5) {
      for (let v = -3; v <= 3; v += 0.5) {
        const x = 5 + u, z = -106 + v;
        const gy = g.drift.terrainHeight(x, z);
        if (!(gy > 40)) continue;
        rc.set(new T.Vector3(x, gy + 0.4, z), up);
        rc.near = 0.05; rc.far = 25;
        const h = rc.intersectObjects(g.scene.children, true).find(hit => {
          const o = hit.object;
          if (!o.isMesh && !o.isInstancedMesh) return false;
          if (!vis(o)) return false;
          const m = Array.isArray(o.material) ? o.material[0] : o.material;
          return m && !(m.transparent && m.opacity < 0.35) && m.depthWrite !== false;
        });
        if (!h) continue;
        const c = 0.4 + h.distance;
        if (c < lo) { lo = c; at = [+u.toFixed(1), +v.toFixed(1)]; }
      }
    }
    return { clearance: +lo.toFixed(2), at };
  });
  out.err = await page.evaluate(() =>
    (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null);
  await page.evaluate(o => fetch('/shot?name=px-drift-hop.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), o = out);
}
