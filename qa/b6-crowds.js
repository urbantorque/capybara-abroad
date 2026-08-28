async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);

  const src = await (await page.request.get('http://localhost:5188/src/shared.js')).text();
  const chapters = [];
  const re = /\{\s*n:\s*(\d+),\s*biome:\s*'([a-z]+)'/g;
  let m;
  while ((m = re.exec(src))) chapters.push(m[2]);

  const out = { chapters: chapters, rows: [] };
  for (let ci = 0; ci < chapters.length; ci++) {
    let row;
    try {
      row = await page.evaluate(async (nm) => {
        const g = window.__capy, THREE = g.THREE, CANNON = g.CANNON;
        if (g.biome.current !== nm) g.biome.switchTo(nm);
        for (let i = 0; i < 25; i++) g.tick(1 / 60, false);
        const r = { biome: nm, live: g.biome.current, meshes: [] };
        if (g.biome.current !== nm) return r;
        const api = (nm === 'sydney') ? g.env : g[nm];
        const th = (x, z) => {
          if (!api || typeof api.terrainHeight !== 'function') return 0;
          const v = api.terrainHeight(x, z);
          return (typeof v === 'number' && v === v) ? v : 0;
        };

        const mat = new THREE.Matrix4(), pos = new THREE.Vector3();
        const qq = new THREE.Quaternion(), ss = new THREE.Vector3();
        const rf = new CANNON.Vec3(), rt = new CANNON.Vec3();
        const res = new CANNON.RaycastResult();

        // EVERY InstancedMesh, classified by what its instances MEASURE rather
        // than by what they are called. rev-people.js matches a name regex and
        // therefore finds Marrakech's sahPeople and nothing else in the game.
        g.scene.traverse((o) => {
          if (!o.isInstancedMesh) return;
          let p = o, vis = true;
          while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
          if (!vis) return;
          const gm = o.geometry;
          if (!gm) return;
          if (!gm.boundingBox) gm.computeBoundingBox();
          const bb = gm.boundingBox;
          const gw = bb.max.x - bb.min.x, gh = bb.max.y - bb.min.y, gd = bb.max.z - bb.min.z;
          o.updateWorldMatrix(true, false);
          const ws = new THREE.Vector3();
          o.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), ws);

          // measure the instances: median world size, and how far above the
          // terrain the instance origin sits
          const W = [], H = [], D = [], A = [];
          let checked = 0, solid = 0, offGround = 0;
          const step = Math.max(1, Math.floor(o.count / 30));
          for (let i = 0; i < o.count; i += step) {
            o.getMatrixAt(i, mat);
            mat.decompose(pos, qq, ss);
            const w = gw * Math.abs(ss.x) * Math.abs(ws.x);
            const h = gh * Math.abs(ss.y) * Math.abs(ws.y);
            const d = gd * Math.abs(ss.z) * Math.abs(ws.z);
            o.localToWorld(pos);
            if (!(pos.x === pos.x) || !(pos.y === pos.y)) continue;
            W.push(w); H.push(h); D.push(d);
            const above = pos.y - th(pos.x, pos.z);
            A.push(above);
            if (above > 3.0 || above < -1.5) offGround++;
            checked++;
            res.reset();
            rf.set(pos.x - 1.2, pos.y + Math.max(0.5, h * 0.5), pos.z);
            rt.set(pos.x + 1.2, pos.y + Math.max(0.5, h * 0.5), pos.z);
            g.world.raycastClosest(rf, rt, { skipBackfaces: false }, res);
            if (res.hasHit) solid++;
          }
          if (!checked) return;
          const med = (a) => { a = a.slice().sort((x, y) => x - y); return a[a.length >> 1]; };
          const mw = med(W), mh = med(H), md = med(D), ma = med(A);
          // person-shaped: taller than wide, roughly a metre and a half, and
          // standing on the ground rather than hanging in the air
          const person = mh >= 0.9 && mh <= 2.6 && mw >= 0.15 && mw <= 1.3 &&
                         md >= 0.10 && md <= 1.3 && mh > mw * 1.4 &&
                         ma > -1.2 && ma < 2.5 && offGround < checked * 0.5;
          r.meshes.push({
            name: o.name || '(unnamed)', count: o.count, checked: checked,
            w: +mw.toFixed(2), h: +mh.toFixed(2), d: +md.toFixed(2),
            above: +ma.toFixed(2), person: person,
            solid: solid, solidPct: +(100 * solid / checked).toFixed(0),
          });
        });
        r.people = r.meshes.filter(x => x.person);
        r.peopleCount = r.people.reduce((a, x) => a + x.count, 0);
        const ck = r.people.reduce((a, x) => a + x.checked, 0);
        const sd = r.people.reduce((a, x) => a + x.solid, 0);
        r.peopleSolidPct = ck ? +(100 * sd / ck).toFixed(0) : null;
        return r;
      }, chapters[ci]);
    } catch (e) { row = { biome: chapters[ci], error: String(e).slice(0, 250) }; }
    out.rows.push(row);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b6-crowds.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
