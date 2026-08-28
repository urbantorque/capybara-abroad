async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);

  const src = await (await page.request.get('http://localhost:5188/src/shared.js')).text();
  const chapters = [];
  const re = /\{\s*n:\s*(\d+),\s*biome:\s*'([a-z]+)'/g;
  let m;
  while ((m = re.exec(src))) chapters.push(m[2]);

  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);
  const out = { started: await page.evaluate(() => !!window.__capy.state.started), rows: [] };

  for (let ci = 0; ci < chapters.length; ci++) {
    const name = chapters[ci];
    let row;
    try {
      row = await page.evaluate(async (arg) => {
        const g = window.__capy;
        const THREE = g.THREE, CANNON = g.CANNON;
        const nm = arg.name;
        if (g.biome.current !== nm) g.biome.switchTo(nm);
        for (let i = 0; i < 25; i++) g.tick(1 / 60, false);
        const api = (nm === 'sydney') ? g.env : g[nm];
        const sp = g.biome.spawnOf(nm);
        const th = (api && typeof api.terrainHeight === 'function')
          ? (x, z) => { const v = api.terrainHeight(x, z); return (v === v) ? v : 0; } : () => 0;
        const r = { biome: nm, live: g.biome.current };

        // ---------- 1. THE LOCALS: registered people, and whether solid ----
        // npc.js keeps them internally; the only public handle is the body it
        // adds, so count static bodies whose userData carries a local record.
        let nLocal = 0, nLocalBody = 0;
        for (const b of g.world.bodies) {
          if (b.userData && b.userData.local) {
            nLocalBody++;
            if (b.userData.local.biome === nm) nLocal++;
          }
        }
        r.localBodiesHere = nLocal;
        r.localBodiesTotal = nLocalBody;

        // ---------- 2. INSTANCED CROWDS: drawn people with no collider -----
        // Any InstancedMesh whose instances are roughly person-sized and whose
        // instance positions have no static body within 0.8 m.
        const rf = new CANNON.Vec3(), rt = new CANNON.Vec3();
        const res = new CANNON.RaycastResult();
        const mat = new THREE.Matrix4(), pos = new THREE.Vector3();
        const qq = new THREE.Quaternion(), ss = new THREE.Vector3();
        const crowds = [];
        g.scene.traverse((o) => {
          if (!o.isInstancedMesh || !o.visible) return;
          let p = o, vis = true;
          while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
          if (!vis) return;
          const nmL = (o.name || '').toLowerCase();
          const looksPeople = /people|crowd|commuter|figure|person|bather|dancer|walker|passenger|tourist|punter|villager|local/.test(nmL);
          if (!looksPeople) return;
          // sample up to 24 instances and see if anything solid is there
          let checked = 0, solid = 0;
          const step = Math.max(1, Math.floor(o.count / 24));
          for (let i = 0; i < o.count; i += step) {
            o.getMatrixAt(i, mat);
            mat.decompose(pos, qq, ss);
            o.localToWorld(pos);
            if (!(pos.x === pos.x)) continue;
            checked++;
            // a horizontal ray through where a chest would be
            res.reset();
            rf.set(pos.x - 1.2, pos.y + 0.9, pos.z);
            rt.set(pos.x + 1.2, pos.y + 0.9, pos.z);
            g.world.raycastClosest(rf, rt, { skipBackfaces: false }, res);
            if (res.hasHit) solid++;
          }
          if (checked) crowds.push({ name: o.name || '(unnamed)', count: o.count, checked, solid });
        });
        r.crowds = crowds;
        r.crowdTotal = crowds.reduce((a, c) => a + c.count, 0);
        r.crowdSolidPct = crowds.length
          ? +(100 * crowds.reduce((a, c) => a + c.solid, 0) / crowds.reduce((a, c) => a + c.checked, 0)).toFixed(0)
          : null;

        // ---------- 3. SCENERY DENSITY: how developed is each ring ---------
        // Distinct visible meshes whose bounding sphere overlaps a 20 m cell,
        // per ring of radius from the spawn. An empty ring is an empty field.
        const meshes = [];
        g.scene.traverse((o) => {
          if (!o.isMesh) return;
          let p = o, vis = true;
          while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
          if (!vis) return;
          if (!o.geometry) return;
          if (!o.geometry.boundingSphere) { try { o.geometry.computeBoundingSphere(); } catch (e) { return; } }
          meshes.push(o);
        });
        const rings = [];
        for (const R of [20, 45, 70, 95]) {
          let cells = 0, filled = 0;
          const step = 20;
          for (let a = 0; a < 6.283; a += step / R) {
            const x = sp.x + Math.cos(a) * R, z = sp.z + Math.sin(a) * R;
            cells++;
            // anything drawn, other than the ground itself, within 10 m?
            let hit = 0;
            const y0 = th(x, z);
            for (const o of meshes) {
              const bs = o.geometry.boundingSphere;
              if (!bs) continue;
              pos.copy(bs.center); o.localToWorld(pos);
              const rad = bs.radius * Math.max(o.scale.x, o.scale.y, o.scale.z);
              if (rad > 60) continue;                  // the terrain sheet / sky
              const d = Math.hypot(pos.x - x, pos.z - z);
              if (d < 10 + rad && pos.y > y0 - 4 && pos.y < y0 + 25) { hit++; if (hit >= 2) break; }
            }
            if (hit >= 2) filled++;
          }
          rings.push({ R, cells, filled, pct: cells ? Math.round(100 * filled / cells) : 0 });
        }
        r.rings = rings;
        return r;
      }, { name: name });
    } catch (e) {
      row = { biome: name, error: String(e).slice(0, 250) };
    }
    out.rows.push(row);
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=rev-people.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
