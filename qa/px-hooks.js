// TWO PUBLISHED HOOKS, CHECKED AGAINST THE THING THEY CLAIM TO DESCRIBE.
//
// 1. slopeAt(x, z). Seventeen chapters publish an ANALYTIC gradient and no
//    runtime code has ever read one. That is bad enough on its own, but the
//    thing that makes it worth a probe is that an analytic gradient can be
//    WRONG about the chapter's own terrain and nobody would ever find out —
//    venice.js already carries a comment saying its slopeAt answers 0.003
//    where the real edge is a step. So: central-difference the chapter's own
//    terrainHeight and compare.
//
// 2. waterHeightAt(x, z) versus waterLevel. capybara.js and systems.js only
//    ask waterHeightAt when the chapter also sets `localWater: true`; props.js,
//    weather.js and npc.js ask it unconditionally. That asymmetry is harmless
//    only while the two agree in every chapter that does NOT set the flag. So:
//    measure the disagreement, per chapter, and find out whether it is.
//
// Sampled on a grid inside bounds() where one is published, and on a 300 m box
// round SPAWN where one is not.
async page => {
  const CH = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7',
              'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'BracketLeft',
              'BracketRight', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash'];
  const out = { chapters: [] };
  for (const key of CH) {
    await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(4200);
    await page.keyboard.press(key);
    await page.waitForTimeout(6000);
    const row = await page.evaluate(() => {
      const g = window.__capy, a = g[g.biome.current];
      if (!a) return { biome: g.biome.current, err: 'no api' };
      const sp = a.SPAWN || { x: 0, z: 0 };
      let b = null;
      try { b = typeof a.bounds === 'function' ? a.bounds() : null; } catch (e) { b = null; }
      const x0 = b ? b.x0 : sp.x - 150, x1 = b ? b.x1 : sp.x + 150;
      const z0 = b ? b.z0 : sp.z - 150, z1 = b ? b.z1 : sp.z + 150;
      const N = 24, H = 0.5;                 // 576 points; 0.5 m central difference
      const hasSlope = typeof a.slopeAt === 'function';
      const hasTerr  = typeof a.terrainHeight === 'function';
      const hasWH    = typeof a.waterHeightAt === 'function';
      let sMax = 0, sSum = 0, sN = 0, sWorst = null;
      let wMax = 0, wN = 0, wWorst = null;
      const lvl = a.waterLevel;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const x = x0 + (x1 - x0) * ((i + 0.5) / N);
          const z = z0 + (z1 - z0) * ((j + 0.5) / N);
          if (hasSlope && hasTerr) {
            let an = NaN, dh = NaN;
            try { an = a.slopeAt(x, z); } catch (e) { an = NaN; }
            try {
              const hx = (a.terrainHeight(x + H, z) - a.terrainHeight(x - H, z)) / (2 * H);
              const hz = (a.terrainHeight(x, z + H) - a.terrainHeight(x, z - H)) / (2 * H);
              dh = Math.hypot(hx, hz);
            } catch (e) { dh = NaN; }
            if (an === an && dh === dh) {
              const d = Math.abs(an - dh);
              sSum += d; sN++;
              if (d > sMax) { sMax = d; sWorst = { x: +x.toFixed(1), z: +z.toFixed(1),
                                                  analytic: +an.toFixed(3), terrain: +dh.toFixed(3) }; }
            }
          }
          if (hasWH && typeof lvl === 'number' && lvl === lvl) {
            let wh = NaN;
            try { wh = a.waterHeightAt(x, z); } catch (e) { wh = NaN; }
            if (wh === wh && wh > -300) {      // -400 is "this chapter has no water"
              const d = Math.abs(wh - lvl);
              wN++;
              if (d > wMax) { wMax = d; wWorst = { x: +x.toFixed(1), z: +z.toFixed(1),
                                                  live: +wh.toFixed(3), level: +lvl.toFixed(3) }; }
            }
          }
        }
      }
      return {
        biome: g.biome.current,
        localWater: a.localWater === true,
        slope: hasSlope ? { n: sN, max: +sMax.toFixed(3),
                            mean: sN ? +(sSum / sN).toFixed(3) : 0, worst: sWorst } : null,
        water: hasWH ? { n: wN, max: +wMax.toFixed(3), worst: wWorst } : null,
        err: (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null,
      };
    });
    out.chapters.push(row);
  }
  await page.evaluate(o => fetch('/shot?name=px-hooks.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
