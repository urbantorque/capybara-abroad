async page => {
  await page.goto('http://localhost:5188/index.html');
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);
  const names = ['sydney', 'pasto', 'quay', 'kyoto', 'venice', 'hanoi'];
  const out = {};
  for (const n of names) {
    const targets = await page.evaluate((name) => {
      const g = window.__capy;
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name), cb = g.capy.body;
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0);
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
      const list = [];
      for (const bd of g.world.bodies) {
        const u = bd.userData; if (!u || !(u.npc || u.local)) continue;
        const rec = u.npc || u.local; const isLocal = !!u.local;
        const px = isLocal ? rec.x : rec.group.position.x, pz = isLocal ? rec.z : rec.group.position.z;
        list.push({ id: bd.id, isLocal, d: Math.hypot(px - sp.x, pz - sp.z) });
      }
      list.sort((a, b) => a.d - b.d);
      // two nearest locals + two nearest walkers where they exist
      const loc = list.filter(t => t.isLocal).slice(0, 2), wal = list.filter(t => !t.isLocal).slice(0, 2);
      return loc.concat(wal).map(t => t.id);
    }, n);
    await page.waitForTimeout(2500);
    out[n] = [];
    for (const id of targets) {
      // 1. park the animal 3.5 m east of the target, let the camera settle
      const ok = await page.evaluate((id) => {
        const g = window.__capy; const bd = g.world.bodies.find(b => b.id === id); if (!bd) return false;
        const rec = bd.userData.npc || bd.userData.local; const isLocal = !!bd.userData.local;
        const px = isLocal ? rec.x : rec.group.position.x, py = isLocal ? rec.y : rec.group.position.y, pz = isLocal ? rec.z : rec.group.position.z;
        const cb = g.capy.body;
        cb.position.set(px + 3.5, py + 0.9, pz); cb.velocity.set(0, 0, 0);
        cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
        return true;
      }, id);
      if (!ok) continue;
      await page.waitForTimeout(1500);
      // 2. re-place on the camera line so W walks straight at the figure
      await page.evaluate((id) => {
        const g = window.__capy; const bd = g.world.bodies.find(b => b.id === id);
        const rec = bd.userData.npc || bd.userData.local; const isLocal = !!bd.userData.local;
        const px = isLocal ? rec.x : rec.group.position.x, py = isLocal ? rec.y : rec.group.position.y, pz = isLocal ? rec.z : rec.group.position.z;
        const yaw = g.input.camYaw;
        const cb = g.capy.body;
        cb.position.set(px + Math.sin(yaw) * 3.5, py + 0.9, pz + Math.cos(yaw) * 3.5); cb.velocity.set(0, 0, 0);
        cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
        window.__wk = { id, yaw, sx: cb.position.x, sz: cb.position.z, n0: [px, py, pz], b0: [bd.position.x, bd.position.y, bd.position.z], rows: [], minD: 1e9, maxProj: -1e9, maxSpd: 0, shove: 0 };
        const rec2 = rec;
        window.__wkTimer = setInterval(() => {
          const W = window.__wk; const g = window.__capy; const bd = g.world.bodies.find(b => b.id === W.id); if (!bd) return;
          const rec = bd.userData.npc || bd.userData.local; const isLocal = !!bd.userData.local;
          const nx = isLocal ? rec.x : rec.group.position.x, nz = isLocal ? rec.z : rec.group.position.z;
          const ax = g.capy.position.x, az = g.capy.position.z;
          const d = Math.hypot(ax - nx, az - nz);
          // progress along the walk line, measured from the figure: negative = before it, positive = past it
          const ux = -Math.sin(W.yaw), uz = -Math.cos(W.yaw);
          const proj = (ax - nx) * ux + (az - nz) * uz;
          const side = Math.abs((ax - nx) * uz - (az - nz) * ux);
          const spd = Math.hypot(g.capy.body.velocity.x, g.capy.body.velocity.z);
          if (d < W.minD) W.minD = d; if (proj > W.maxProj) W.maxProj = proj; if (spd > W.maxSpd) W.maxSpd = spd;
          if (side > W.shove) W.shove = side;
          W.rows.push([+d.toFixed(2), +proj.toFixed(2), +side.toFixed(2), +spd.toFixed(2), +Math.hypot(nx - W.n0[0], nz - W.n0[2]).toFixed(2), rec.state || (rec.own ? 'own' : '')]);
        }, 100);
      }, id);
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(2600);
      await page.keyboard.up('KeyW');
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => {
        clearInterval(window.__wkTimer);
        const W = window.__wk; const g = window.__capy; const bd = g.world.bodies.find(b => b.id === W.id);
        const rec = bd.userData.npc || bd.userData.local; const isLocal = !!bd.userData.local;
        const nx = isLocal ? rec.x : rec.group.position.x, nz = isLocal ? rec.z : rec.group.position.z;
        const last = W.rows[W.rows.length - 1];
        return { id: W.id, kind: (isLocal ? 'local:' : 'npc:') + (rec.kind || rec.name || ''), bodyType: bd.type, collisionResponse: bd.collisionResponse,
                 minD: +W.minD.toFixed(2), maxProj: +W.maxProj.toFixed(2), shoveSide: +W.shove.toFixed(2), maxSpd: +W.maxSpd.toFixed(2),
                 npcFigMoved: +Math.hypot(nx - W.n0[0], nz - W.n0[2]).toFixed(2), npcBodyMoved: +Math.hypot(bd.position.x - W.b0[0], bd.position.z - W.b0[2]).toFixed(2),
                 finalD: last ? last[0] : null, finalProj: last ? last[1] : null, states: [...new Set(W.rows.map(r => r[5]))],
                 passedThrough: W.maxProj > 0.6 && W.minD < 0.45, barges: g.state.bargeCount || null, rows: W.rows.filter((_, i) => i % 5 === 0) };
      });
      out[n].push(r);
    }
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=px-body-walk.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
