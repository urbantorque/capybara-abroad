async page => {
  await page.mouse.click(400, 400);
  await page.waitForTimeout(1500);
  const out = {};
  for (const b of ['sydney', 'quay', 'pasto']) {
    await page.evaluate((name) => {
      const g = window.__capy;
      g.biome.switchTo(name === 'quay' ? 'quay' : name);
      const sp = g.biome.spawnOf(name), bd = g.capy.body;
      bd.position.set(sp.x, sp.y, sp.z); bd.velocity.set(0, 0, 0);
      bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position);
      window.__nh = { max: {}, states: {}, off: [], moved: {}, start: {} };
    }, b);
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      const g = window.__capy;
      // ---- THE LIVE CAST, AND NOT BOTH OF THEM (v33) ---------------------
      // `game.npcs` holds Sydney's thirty-eight AND Pasto's twenty-three at
      // once, for the life of the session, and only the live one is stepped —
      // so an ungated capture watches a detached crowd stand perfectly still
      // and reports every one of them as a stuck NPC. Measured: 38 "stuck" in
      // the Quay, which has no npc.js cast at all, and 38 of Pasto's 56 rows
      // were Sydneysiders. Exactly the invented-finding failure of rule 3, in
      // the detector the catch-all-state bug was found with.
      //
      // The two casts are separated by `kind`, which is the only marker they
      // carry, and the Quay's people are `locals` — a different register this
      // detector does not cover and never did.
      const PA = { vendor: 1, abuela: 1, farmer: 1, churchgoer: 1, llama: 1, streetdog: 1 };
      const live = g.biome.current;
      const list = g.npcs.filter(r => r && r.group &&
        (live === 'pasto' ? !!PA[r.kind] : live === 'sydney' ? !PA[r.kind] : false));
      window.__nhTimer = setInterval(() => {
        const N = window.__nh;
        const gy = (x, z) => {
          const api = g.biome.current === 'sydney' ? g.env : g[g.biome.current];
          const h = api && api.terrainHeight ? api.terrainHeight(x, z) : 0;
          return (typeof h === 'number' && h === h) ? h : 0;
        };
        for (const r of list) {
          if (!r || !r.group) continue;
          const p = r.group.position;
          const id = (r.kind || '?') + '#' + r.id;
          N.states[id] = N.states[id] || {};
          N.states[id][r.state] = (N.states[id][r.state] || 0) + 1;
          N.max[id] = Math.max(N.max[id] || 0, r.stateT || 0);
          if (!N.start[id]) N.start[id] = [p.x, p.z];
          N.moved[id] = Math.max(N.moved[id] || 0, Math.hypot(p.x - N.start[id][0], p.z - N.start[id][1]));
          const dy = p.y - gy(p.x, p.z);
          if (!(p.x === p.x && p.y === p.y && p.z === p.z)) N.off.push(id + ' NaN');
          else if (dy < -1.2 || dy > 3.5) N.off.push(id + ' dy=' + dy.toFixed(1) + ' state=' + r.state);
          if (Math.abs(p.x) > 200 || Math.abs(p.z) > 300) N.off.push(id + ' far ' + p.x.toFixed(0) + ',' + p.z.toFixed(0));
        }
      }, 250);
    });
    for (let i = 0; i < 8; i++) await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));
    out[b] = await page.evaluate(() => {
      clearInterval(window.__nhTimer);
      const N = window.__nh;
      const stuck = [];
      for (const id in N.max) {
        const st = N.states[id];
        const keys = Object.keys(st);
        // one state for the whole 40 s AND never moved more than a metre
        if (keys.length <= 1 && (N.moved[id] || 0) < 1.0) stuck.push(id + ' always ' + keys[0] + ' moved ' + (N.moved[id] || 0).toFixed(1) + 'm');
        else if (N.max[id] > 34) stuck.push(id + ' held one state ' + N.max[id].toFixed(0) + 's moved ' + (N.moved[id] || 0).toFixed(1) + 'm');
      }
      const off = [...new Set(N.off)].slice(0, 12);
      return { npcs: Object.keys(N.max).length, stuck, off };
    });
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=npchealth.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
