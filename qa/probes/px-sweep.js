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
      window.__bx = { off: {}, wet: {}, inside: {}, samples: 0 };
    }, n);
    await page.waitForTimeout(2500);
    // 12 s soak with a 250 ms NPC sampler
    await page.evaluate(() => {
      const g = window.__capy;
      const C = g.CANNON;
      const api = g.biome.current === 'sydney' ? g.env : g[g.biome.current];
      const gy = (x, z) => {
        const h = api && api.terrainHeight ? api.terrainHeight(x, z) : NaN;
        return (typeof h === 'number' && h === h) ? h : NaN;
      };
      const wet = (x, z) => { try { return !!(api && api.isOverWater && api.isOverWater(x, z)); } catch (e) { return false; } };
      const tmpV = new C.Vec3(), tmpL = new C.Vec3(), tmpQ = new C.Quaternion(), tmpQi = new C.Quaternion(), tmpP = new C.Vec3();
      function insideStatic(px, py, pz, self) {
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
            if (Math.abs(tmpL.x) < h.x - 0.05 && Math.abs(tmpL.y) < h.y - 0.05 && Math.abs(tmpL.z) < h.z - 0.05) return bd.id + ':' + bd.shapes.length + 'sh';
          }
        }
        return null;
      }
      window.__bxTimer = setInterval(() => {
        const B = window.__bx; B.samples++;
        for (const bd of g.world.bodies) {
          const u = bd.userData; if (!u || !(u.npc || u.local)) continue;
          const rec = u.npc || u.local;
          const isLocal = !!u.local;
          const px = isLocal ? rec.x : rec.group.position.x;
          const py = isLocal ? rec.y : rec.group.position.y;
          const pz = isLocal ? rec.z : rec.group.position.z;
          const id = (isLocal ? 'local:' : 'npc:') + (rec.kind || rec.name || rec.id || bd.id);
          const t = gy(px, pz);
          const dy = py - t;
          if (t === t && (dy < -0.3 || dy > 0.3)) { const k = id + ' dy=' + dy.toFixed(2) + ' st=' + (rec.state || '') + ' at ' + px.toFixed(0) + ',' + pz.toFixed(0); B.off[k] = (B.off[k] || 0) + 1; }
          if (wet(px, pz)) { const k = id + ' st=' + (rec.state || '') + ' at ' + px.toFixed(0) + ',' + pz.toFixed(0) + ' y=' + py.toFixed(1); B.wet[k] = (B.wet[k] || 0) + 1; }
          const bodyDrift = Math.hypot(bd.position.x - px, bd.position.z - pz);
          if (bodyDrift > 1.0) { const k = id + ' body-vs-figure ' + bodyDrift.toFixed(1) + 'm'; B.off[k] = (B.off[k] || 0) + 1; }
          const ins = insideStatic(px, py + 0.9, pz, bd);
          if (ins) { const k = id + ' inside static ' + ins + ' at ' + px.toFixed(0) + ',' + pz.toFixed(0); B.inside[k] = (B.inside[k] || 0) + 1; }
        }
      }, 250);
    });
    for (let i = 0; i < 2; i++) await page.evaluate(() => new Promise(r => setTimeout(r, 6000)));
    // kinematic 2.5 s watch + props + npc summary
    out[n] = await page.evaluate(async () => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
      const g = window.__capy;
      clearInterval(window.__bxTimer);
      const K = g.CANNON.Body.KINEMATIC;
      const api = g.biome.current === 'sydney' ? g.env : g[g.biome.current];
      const gy = (x, z) => {
        const h = api && api.terrainHeight ? api.terrainHeight(x, z) : 0;
        return (typeof h === 'number' && h === h) ? h : 0;
      };
      const kin = [];
      for (const bd of g.world.bodies) {
        if (bd.type !== K) continue;
        kin.push({ b: bd, lx: bd.position.x, ly: bd.position.y, lz: bd.position.z, moved: 0, tele: 0, maxTele: 0, maxV: 0, frames: 0, zeroVMove: 0,
                   label: bd.shapes.length + 'x' + (bd.shapes[0] ? bd.shapes[0].constructor.name : '?') + (bd.userData && bd.userData.npc ? ' npc' : '') });
      }
      const t0 = performance.now(); let lastT = t0;
      while (performance.now() - t0 < 2500) {
        await sleep(16);
        const now = performance.now(); const dt = (now - lastT) / 1000; lastT = now;
        if (dt <= 0 || dt > 0.2) continue;
        for (const k of kin) {
          const p = k.b.position, v = k.b.velocity;
          const d = Math.hypot(p.x - k.lx, p.y - k.ly, p.z - k.lz);
          const vs = Math.hypot(v.x, v.y, v.z);
          k.lx = p.x; k.ly = p.y; k.lz = p.z; k.frames++;
          if (d > 0.002) k.moved++;
          if (d > 0.01 && vs < 1e-3) k.zeroVMove++;
          if (vs > k.maxV) k.maxV = vs;
          if (d > 0.012 && d > vs * dt * 2.2 + 0.006) { k.tele++; if (d > k.maxTele) k.maxTele = d; }
        }
      }
      const kine = kin.filter(k => k.moved > 3).map(k => ({ id: k.b.id, label: k.label, moved: k.moved, frames: k.frames, tele: k.tele, zeroVMove: k.zeroVMove,
        maxTele: +k.maxTele.toFixed(3), maxV: +k.maxV.toFixed(2), at: [+k.b.position.x.toFixed(1), +k.b.position.y.toFixed(1), +k.b.position.z.toFixed(1)] }));
      const bad = []; let np = 0, held = 0, owned = 0, asleep = 0, live = 0;
      const wet = (x, z) => { try { return !!(api && api.isOverWater && api.isOverWater(x, z)); } catch (e) { return false; } };
      for (const p of g.props) {
        if (!p || !p.body || p.removed) continue;
        np++;
        const inWorld = g.world.bodies.indexOf(p.body) >= 0; if (!inWorld) continue; live++;
        if (p.held) { held++; continue; }
        if (p.owner) { owned++; continue; }
        const q = p.body.position;
        if (p.body.sleepState === 2) asleep++;
        if (!(q.x === q.x && q.y === q.y && q.z === q.z)) { bad.push(p.type + ' NaN'); continue; }
        const dy = q.y - gy(q.x, q.z);
        const w = wet(q.x, q.z);
        if (dy < -0.6 && !w) bad.push(p.type + ' under ground by ' + (-dy).toFixed(2) + ' at ' + q.x.toFixed(0) + ',' + q.z.toFixed(0) + (p.body.sleepState === 2 ? ' asleep' : ''));
        else if (dy > 2.5 && p.body.sleepState === 2) bad.push(p.type + ' asleep in mid-air ' + dy.toFixed(2) + ' at ' + q.x.toFixed(0) + ',' + q.z.toFixed(0));
        if (w && p.body.sleepState === 2 && !p.sunk) bad.push(p.type + ' asleep over water y=' + q.y.toFixed(2) + ' at ' + q.x.toFixed(0) + ',' + q.z.toFixed(0));
        if (Math.abs(q.x) > 260 || Math.abs(q.z) > 320) bad.push(p.type + ' far ' + q.x.toFixed(0) + ',' + q.z.toFixed(0));
      }
      const B = window.__bx;
      const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => k + ' x' + v);
      let nbod = 0; for (const bd of g.world.bodies) if (bd.userData && (bd.userData.npc || bd.userData.local)) nbod++;
      return { bodies: g.world.bodies.length, npcBodies: nbod, samples: B.samples, npcOff: top(B.off), npcWet: top(B.wet), npcInside: top(B.inside),
               props: np, live, held, owned, asleep, bad: bad.slice(0, 14), solverSaves: g.state.solverSaves || 0, lastError: g.state.lastError || null, kine };
    });
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=px-body-sweep.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
