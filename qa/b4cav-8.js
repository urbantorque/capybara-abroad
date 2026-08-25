async page => {
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200)));
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(7000);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const o = { runs: [] };
    const settle = n => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    g.biome.switchTo('cave');
    const cav = g.cave, b = g.capy.body;
    const sp = cav.SPAWN;
    // --- what the COLLISION heightfield thinks the floor is, at 4 m spacing ---
    // cavBuildCollision: X0 = -70, EL = 4, Z1 = -186 + 69*4 = 90, nodes at
    // x = X0 + i*EL and z = Z1 - j*EL.
    const X0 = -70, EL = 4, Z1 = 90;
    const hfPlane = (x, z) => {
      const i = Math.floor((x - X0) / EL), j = Math.floor((Z1 - z) / EL);
      const gx = k => X0 + k * EL, gz = k => Z1 - k * EL;
      const h = (a, c) => cav.terrainHeight(gx(a), gz(c));
      const c00 = h(i, j), c10 = h(i + 1, j), c01 = h(i, j + 1), c11 = h(i + 1, j + 1);
      // slope of the steeper of the two triangles in the cell
      const s1 = Math.hypot((c10 - c00) / EL, (c01 - c00) / EL);
      const s2 = Math.hypot((c11 - c01) / EL, (c11 - c10) / EL);
      return { cell: [gx(i), gz(j), gx(i + 1), gz(j + 1)],
               h: [+c00.toFixed(3), +c10.toFixed(3), +c01.toFixed(3), +c11.toFixed(3)],
               hfSlope: +Math.max(s1, s2).toFixed(4),
               // ...against the ANALYTIC floor sampled at half a metre
               fine: +Math.max(
                 Math.abs(cav.terrainHeight(x + 0.5, z) - cav.terrainHeight(x - 0.5, z)),
                 Math.abs(cav.terrainHeight(x, z + 0.5) - cav.terrainHeight(x, z - 0.5))).toFixed(4),
               analytic: +cav.slopeAt(x, z).toFixed(4),
               // how far the flat-plane approximation is from the real surface
               err: +(( (c00 + c10 + c01 + c11) / 4) - cav.terrainHeight(x, z)).toFixed(3) };
    };
    function run(dx, dz, label) {
      b.position.set(sp.x + dx, cav.terrainHeight(sp.x + dx, sp.z + dz) + 0.4, sp.z + dz);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.input.x = 0; g.input.z = 0; g.input.action = false; g.input.run = false;
      settle(150);
      const p0 = g.capy.position.clone ? g.capy.position.clone() : { x: g.capy.position.x, y: g.capy.position.y, z: g.capy.position.z };
      const a = { x: p0.x, y: p0.y, z: p0.z };
      const track = [];
      for (let s = 0; s < 12; s++) {
        settle(300);   // 5 s
        const c = g.capy.position;
        track.push([+(c.x - a.x).toFixed(3), +(c.z - a.z).toFixed(3), +(c.y - a.y).toFixed(3)]);
      }
      const c = g.capy.position;
      const pl = hfPlane(c.x, c.z);
      return { label,
               from: [+a.x.toFixed(2), +a.z.toFixed(2), +a.y.toFixed(2)],
               to: [+c.x.toFixed(2), +c.z.toFixed(2), +c.y.toFixed(2)],
               moved: +Math.hypot(c.x - a.x, c.z - a.z).toFixed(3),
               bearing: +(Math.atan2(c.x - a.x, c.z - a.z) * 180 / Math.PI).toFixed(1),
               track,
               vel: +Math.hypot(b.velocity.x, b.velocity.z).toFixed(4),
               slip: +(g.capy.slip || 0).toFixed(3),
               wet: +(g.capy.wet || 0).toFixed(3),
               loaf: +(g.capy.loaf || 0).toFixed(3),
               grounded: !!g.capy.grounded,
               swim: !!g.capy.swimming,
               plane: pl };
    }
    o.runs.push(run(0, 0, 'spawn'));
    o.runs.push(run(9, 9, 'spawn+9,9'));
    o.runs.push(run(0, -20, 'passage z42'));
    o.runs.push(run(4, -110, 'doline-ish'));
    o.spawn = { x: sp.x, y: sp.y, z: sp.z };
    return o;
  });
  out.errs = errs;
  await page.evaluate(async o => {
    await fetch('/shot?name=b4cav-8.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
