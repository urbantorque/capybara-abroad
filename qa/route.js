async page => {
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);
  const out = {};
  // ---- THE CHAPTER LIST IS DERIVED, NEVER SPELLED -------------------------
  // This probe carried a hard-coded list of EIGHT for the whole of the Payoff
  // Pass, in the one audit that measures scenery density — so the eleven
  // chapters it did not name were the eleven nothing measured, and it printed a
  // confident table every time. The same defect qa/channels.mjs was fixed for.
  //
  // `run-code` has no require and no import, so the derivation happens IN THE
  // PAGE: index.html serves src/shared.js unbundled and CHAPTERS is the one
  // table. It THROWS on a miss rather than falling back to a spelled list — a
  // silent fallback is how a stale audit stops failing and starts inventing.
  const NAMES = await page.evaluate(async () => {
    const src = await (await fetch('/src/shared.js', { cache: 'no-store' })).text();
    const i = src.indexOf('export const CHAPTERS = [');
    if (i < 0) throw new Error('route: CHAPTERS not found in src/shared.js — this audit has gone stale');
    const j = src.indexOf('\n];', i);
    if (j < 0) throw new Error('route: CHAPTERS has no end — this audit has gone stale');
    const keys = [];
    for (const m of src.slice(i, j).matchAll(/\bbiome:\s*'([a-z]+)'/g)) keys.push(m[1]);
    if (keys.length < 2) throw new Error('route: derived ' + keys.length + ' chapters — the parse is wrong');
    // ...and every derived key must be a place this build actually has, or the
    // table is a list of names rather than a list of chapters. Asked of the
    // spawn TABLE and not of spawnOf(), which falls back to Sydney for an
    // unknown name and can therefore never say no.
    const g = window.__capy;
    for (const k of keys) {
      if (!g.biome[k.toUpperCase() + '_SPAWN']) throw new Error('route: no spawn for "' + k + '"');
    }
    return keys;
  });
  out._chapters = NAMES.length;
  for (const name of NAMES) {
    out[name] = await page.evaluate(async (n) => {
      const g = window.__capy, THREE = g.THREE;
      g.biome.switchTo(n);
      for (let i = 0; i < 120; i++) g.tick(1/60, false);
      // every drawn thing with a world position, ground plates excluded
      const items = [];
      const box = new THREE.Box3(), v = new THREE.Vector3(), sz = new THREE.Vector3();
      g.scene.traverse(o => {
        if (!(o.isMesh || o.isInstancedMesh)) return;
        for (let p = o; p; p = p.parent) if (!p.visible) return;
        if (g.capy && o === g.capy.group) return;
        try {
          // AN INSTANCED MESH IS N THINGS IN N PLACES, not one thing at the
          // centre of their bounding box. The first version of this probe took
          // the box centre, so every scattered lamp, palm, bollard and tree in
          // the game -- which is most of the dressing in every chapter -- was
          // counted as ONE object somewhere in the middle of the chapter and
          // was invisible everywhere else. It reported 48 dead cells in Monte
          // Carlo, and adding fifteen lamps along the exact line it complained
          // about moved the number UP to 53.
          if (o.isInstancedMesh) {
            const m = new THREE.Matrix4();
            for (let i = 0; i < o.count; i++) {
              o.getMatrixAt(i, m);
              v.setFromMatrixPosition(m);
              o.localToWorld(v);
              items.push({ x: v.x, z: v.z, inst: 1 });
            }
            return;
          }
          box.setFromObject(o); box.getSize(sz); box.getCenter(v);
          const r = Math.max(sz.x, sz.z) * 0.5;
          if (r > 90) return;                    // ground, sea, sky dome
          if (sz.y < 0.02 && r > 40) return;
          items.push({ x: v.x, z: v.z, inst: 1 });
        } catch (e) {}
      });
      // walk the main route: spawn -> each landmark the chapter publishes
      // SYDNEY'S API IS `game.env`, not `game.sydney` — the same resolution
      // sysLiveBiomeApi does. With a spelled list of eight this never came up;
      // with a derived nineteen it is chapter one, and a probe that throws on
      // its first chapter measures nothing at all.
      const a = (n === 'sydney' ? g.env : g[n]) || {};
      const marks = [];
      for (const k of Object.keys(a)) {
        const val = a[k];
        if (val && typeof val === 'object' && typeof val.x === 'number' && typeof val.z === 'number'
            && !Array.isArray(val)) marks.push({ k, x: val.x, z: val.z });
      }
      const sp = g.biome.spawnOf(n);
      // 20 m cells along each spawn->landmark leg; count drawn things within 12 m
      const dead = [];
      for (const m of marks) {
        const dx = m.x - sp.x, dz = m.z - sp.z;
        const L = Math.hypot(dx, dz);
        if (L < 25) continue;
        const steps = Math.floor(L / 20);
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          const px = sp.x + dx * t, pz = sp.z + dz * t;
          // A CELL OVER WATER OR INSIDE A BUILDING IS NOT A DEAD CELL.
          // The first version of this counted both and reported 74 dead cells
          // in Monte Carlo -- most of them the harbour, which is empty because
          // it is a harbour. A detector that cannot tell "nothing here" from
          // "nothing can be here" is a cry-wolf detector.
          if (a.isOverWater && a.isOverWater(px, pz)) continue;
          if (a.navBlocked && a.navBlocked(px, pz, 0.6)) continue;
          let near = 0;
          for (const it of items) {
            const ex = it.x - px, ez = it.z - pz;
            if (ex*ex + ez*ez < 144) near += it.inst;
          }
          if (near === 0) dead.push({ leg: m.k, x: +px.toFixed(0), z: +pz.toFixed(0) });
        }
      }
      return { drawnObjects: items.length, landmarks: marks.length,
               deadCells: dead.length, dead: dead.slice(0, 12) };
    }, name);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=co-route.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
