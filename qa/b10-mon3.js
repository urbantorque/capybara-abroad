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
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
    const r = { live: g.biome.current };
    const api = g.monaco;

    let hf = null, hb = null;
    for (const b of g.world.bodies) {
      for (const sh of b.shapes) if (sh instanceof CANNON.Heightfield) { hf = sh; hb = b; }
    }
    const NX = hf.data.length, NZ = hf.data[0].length, EL = hf.elementSize;
    const X0 = hb.position.x, Z1 = hb.position.z;

    let sheet = null;
    g.scene.traverse((o) => {
      if (!o.isMesh || sheet) return;
      const pa = o.geometry && o.geometry.attributes && o.geometry.attributes.position;
      if (pa && pa.count === NX * NZ) sheet = o;
    });
    if (!sheet) { r.noSheet = true; return r; }
    const pos = sheet.geometry.attributes.position;

    // index the mesh's own vertices by their (x, z), so the comparison is
    // vertex-to-node and no raycast or interpolation is involved at all
    const key = (x, z) => Math.round(x * 4) + ',' + Math.round(z * 4);
    const vy = new Map();
    for (let i = 0; i < pos.count; i++) vy.set(key(pos.getX(i), pos.getZ(i)), pos.getY(i));
    r.verts = vy.size;
    const xs = [], zs = [];
    for (let i = 0; i < 6; i++) { xs.push(+pos.getX(i).toFixed(3)); zs.push(+pos.getZ(i * 200).toFixed(3)); }
    r.sampleX = xs; r.sampleZ = zs;
    let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9;
    for (let i = 0; i < pos.count; i++) {
      const X = pos.getX(i), Z = pos.getZ(i);
      if (X < mnx) mnx = X; if (X > mxx) mxx = X;
      if (Z < mnz) mnz = Z; if (Z > mxz) mxz = Z;
    }
    r.meshExtent = [+mnx.toFixed(2), +mxx.toFixed(2), +mnz.toFixed(2), +mxz.toFixed(2)];
    r.hfExtent = [X0, X0 + (NX - 1) * EL, Z1 - (NZ - 1) * EL, Z1];
    r.rootPos = [sheet.parent ? +sheet.parent.position.x.toFixed(2) : null,
                 sheet.parent ? +sheet.parent.position.z.toFixed(2) : null];

    // three readings at the SAME lattice node: the mesh vertex as built, the
    // heightfield datum as built, and the law as it answers now.
    let n = 0, mesh_vs_hf = 0, mesh_vs_law = 0, hf_vs_law = 0;
    let sm = 0, sl = 0, sh = 0;
    const rows = [];
    for (let i = 4; i < NX - 4; i += 3) {
      for (let j = 4; j < NZ - 4; j += 3) {
        const x = X0 + i * EL, z = Z1 - j * EL;
        if (api.isOverWater(x, z)) continue;
        const mv = vy.get(key(x, z));
        if (mv === undefined) continue;
        const hv = hf.data[i][j];
        const lv = api.terrainHeight(x, z);
        if (lv !== lv) continue;
        n++;
        const a = Math.abs(mv - hv), b = Math.abs(mv - lv), c = Math.abs(hv - lv);
        sm += a; sl += b; sh += c;
        if (a > 0.15) mesh_vs_hf++;
        if (b > 0.15) mesh_vs_law++;
        if (c > 0.15) hf_vs_law++;
        if (a > 0.5 && rows.length < 12) {
          rows.push({ at: [+x.toFixed(0), +z.toFixed(0)], mesh: +mv.toFixed(2),
                      hf: +hv.toFixed(2), law: +lv.toFixed(2) });
        }
      }
    }
    r.n = n;
    r.meshVsHf = { pct: +(100 * mesh_vs_hf / n).toFixed(1), mean: +(sm / n).toFixed(3) };
    r.meshVsLaw = { pct: +(100 * mesh_vs_law / n).toFixed(1), mean: +(sl / n).toFixed(3) };
    r.hfVsLaw = { pct: +(100 * hf_vs_law / n).toFixed(1), mean: +(sh / n).toFixed(3) };
    r.rows = rows;

    // is the law itself stable? ask the same point twenty times.
    const p = [-120.3, -5.8];
    const reps = [];
    for (let i = 0; i < 6; i++) { reps.push(+api.terrainHeight(p[0], p[1]).toFixed(4)); g.tick(1 / 60, false); }
    r.lawRepeat = reps;
    return r;
  });

  await page.evaluate(async (o) => {
    await fetch('/shot?name=b10-mon3.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
