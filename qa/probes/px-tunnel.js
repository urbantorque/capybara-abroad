async page => {
  await page.goto('http://localhost:5188/index.html');
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);
  const names = ['sydney', 'quay', 'venice', 'kowloon', 'hanoi', 'kyoto'];
  const out = {};
  for (const n of names) {
    out[n] = await page.evaluate(async (name) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
      const g = window.__capy; const C = g.CANNON;
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name), cb = g.capy.body;
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0);
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
      await sleep(2500);
      const api = g.biome.current === 'sydney' ? g.env : g[g.biome.current];
      const gy = (x, z) => { const h = api && api.terrainHeight ? api.terrainHeight(x, z) : 0; return (typeof h === 'number' && h === h) ? h : 0; };
      // walls: static box shapes within 40 m of spawn, tall (>= 1.5 m) and at least 0.15 m thick
      const mn = new C.Vec3(), mx = new C.Vec3(), wp = new C.Vec3(), wq = new C.Quaternion();
      const walls = [];
      for (const bd of g.world.bodies) {
        if (bd.mass !== 0 || bd.type !== C.Body.STATIC) continue;
        if (bd.userData && (bd.userData.npc || bd.userData.local)) continue;
        for (let i = 0; i < bd.shapes.length; i++) {
          const sh = bd.shapes[i]; if (!sh.halfExtents) continue; const h = sh.halfExtents;
          if (h.y < 0.75 || h.x > 40 || h.z > 40) continue;
          bd.quaternion.vmult(bd.shapeOffsets[i], wp); wp.vadd(bd.position, wp);
          if (Math.hypot(wp.x - sp.x, wp.z - sp.z) > 40) continue;
          bd.quaternion.mult(bd.shapeOrientations[i], wq);
          sh.calculateWorldAABB(wp, wq, mn, mx);
          const thick = Math.min(mx.x - mn.x, mx.z - mn.z);
          if (thick < 0.15) continue;
          walls.push({ id: bd.id + '/' + i, lo: [mn.x, mn.y, mn.z], hi: [mx.x, mx.y, mx.z], cx: wp.x, cz: wp.z, thick: +thick.toFixed(2), d: Math.hypot(wp.x - sp.x, wp.z - sp.z) });
        }
      }
      walls.sort((a, b) => a.thick - b.thick);            // thinnest first: the hard cases
      const pick = walls.slice(0, 5).concat(walls.slice(-2));
      const results = [];
      const types = ['hat', 'deckchair', 'winebottle'];
      for (const w of pick) {
        // approach along the thinner plan axis from the spawn side
        const alongX = (w.hi[0] - w.lo[0]) < (w.hi[2] - w.lo[2]);
        const side = alongX ? (sp.x < w.cx ? -1 : 1) : (sp.z < w.cz ? -1 : 1);
        for (const type of types) for (const speed of [8, 14, 22]) {
          const sx = alongX ? (side < 0 ? w.lo[0] - 3 : w.hi[0] + 3) : w.cx;
          const sz = alongX ? w.cz : (side < 0 ? w.lo[2] - 3 : w.hi[2] + 3);
          const sy = Math.min(Math.max(gy(sx, sz) + 0.6, w.lo[1] + 0.4), w.hi[1] - 0.3);
          let p = null; try { p = g.physics.spawnProp(type, sx, sz, sy - 0.3); } catch (e) { results.push({ err: String(e).slice(0, 120) }); continue; }
          if (!p || !p.body) { results.push({ type, err: 'no prop' }); continue; }
          const b = p.body;
          b.position.set(sx, sy, sz); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
          b.velocity.set(alongX ? -side * speed : 0, 0, alongX ? 0 : -side * speed); b.angularVelocity.set(0, 0, 0); b.wakeUp();
          let inside = 0, maxPen = 0;
          for (let f = 0; f < 50; f++) {
            g.tick(1 / 60, false);
            const q = b.position;
            if (q.x > w.lo[0] + 0.02 && q.x < w.hi[0] - 0.02 && q.z > w.lo[2] + 0.02 && q.z < w.hi[2] - 0.02 && q.y > w.lo[1] && q.y < w.hi[1]) {
              inside++;
              const pen = alongX ? Math.min(q.x - w.lo[0], w.hi[0] - q.x) : Math.min(q.z - w.lo[2], w.hi[2] - q.z);
              if (pen > maxPen) maxPen = pen;
            }
          }
          const q = b.position;
          const beyond = alongX ? (side < 0 ? q.x > w.hi[0] : q.x < w.lo[0]) : (side < 0 ? q.z > w.hi[2] : q.z < w.lo[2]);
          const stillInside = q.x > w.lo[0] && q.x < w.hi[0] && q.z > w.lo[2] && q.z < w.hi[2] && q.y > w.lo[1] && q.y < w.hi[1];
          results.push({ wall: w.id, thick: w.thick, type, speed, insideFrames: inside, maxPen: +maxPen.toFixed(2), beyond, stillInside, endY: +(q.y - gy(q.x, q.z)).toFixed(2) });
          try { g.physics.removeProp(p); } catch (e) { try { g.physics.rescue(p); } catch (e2) {} }
        }
      }
      const tunnel = results.filter(r => r.beyond || r.stillInside);
      return { walls: walls.length, tested: results.length, tunnelled: tunnel.length, tunnel, thinnest: walls.slice(0, 3).map(w => w.thick), errs: results.filter(r => r.err).slice(0, 3), lastError: g.state.lastError || null };
    }, n);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=px-body-tunnel.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
