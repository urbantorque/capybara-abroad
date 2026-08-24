async page => {
  await page.reload(); await page.waitForTimeout(5600);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const res = { errs: [] };
    const vis = (n) => { let p=n; while(p){ if(!p.visible) return false; p=p.parent;} return true; };
    const measure = () => { let t=0,m=0; g.scene.traverse(n=>{ if(!n.isMesh||!n.geometry||!vis(n)) return;
      const ix=n.geometry.index; const c=ix?ix.count:(n.geometry.attributes.position?n.geometry.attributes.position.count:0);
      t += (c/3)*(n.isInstancedMesh?n.count:1); m++; }); return {tris:Math.round(t), meshes:m}; };
    const hold=(x,y,z)=>{const b=g.capy.body;b.position.set(x,y,z);b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);};

    for (const bm of ['iceland','sahara','drift']) {
      g.biome.switchTo(bm);
      for (let i=0;i<600;i++) g.tick(1/60,false);
      const mm = measure();
      res[bm] = { tris: mm.tris, meshes: mm.meshes, bodies: g.world.bodies.length,
                  calls: g.renderer.info.render.calls, err: g.state.lastError || null };
    }

    // ---- every local: force-resolve every pool it owns, in every task state.
    // This is the whole point: a `when` that throws is swallowed by
    // localResolve, so a broken predicate is invisible until somebody reads
    // every line in the game by hand.
    const bad = [];
    const seen = {};
    for (const bm of ['iceland','sahara','drift']) {
      g.biome.switchTo(bm);
      for (let i=0;i<200;i++) g.tick(1/60,false);
      let n = 0, lines = 0;
      const locs = []; for (const b of g.world.bodies) if (b.userData && b.userData.local) locs.push(b.userData.local);
      for (const L of locs) {
        if (L.biome !== bm) continue;
        n++;
        const pools = [L.lines, L.wheekLines];
        if (L.onTask) for (const k in L.onTask) pools.push(L.onTask[k]);
        if (L.praise) pools.push(L.praise);
        for (const pool of pools) {
          if (!pool) continue;
          for (const e of pool) {
            if (typeof e === 'string') { lines++; continue; }
            if (!e || !e.t) { bad.push([bm, 'malformed entry']); continue; }
            lines++;
            if (e.when) { try { e.when(); } catch (err) { bad.push([bm, e.t, String(err)]); } }
          }
        }
      }
      res[bm].locals = n; res[bm].lines = lines;
    }
    res.badPredicates = bad;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=y7final.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
