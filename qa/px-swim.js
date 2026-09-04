// THE SWIM, IN THE CHAPTERS WHOSE WATERLINE MOVED.
//
// X8 removed the `localWater` gate, so capybara.js and systems.js now read
// waterHeightAt in every chapter instead of only three. Four chapters change as
// a result — Kyoto 0.577 m, Monte Carlo 0.627, Circular Quay 0.289, Cali 0.100
// — and a swim threshold that moves is exactly the kind of change that can look
// fine and drown the animal.
//
// Put it in the water at a point the chapter says is water, let it settle, and
// read where it floats relative to the surface directly under it. A capybara
// floating on water sits with its body a little proud of it; a number far from
// the others is a chapter solving against the wrong datum.
async page => {
  const CH = [['Digit3', 'quay'], ['Digit4', 'kyoto'], ['Digit5', 'cali'],
              ['Period', 'monaco'], ['BracketRight', 'manly'], ['Digit7', 'iceland'],
              ['Digit6', 'rio'], ['Digit0', 'venice']];
  const out = { rows: [] };
  for (const [key, name] of CH) {
    await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(4200);
    await page.keyboard.press(key);
    await page.waitForTimeout(6500);
    const row = await page.evaluate(async (nm) => {
      const g = window.__capy, a = g[g.biome.current];
      // find a wet point: spiral out from spawn until isOverWater says yes
      const sp = a.SPAWN || { x: 0, z: 0 };
      let wet = null;
      // ...and DEEP water: isOverWater is true over a jetty in Monte Carlo,
      // where the animal lands on the pier two metres up and never swims. Ask
      // for a point whose neighbours are wet too.
      for (let r = 8; r < 300 && !wet; r += 4) {
        for (let t = 0; t < 24; t++) {
          const x = sp.x + Math.cos(t / 24 * 6.283) * r, z = sp.z + Math.sin(t / 24 * 6.283) * r;
          let all = a.isOverWater(x, z);
          for (let k = 0; k < 4 && all; k++) {
            const th = k * Math.PI / 2;
            if (!a.isOverWater(x + Math.cos(th) * 6, z + Math.sin(th) * 6)) all = false;
          }
          const t2 = a.terrainHeight ? a.terrainHeight(x, z) : -99;
          if (all && t2 === t2 && t2 < a.waterLevel - 0.8) { wet = { x, z }; break; }
        }
      }
      if (!wet) return { biome: g.biome.current, wet: null };
      const surf = (typeof a.waterHeightAt === 'function') ? a.waterHeightAt(wet.x, wet.z) : a.waterLevel;
      g.capy.body.position.set(wet.x, surf + 2.0, wet.z);
      g.capy.body.velocity.set(0, 0, 0);
      g.capy.body.aabbNeedsUpdate = true;
      await new Promise(r => setTimeout(r, 3200));
      const p = g.capy.position;
      const live = (typeof a.waterHeightAt === 'function') ? a.waterHeightAt(p.x, p.z) : a.waterLevel;
      return {
        biome: g.biome.current, at: [+p.x.toFixed(1), +p.z.toFixed(1)],
        y: +p.y.toFixed(3),
        datum: +a.waterLevel.toFixed(3), live: +live.toFixed(3),
        aboveLive: +(p.y - live).toFixed(3),
        swimming: !!g.capy.swimming, diving: !!g.capy.diving,
        depth: +(g.capy.depth || 0).toFixed(3),
        err: (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null,
      };
    }, name);
    out.rows.push(row);
  }
  await page.evaluate(o => fetch('/shot?name=px-swim.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
