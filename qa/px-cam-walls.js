async page => {
  const TARGETS = [['Minus', 'kowloon'], ['Digit0', 'venice'], ['Quote', 'cave'],
                   ['Period', 'monaco'], ['Slash', 'hanoi'], ['Digit4', 'kyoto']];
  const rows = [];
  for (const [key, name] of TARGETS) {
    await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(4200);
    await page.keyboard.press(key);
    await page.waitForTimeout(5200);
    await page.evaluate(() => {
      const g = window.__capy, T = g.THREE;
      const rc = new T.Raycaster();
      const dir = new T.Vector3(), from = new T.Vector3(), n = new T.Vector3();
      const vis = (o) => { while (o) { if (o.visible === false) return false; o = o.parent; } return true; };
      const first = (hits, d) => {
        for (const h of hits) {
          const o = h.object;
          if (!o.isMesh && !o.isInstancedMesh) continue;
          if (!vis(o)) continue;
          const m = Array.isArray(o.material) ? o.material[0] : o.material;
          if (!m || (m.transparent && m.opacity < 0.35)) continue;
          if (m.depthWrite === false) continue;
          let back = null;
          if (h.face) { n.copy(h.face.normal).transformDirection(o.matrixWorld); back = n.dot(d) > 0; }
          return { d: +h.distance.toFixed(2), name: o.name || m.name || o.type, side: m.side, back };
        }
        return null;
      };
      window.__pw = { biome: g.biome.current, n: 0, occ: 0, inside: 0, cutFrames: 0, worstClear: 1,
                      minDist: 99, who: {}, lastClass: 'clear', inst: [] };
      window.__pwT = setInterval(() => {
        const s = window.__pw, c = g.capy, cam = g.camera.position, p = c.position;
        s.n++;
        const clear = g.camInfo.clear;
        if (clear < 0.999) s.cutFrames++;
        if (clear < s.worstClear) s.worstClear = clear;
        const tx = p.x, ty = p.y + 0.55, tz = p.z;
        const dx = tx - cam.x, dy = ty - cam.y, dz = tz - cam.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < s.minDist) s.minDist = dist;
        dir.set(dx / dist, dy / dist, dz / dist);
        from.copy(cam);
        rc.set(from, dir); rc.near = 0.01; rc.far = Math.max(0.1, dist - 0.85);
        const fwd = first(rc.intersectObjects(g.scene.children, true), dir);
        dir.multiplyScalar(-1);
        from.set(tx, ty, tz);
        rc.set(from, dir); rc.near = 0.85; rc.far = Math.max(0.1, dist - 0.05);
        const rev = first(rc.intersectObjects(g.scene.children, true), dir);
        let cls = 'clear';
        if (fwd) { cls = 'occ'; s.occ++; }
        else if (rev) { cls = 'inside'; s.inside++; }
        if (fwd || rev) {
          const w = (fwd || rev).name;
          s.who[w] = (s.who[w] || 0) + 1;
        }
        s.lastClass = cls;
        if (s.inst.length < 6 && cls !== 'clear' && s.n % 3 === 0) {
          s.inst.push({ cls, clear: +clear.toFixed(2), dist: +dist.toFixed(2),
                        camY: +cam.y.toFixed(1), capY: +p.y.toFixed(1),
                        fwd, rev, at: [+p.x.toFixed(1), +p.z.toFixed(1)] });
        }
      }, 150);
    });
    const legs = [['KeyW'], ['KeyD'], ['KeyS'], ['KeyA'], ['KeyW', 'KeyD'], ['KeyS', 'KeyA']];
    const row = { biome: name, legs: [] };
    let shots = 0;
    for (let i = 0; i < legs.length; i++) {
      await page.evaluate(() => { const s = window.__pw; s.n = 0; s.occ = 0; s.inside = 0; s.cutFrames = 0; s.worstClear = 1; s.minDist = 99; s.who = {}; s.inst = []; });
      for (const k of legs[i]) await page.keyboard.down(k);
      await page.waitForTimeout(2600);
      const r = await page.evaluate(() => {
        const s = window.__pw, g = window.__capy;
        return { biome: g.biome.current, n: s.n, occ: s.occ, inside: s.inside, cut: s.cutFrames,
                 worst: +s.worstClear.toFixed(2), minDist: +s.minDist.toFixed(2), who: s.who,
                 last: s.lastClass, inst: s.inst.slice(0, 3), err: g.state.lastError || null };
      });
      r.leg = legs[i].join('+');
      if ((r.inside > 0 || r.worst < 0.5 || r.occ > r.n * 0.3) && shots < 2) {
        const fn = 'qa/px-cam-wall-' + name + '-' + r.leg.replace('+', '') + '.png';
        await page.screenshot({ path: fn });
        r.shot = fn; shots++;
      }
      for (const k of legs[i]) await page.keyboard.up(k);
      await page.waitForTimeout(500);
      row.legs.push(r);
    }
    await page.evaluate(() => clearInterval(window.__pwT));
    rows.push(row);
  }
  await page.evaluate(o => fetch('/shot?name=px-walls.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), rows);
}
