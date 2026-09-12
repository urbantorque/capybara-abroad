async page => {
  await page.reload();
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  const out = {};
  for (const name of ['iceland', 'monaco', 'kyoto']) {
    out[name] = await page.evaluate(async (name) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
      const g = window.__capy;
      const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE', 'KeyQ', 'ShiftLeft'];
      const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
      const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name), cb = g.capy.body;
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0);
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
      await sleep(300);
      let s = 1234567 ^ name.length * 7919;
      const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
      const held = new Set();
      const hits = {}; let savesBefore = g.state.solverSaves || 0, frames = 0, framesWithSave = 0;
      const rawTick = g.tick;
      g.tick = function (dt, r) {
        const s0 = g.state.solverSaves || 0;
        const o = rawTick.call(g, dt, r);
        frames++;
        const d = (g.state.solverSaves || 0) - s0;
        if (d > 0) {
          framesWithSave++;
          for (const b of g.world.bodies) {
            const v = b.velocity, p = b.position;
            const sp2 = v.x * v.x + v.y * v.y + v.z * v.z;
            const nanP = !(p.x === p.x && p.y === p.y && p.z === p.z);
            const nanPrev = !(b.previousPosition.x === b.previousPosition.x);
            if (sp2 > 89 * 89 || nanP || nanPrev) {
              const key = (b.mass <= 0 ? 'kin' : 'dyn') + ':' + b.shapes.length + 'x' + (b.shapes[0] ? b.shapes[0].constructor.name : '?') + ':id' + b.id + (b === g.capy.body ? ':CAPY' : '');
              hits[key] = hits[key] || { n: 0, at: null, v: 0, kind: nanP ? 'nanPos' : nanPrev ? 'nanPrev' : 'vcap' };
              hits[key].n++; hits[key].v = +Math.sqrt(sp2).toFixed(1);
              hits[key].at = [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)];
            }
          }
        }
        return o;
      };
      const t0 = performance.now();
      while (performance.now() - t0 < 10000) {
        if (rnd() < 0.09) {
          const k = KEYS[(rnd() * KEYS.length) | 0];
          if (held.has(k)) { up(k); held.delete(k); } else { down(k); held.add(k); }
        }
        await sleep(16);
      }
      for (const k of held) up(k);
      g.tick = rawTick;
      // which props are these? map body id -> prop type
      const propOf = {};
      for (const pr of g.props) if (pr && pr.body) propOf[pr.body.id] = pr.type + (pr.biome ? '@' + pr.biome : '');
      const named = {};
      for (const k in hits) { const id = +k.split(':id')[1]; named[k + (propOf[id] ? ' ' + propOf[id] : '')] = hits[k]; }
      return { biome: g.biome.current, frames, framesWithSave, saves: (g.state.solverSaves || 0) - savesBefore, hits: named, bodies: g.world.bodies.length };
    }, name);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4r-qa-saves.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
