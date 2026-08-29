async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);

  const out = { rows: [] };
  const chapters = ['quay', 'venice', 'monaco', 'hanoi', 'cali'];
  for (let ci = 0; ci < chapters.length; ci++) {
    let row;
    try {
      row = await page.evaluate(async (nm) => {
        const g = window.__capy;
        if (g.biome.current !== nm) g.biome.switchTo(nm);
        for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
        const r = { biome: nm, live: g.biome.current };
        if (g.biome.current !== nm) return r;

        // Every STATIC body whose shapes are all the crowd box, counted by
        // shape rather than by body so the pooled and the per-person shapes
        // are the same number.
        let shapes = 0, parked = 0, bodies = 0;
        const pts = [];
        for (const b of g.world.bodies) {
          if (b.type !== 2 /* STATIC */ || !b.shapes.length) continue;
          let all = true;
          for (const s of b.shapes) {
            if (!s.halfExtents ||
                Math.abs(s.halfExtents.x - 0.26) > 1e-6 ||
                Math.abs(s.halfExtents.y - 0.85) > 1e-6 ||
                Math.abs(s.halfExtents.z - 0.24) > 1e-6) { all = false; break; }
          }
          if (!all) continue;
          bodies++;
          if (b.position.y < -800) { parked += b.shapes.length; continue; }
          shapes += b.shapes.length;
          for (let k = 0; k < b.shapes.length; k++) {
            const o = b.shapeOffsets[k];
            pts.push([+(b.position.x + o.x).toFixed(2),
                      +(b.position.y + o.y).toFixed(2),
                      +(b.position.z + o.z).toFixed(2)]);
          }
        }
        r.crowdBodies = bodies;
        r.crowdShapes = shapes;
        r.parked = parked;
        r.sample = pts.slice(0, 3);
        if (nm === 'venice' && g.venice) {
          r.tide = g.venice.tideLevel ? +g.venice.tideLevel().toFixed(2) : null;
          r.overWater = g.venice.isOverWater ? g.venice.isOverWater(0, 0) : null;
        }
        return r;
      }, chapters[ci]);
    } catch (e) { row = { biome: chapters[ci], error: String(e).slice(0, 250) }; }
    out.rows.push(row);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=v36-crowd.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
