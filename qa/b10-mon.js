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
    g.capy.group.visible = false;                       // trap 11

    // find the heightfield body and its transform
    let hf = null, hb = null;
    for (const b of g.world.bodies) {
      for (const sh of b.shapes) if (sh instanceof CANNON.Heightfield) { hf = sh; hb = b; }
    }
    if (!hf) { r.noHf = true; return r; }
    r.el = hf.elementSize;
    r.nx = hf.data.length; r.nz = hf.data[0].length;
    r.origin = [+hb.position.x.toFixed(1), +hb.position.y.toFixed(1), +hb.position.z.toFixed(1)];

    // the collider's own surface at a world point, read through cannon's data
    // exactly as the solver does: local x runs +X from the body origin, local y
    // runs -Z, and the body is rotated -90 about X.
    function colliderY(x, z) {
      const i = (x - hb.position.x) / hf.elementSize;
      const j = (hb.position.z - z) / hf.elementSize;
      const i0 = Math.floor(i), j0 = Math.floor(j);
      if (i0 < 0 || j0 < 0 || i0 + 1 >= r.nx || j0 + 1 >= r.nz) return NaN;
      const fx = i - i0, fz = j - j0;
      const h00 = hf.data[i0][j0], h10 = hf.data[i0 + 1][j0];
      const h01 = hf.data[i0][j0 + 1], h11 = hf.data[i0 + 1][j0 + 1];
      // cannon splits each cell on the fx + fz = 1 diagonal
      if (fx + fz < 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
      return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
    }

    const rc = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
    function drawnY(x, z) {
      const h = api.terrainHeight(x, z);
      if (h !== h) return NaN;
      rc.set(new THREE.Vector3(x, h + 45, z), down); rc.far = 120;
      const hits = rc.intersectObject(g.scene, true).filter(q => q.object.visible);
      // the ground sheet is the surface nearest the law, from below or above
      let best = NaN, bd = 1e9;
      for (const q of hits) {
        const d = Math.abs(q.point.y - h);
        if (d < bd) { bd = d; best = q.point.y; }
      }
      return best;
    }

    // ---- WHERE DOES THE 17.2% COME FROM? --------------------------------
    // Three surfaces at every sample: the analytic LAW, the COLLIDER's
    // piecewise-linear reading of it, and the DRAWN mesh. If law == collider
    // but neither matches the mesh, the two lattices are triangulated on
    // opposite diagonals and no amount of matching element size fixes it.
    const rows = [];
    let n = 0, lawVsCol = 0, lawVsDrawn = 0, colVsDrawn = 0;
    let mLC = 0, mLD = 0, mCD = 0;
    const byFrac = [0, 0, 0, 0];         // error binned by distance to cell centre
    const byFracN = [0, 0, 0, 0];
    for (let i = 0; i < 26; i++) {
      for (let k = 0; k < 26; k++) {
        const x = -150 + 300 * (i + 0.37) / 26, z = -170 + 300 * (k + 0.61) / 26;
        if (api.isOverWater(x, z)) continue;
        const law = api.terrainHeight(x, z);
        if (law !== law) continue;
        const col = colliderY(x, z);
        const dr = drawnY(x, z);
        if (col !== col || dr !== dr) continue;
        n++;
        const eLC = Math.abs(law - col), eLD = Math.abs(law - dr), eCD = Math.abs(col - dr);
        mLC += eLC; mLD += eLD; mCD += eCD;
        if (eLC > 0.15) lawVsCol++;
        if (eLD > 0.15) lawVsDrawn++;
        if (eCD > 0.15) colVsDrawn++;
        // how far into its cell is this sample?
        const fi = ((x - hb.position.x) / hf.elementSize) % 1;
        const fj = ((hb.position.z - z) / hf.elementSize) % 1;
        const d = Math.abs(fi + fj - 1);         // 0 on cannon's diagonal
        const bin = Math.min(3, Math.floor(d * 4));
        byFrac[bin] += eCD; byFracN[bin]++;
        if (eCD > 0.5 && rows.length < 14) {
          rows.push({ at: [+x.toFixed(1), +z.toFixed(1)], law: +law.toFixed(2),
                      col: +col.toFixed(2), drawn: +dr.toFixed(2),
                      slope: +api.slopeAt(x, z).toFixed(2) });
        }
      }
    }
    r.n = n;
    r.lawVsCol = { pct: +(100 * lawVsCol / n).toFixed(1), mean: +(mLC / n).toFixed(3) };
    r.lawVsDrawn = { pct: +(100 * lawVsDrawn / n).toFixed(1), mean: +(mLD / n).toFixed(3) };
    r.colVsDrawn = { pct: +(100 * colVsDrawn / n).toFixed(1), mean: +(mCD / n).toFixed(3) };
    r.byDistFromDiagonal = byFrac.map((v, i) => byFracN[i] ? +(v / byFracN[i]).toFixed(3) : null);
    r.worst = rows;
    g.capy.group.visible = true;
    return r;
  });

  await page.evaluate(async (o) => {
    await fetch('/shot?name=b10-mon.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
