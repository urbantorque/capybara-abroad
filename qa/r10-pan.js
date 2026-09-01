async page => {
  // The soak's one warning: pantanal's cattleman is anchored at (-33, -48),
  // terrain 0.27 against a 0.30 guard, so put() skips him and the chapter ships
  // with six locals instead of seven — the missing one being the man whose
  // whole point is that he knows you took the herd over. Find dry ground near
  // the crossing rather than guessing at it.
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 6000)));
  await page.keyboard.press('Digit1');
  await page.evaluate(() => new Promise(r => setTimeout(r, 4000)));
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('pantanal');
    const sp = g.biome.spawnOf('pantanal'), b = g.capy.body;
    if (sp) { b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0); }
  });
  await page.evaluate(() => new Promise(r => setTimeout(r, 3000)));
  const out = await page.evaluate(() => {
    const g = window.__capy, P = g.pantanal;
    const locals = (g.locals || []).filter(function (l) { return l.biome === "pantanal"; })
      .map(function (l) { return { x: +l.x.toFixed(1), z: +l.z.toFixed(1), y: +l.y.toFixed(2) }; });
    // panTerrain vs what a person can stand on, at the two candidate anchors
    // THE STATIC GROUND, not panTerrain: the mats drift, so a point-probe of
    // panTerrain measures where a raft was on the frame you asked.
    const GUARD = 0.30;
    let best = null;
    const CX = -34, CZ0 = -54;
    for (let dx = -34; dx <= 34; dx += 1) {
      for (let dz = -34; dz <= 34; dz += 1) {
        const x = CX + dx, z = CZ0 + dz;
        const h = P.standHeight(x, z);
        if (h < GUARD + 0.20) continue;
        if (P.navBlocked && P.navBlocked(x, z, 0.9)) continue;
        const d = Math.hypot(dx, dz);
        if (!best || d < best.d) best = { x: x, z: z, h: +h.toFixed(2), d: +d.toFixed(1) };
      }
    }
    return { n: locals.length, locals: locals, best: best,
             at: { terrain: +P.terrainHeight(-33, -48).toFixed(3),
                   stand: +P.standHeight(-33, -48).toFixed(3) } };
  });
  const b = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=r10-pan.json', { method: 'POST', body: s }), b);
}
