async page => {
  await page.goto('http://localhost:5188/index.html');
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);
  const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi'];
  const out = {};
  for (const n of names) {
    await page.evaluate((name) => {
      const g = window.__capy;
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name), cb = g.capy.body;
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0);
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
    }, n);
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
      const g = window.__capy; const C = g.CANNON;
      const mn = new C.Vec3(), mx = new C.Vec3(), wp = new C.Vec3(), wq = new C.Quaternion();
      // static box AABBs, once
      const st = [];
      for (const bd of g.world.bodies) {
        if (bd.mass !== 0 || bd.type !== C.Body.STATIC) continue;
        if (bd.userData && (bd.userData.npc || bd.userData.local)) continue;
        for (let i = 0; i < bd.shapes.length; i++) {
          const sh = bd.shapes[i]; if (!sh.halfExtents) continue;
          const h = sh.halfExtents; if (h.x > 60 || h.z > 60) continue;           // ground slabs
          if (h.y < 0.12 && h.x * h.z > 30) continue;                             // thin floor sheets are decks, not walls
          bd.quaternion.vmult(bd.shapeOffsets[i], wp); wp.vadd(bd.position, wp);
          bd.quaternion.mult(bd.shapeOrientations[i], wq);
          sh.calculateWorldAABB(wp, wq, mn, mx);
          st.push([mn.x, mn.y, mn.z, mx.x, mx.y, mx.z, bd.id, i]);
        }
      }
      const kin = [];
      for (const bd of g.world.bodies) {
        if (bd.type !== C.Body.KINEMATIC || bd.collisionResponse === false) continue;
        if (bd.userData && (bd.userData.npc || bd.userData.local)) continue;
        kin.push(bd);
      }
      window.__ct = { st: st.length, kin: kin.length, worst: {}, samples: 0 };
      const M = 0.12;
      window.__ctTimer = setInterval(() => {
        const S = window.__ct; S.samples++;
        for (const bd of kin) {
          const v = Math.hypot(bd.velocity.x, bd.velocity.y, bd.velocity.z);
          for (let i = 0; i < bd.shapes.length; i++) {
            const sh = bd.shapes[i];
            bd.quaternion.vmult(bd.shapeOffsets[i], wp); wp.vadd(bd.position, wp);
            bd.quaternion.mult(bd.shapeOrientations[i], wq);
            sh.calculateWorldAABB(wp, wq, mn, mx);
            for (const s of st) {
              const ox = Math.min(mx.x, s[3]) - Math.max(mn.x, s[0]);
              if (ox <= M) continue;
              const oy = Math.min(mx.y, s[4]) - Math.max(mn.y, s[1]);
              if (oy <= M) continue;
              const oz = Math.min(mx.z, s[5]) - Math.max(mn.z, s[2]);
              if (oz <= M) continue;
              const pen = Math.min(ox, oy, oz);
              const key = bd.id + '/' + i + ' vs ' + s[6] + '/' + s[7];
              const w = S.worst[key];
              if (!w) S.worst[key] = { pen: +pen.toFixed(2), n: 1, at: [+bd.position.x.toFixed(1), +bd.position.y.toFixed(1), +bd.position.z.toFixed(1)], v: +v.toFixed(1), kshapes: bd.shapes.length, ov: [+ox.toFixed(2), +oy.toFixed(2), +oz.toFixed(2)], moving: v > 0.05 };
              else { w.n++; if (pen > w.pen) { w.pen = +pen.toFixed(2); w.at = [+bd.position.x.toFixed(1), +bd.position.y.toFixed(1), +bd.position.z.toFixed(1)]; w.v = +v.toFixed(1); w.ov = [+ox.toFixed(2), +oy.toFixed(2), +oz.toFixed(2)]; } if (v > 0.05) w.moving = true; }
            }
          }
        }
      }, 100);
    });
    for (let i = 0; i < 4; i++) await page.evaluate(() => new Promise(r => setTimeout(r, 6000)));
    out[n] = await page.evaluate(() => {
      clearInterval(window.__ctTimer);
      const S = window.__ct;
      const rows = Object.entries(S.worst).map(([k, v]) => Object.assign({ key: k }, v)).sort((a, b) => b.pen - a.pen);
      return { staticShapes: S.st, kinematic: S.kin, samples: S.samples, hits: rows.length, top: rows.slice(0, 8) };
    });
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=px-body-cthru.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
