async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);

  const out = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    const g = window.__capy, THREE = g.THREE, CANNON = g.CANNON;
    if (g.biome.current !== 'monaco') { g.biome.switchTo('monaco'); await sleep(1700); }
    for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
    const r = { live: g.biome.current };
    if (r.live !== 'monaco') return r;
    const api = g.monaco;
    g.capy.group.visible = false;

    let hf = null, hb = null;
    for (const b of g.world.bodies) {
      for (const sh of b.shapes) if (sh instanceof CANNON.Heightfield) { hf = sh; hb = b; }
    }
    const NX = hf.data.length, NZ = hf.data[0].length;

    // THE GROUND SHEET BY IDENTITY, NOT BY "NEAREST SURFACE". b3-ground takes
    // the drawn surface closest to the law, and in a town that is a quay slab,
    // a kerb or a road as often as it is the hill. monBuildGround's plane has
    // exactly (NX) x (NZ) vertices, which nothing else in the chapter does.
    let sheet = null;
    g.scene.traverse((o) => {
      if (!o.isMesh || sheet) return;
      const pa = o.geometry && o.geometry.attributes && o.geometry.attributes.position;
      if (pa && pa.count === NX * NZ) sheet = o;
    });
    r.sheetFound = !!sheet;
    if (sheet) r.sheetVerts = sheet.geometry.attributes.position.count;

    function colliderY(x, z) {
      const i = (x - hb.position.x) / hf.elementSize;
      const j = (hb.position.z - z) / hf.elementSize;
      const i0 = Math.floor(i), j0 = Math.floor(j);
      if (i0 < 0 || j0 < 0 || i0 + 1 >= NX || j0 + 1 >= NZ) return NaN;
      const fx = i - i0, fz = j - j0;
      const h00 = hf.data[i0][j0], h10 = hf.data[i0 + 1][j0];
      const h01 = hf.data[i0][j0 + 1], h11 = hf.data[i0 + 1][j0 + 1];
      if (fx + fz < 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
      return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
    }

    const rc = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
    let n = 0, o15 = 0, o50 = 0, sum = 0, signed = 0;
    let wN = 0, w15 = 0, w50 = 0, wSum = 0;   // ...and the same on WALKABLE ground only
    let nAll = 0, a15 = 0, a50 = 0, sumAll = 0;
    const worst = [];
    for (let i = 0; i < 34; i++) {
      for (let k = 0; k < 34; k++) {
        const x = -150 + 300 * (i + 0.37) / 34, z = -170 + 300 * (k + 0.61) / 34;
        if (api.isOverWater(x, z)) continue;
        const law = api.terrainHeight(x, z);
        if (law !== law) continue;
        const col = colliderY(x, z);
        if (col !== col) continue;

        // (a) the collider against the GROUND SHEET alone
        if (sheet) {
          rc.set(new THREE.Vector3(x, law + 60, z), down); rc.far = 140;
          const h = rc.intersectObject(sheet, false)[0];
          if (h) {
            const e = h.point.y - col;
            n++; sum += Math.abs(e); signed += e;
            if (Math.abs(e) > 0.15) o15++;
            if (Math.abs(e) > 0.50) o50++;
            // block 4's band: 0.20..0.75 is 11 to 37 degrees. Above 0.75 the
            // animal cannot stand, so a collider that disagrees there is a
            // cliff face and not a floor.
            if (api.slopeAt(x, z) <= 0.75) {
              wN++; wSum += Math.abs(e);
              if (Math.abs(e) > 0.15) w15++;
              if (Math.abs(e) > 0.50) w50++;
            }
            if (Math.abs(e) > 0.5 && worst.length < 10) {
              worst.push({ at: [+x.toFixed(1), +z.toFixed(1)], col: +col.toFixed(2),
                           sheet: +h.point.y.toFixed(2), slope: +api.slopeAt(x, z).toFixed(2) });
            }
          }
        }
        // (b) the collider against whatever surface is nearest, which is what
        //     b3-ground measures
        rc.set(new THREE.Vector3(x, law + 60, z), down); rc.far = 140;
        const hits = rc.intersectObject(g.scene, true).filter(q => q.object.visible);
        let best = NaN, bd = 1e9;
        for (const q of hits) {
          const d = Math.abs(q.point.y - law);
          if (d < bd) { bd = d; best = q.point.y; }
        }
        if (best === best) {
          const e = Math.abs(best - col);
          nAll++; sumAll += e;
          if (e > 0.15) a15++;
          if (e > 0.50) a50++;
        }
      }
    }
    r.vsSheet = { n: n, mean: +(sum / Math.max(1, n)).toFixed(3),
                  signed: +(signed / Math.max(1, n)).toFixed(3),
                  p15: +(100 * o15 / Math.max(1, n)).toFixed(1),
                  p50: +(100 * o50 / Math.max(1, n)).toFixed(1) };
    r.walkable = { n: wN, mean: +(wSum / Math.max(1, wN)).toFixed(3),
                   p15: +(100 * w15 / Math.max(1, wN)).toFixed(1),
                   p50: +(100 * w50 / Math.max(1, wN)).toFixed(1) };
    r.vsNearest = { n: nAll, mean: +(sumAll / Math.max(1, nAll)).toFixed(3),
                    p15: +(100 * a15 / Math.max(1, nAll)).toFixed(1),
                    p50: +(100 * a50 / Math.max(1, nAll)).toFixed(1) };
    r.worst = worst;
    g.capy.group.visible = true;
    return r;
  });

  await page.evaluate(async (o) => {
    await fetch('/shot?name=b10-mon2.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
