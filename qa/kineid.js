async page => {
  const targets = { sydney: [127], cali: [452], rio: [143], venice: [670], kowloon: [728], palawan: [787], iceland: [480], quay: [248] };
  const res = {};
  for (const n of Object.keys(targets)) {
    res[n] = await page.evaluate(async (arg) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
      const [name, ids] = arg;
      const g = window.__capy;
      g.biome.switchTo(name);
      await sleep(400);
      const api = name === 'sydney' ? g.env : g[name];
      const out = [];
      for (const id of ids) {
        const b = g.world.bodies.find(x => x.id === id);
        if (!b) { out.push({ id, missing: true }); continue; }
        // find which api key owns it
        const owners = [];
        const seen = new Set();
        (function walk(o, path, depth) {
          if (!o || depth > 3 || typeof o !== 'object' || seen.has(o)) return;
          seen.add(o);
          for (const k in o) {
            let v;
            try { v = o[k]; } catch (e) { continue; }
            if (v === b) owners.push(path + '.' + k);
            else if (v && typeof v === 'object' && !v.isBufferGeometry && !v.isMaterial) walk(v, path + '.' + k, depth + 1);
          }
        })(api, name, 0);
        const sh = b.shapes.map(s => s.halfExtents ? [s.halfExtents.x, s.halfExtents.y, s.halfExtents.z] : s.constructor.name);
        out.push({ id, owners: owners.slice(0, 6), shapes: sh, mass: b.mass, type: b.type,
                   pos: [+b.position.x.toFixed(2), +b.position.y.toFixed(2), +b.position.z.toFixed(2)],
                   vel: [+b.velocity.x.toFixed(3), +b.velocity.y.toFixed(3), +b.velocity.z.toFixed(3)] });
      }
      return out;
    }, [n, targets[n]]);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=kineid.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, res);
}
