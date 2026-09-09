async page => {
  await page.goto('http://localhost:5188/index.html');
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);
  const names = ['sydney', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'venice', 'kowloon', 'palawan', 'goreme',
                 'manly', 'pantanal', 'antarctic', 'monaco', 'hanoi'];
  const out = {};
  for (const n of names) {
    await page.evaluate((name) => {
      const g = window.__capy;
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name), cb = g.capy.body;
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0);
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
    }, n);
    await page.waitForTimeout(3500);
    out[n] = await page.evaluate(() => {
      const g = window.__capy;
      const C = g.CANNON;
      const api = g.biome.current === 'sydney' ? g.env : g[g.biome.current];
      const gy = (x, z) => { const h = api && api.terrainHeight ? api.terrainHeight(x, z) : NaN; return (typeof h === 'number' && h === h) ? h : NaN; };
      const wet = (x, z) => { try { return !!(api && api.isOverWater && api.isOverWater(x, z)); } catch (e) { return false; } };
      const tmpV = new C.Vec3(), tmpL = new C.Vec3(), tmpQ = new C.Quaternion(), tmpQi = new C.Quaternion(), tmpP = new C.Vec3();
      function insideStatic(px, py, pz, self) {
        const hits = [];
        for (const bd of g.world.bodies) {
          if (bd === self || bd.mass !== 0 || bd.type !== C.Body.STATIC) continue;
          if (bd.userData && (bd.userData.npc || bd.userData.local)) continue;
          if (bd.aabbNeedsUpdate) bd.computeAABB();
          const a = bd.aabb;
          if (px < a.lowerBound.x || px > a.upperBound.x || py < a.lowerBound.y || py > a.upperBound.y || pz < a.lowerBound.z || pz > a.upperBound.z) continue;
          for (let i = 0; i < bd.shapes.length; i++) {
            const sh = bd.shapes[i];
            if (!sh.halfExtents) continue;
            bd.quaternion.vmult(bd.shapeOffsets[i], tmpV); tmpV.vadd(bd.position, tmpP);
            bd.quaternion.mult(bd.shapeOrientations[i], tmpQ); tmpQ.inverse(tmpQi);
            tmpL.set(px - tmpP.x, py - tmpP.y, pz - tmpP.z); tmpQi.vmult(tmpL, tmpL);
            const h = sh.halfExtents;
            if (Math.abs(tmpL.x) < h.x - 0.05 && Math.abs(tmpL.y) < h.y - 0.05 && Math.abs(tmpL.z) < h.z - 0.05) {
              hits.push({ body: bd.id, nsh: bd.shapes.length, he: [+h.x.toFixed(2), +h.y.toFixed(2), +h.z.toFixed(2)],
                          centre: [+tmpP.x.toFixed(1), +tmpP.y.toFixed(2), +tmpP.z.toFixed(1)],
                          pen: [+(h.x - Math.abs(tmpL.x)).toFixed(2), +(h.y - Math.abs(tmpL.y)).toFixed(2), +(h.z - Math.abs(tmpL.z)).toFixed(2)],
                          top: +(tmpP.y + h.y).toFixed(2) });
            }
          }
        }
        return hits;
      }
      const rayA = new C.Vec3(), rayB = new C.Vec3(), rr = new C.RaycastResult();
      function support(px, py, pz, self) {
        rayA.set(px, py + 0.4, pz); rayB.set(px, py - 30, pz); rr.reset();
        let best = null;
        g.world.raycastAll(rayA, rayB, { collisionFilterMask: 1, skipBackfaces: true }, (res) => {
          const b = res.body; if (b === self) return; if (b.userData && (b.userData.npc || b.userData.local)) return;
          const t = res.shape && res.shape.type; const isHF = t === 32 || t === 2;
          if (!best || res.distance < best.d) best = { d: res.distance, y: res.hitPointWorld.y, body: b.id, hf: isHF, nsh: b.shapes.length };
        });
        return best ? { under: +(py - best.y).toFixed(2), body: best.body, hf: best.hf, nsh: best.nsh } : null;
      }
      const npcs = [];
      for (const bd of g.world.bodies) {
        const u = bd.userData; if (!u || !(u.npc || u.local)) continue;
        const rec = u.npc || u.local; const isLocal = !!u.local;
        const px = isLocal ? rec.x : rec.group.position.x, py = isLocal ? rec.y : rec.group.position.y, pz = isLocal ? rec.z : rec.group.position.z;
        try {
        const t = gy(px, pz); const dy = py - t;
        const ins = insideStatic(px, py + 0.9, pz, bd);
        const insFeet = insideStatic(px, py + 0.2, pz, bd);
        const sup = support(px, py, pz, bd);
        // aabb-vs-position staleness for STATIC local bodies
        const a = bd.aabb; const ac = [(a.lowerBound.x + a.upperBound.x) / 2, (a.lowerBound.z + a.upperBound.z) / 2];
        const stale = Math.hypot(ac[0] - bd.position.x, ac[1] - bd.position.z);
        const bodyDrift = Math.hypot(bd.position.x - px, bd.position.z - pz);
        const flag = (t === t && Math.abs(dy) > 0.3) || ins.length || insFeet.length || wet(px, pz) || stale > 0.2 || bodyDrift > 0.5;
        if (!flag) continue;
        npcs.push({ id: (isLocal ? 'local:' : 'npc:') + (rec.kind || rec.name || rec.id || bd.id), type: bd.type, at: [+px.toFixed(1), +py.toFixed(2), +pz.toFixed(1)],
                    dy: t === t ? +dy.toFixed(2) : null, wet: wet(px, pz), support: sup, insideChest: ins, insideFeet: insFeet, staleAABB: +stale.toFixed(2), bodyDrift: +bodyDrift.toFixed(2),
                    line: rec.line || rec.say || null, name: rec.name || null });
        } catch (e) { npcs.push({ id: 'ERR ' + bd.id, err: String(e && e.stack || e).slice(0, 400) }); }
      }
      const props = [];
      for (const p of g.props) { try {
        if (!p || !p.body || p.removed || p.held || p.owner) continue;
        if (g.world.bodies.indexOf(p.body) < 0) continue;
        const q = p.body.position; const t = gy(q.x, q.z); const dy = q.y - t;
        const w = wet(q.x, q.z);
        if ((dy < -0.6 && !w) || (dy > 2.5 && p.body.sleepState === 2) || (w && p.body.sleepState === 2 && !p.sunk)) {
          props.push({ type: p.type, at: [+q.x.toFixed(1), +q.y.toFixed(2), +q.z.toFixed(1)], dy: +dy.toFixed(2), wet: w, asleep: p.body.sleepState === 2,
                       support: support(q.x, q.y, q.z, p.body), inside: insideStatic(q.x, q.y, q.z, p.body) });
        }
      } catch (e) { props.push({ type: 'ERR', err: String(e && e.stack || e).slice(0, 400) }); } }
      return { npcs, props };
    });
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=px-body-inside.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
