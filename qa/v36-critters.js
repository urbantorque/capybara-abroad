async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  // hook the registry BEFORE any chapter builds, so every record is captured
  await page.evaluate(() => {
    const g = window.__capy;
    window.__crits = [];
    const raw = g.addCritter;
    g.addCritter = function (o) {
      const r = raw.call(g, o);
      window.__crits.push({ o: o, rec: r });
      return r;
    };
  });
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);

  const rows = [];
  for (const nm of ['pantanal', 'antarctic', 'drift', 'iceland']) {
    let row;
    try {
      row = await page.evaluate(async (n) => {
        const g = window.__capy;
        // THE SWITCH DOES NOT MOVE THE ANIMAL. `switchTo` swaps the world and
        // leaves the capybara at whatever (x, z) it had in the last chapter —
        // which put it in the sea off Antarctica and in a current in the
        // Pantanal, so `capyBusy` was true for ever and the calm could never
        // rise. That is the probe, not the game. Use the chapter's own spawn,
        // the same one travel uses.
        g.biome.switchTo(n);
        const sp = g.biome.spawnOf ? g.biome.spawnOf(n) : null;
        if (sp && g.capy && g.capy.body) {
          g.capy.body.position.set(sp.x, sp.y + 0.6, sp.z);
          g.capy.body.velocity.setZero();
          g.capy.body.angularVelocity.setZero();
        }
        for (let i = 0; i < 90; i++) g.tick(1 / 60, false);

        const mine = () => window.__crits.filter(c => (c.o && c.o.biome) === n)
          .map(c => ({ r: c.o.r, bold: c.o.bold === undefined ? 0 : c.o.bold,
                       k: c.o.k === undefined ? 1 : c.o.k,
                       near: +c.rec.near.toFixed(2), appr: +c.rec.appr.toFixed(2) }));

        // MOVING: drive the stick so the animal is never still
        for (let i = 0; i < 60 * 6; i++) {
          g.input.moveX = Math.sin(i * 0.05); g.input.moveZ = Math.cos(i * 0.05);
          g.tick(1 / 60, false);
        }
        const moving = { list: mine(), calm: +g.calm().toFixed(2),
                         loaf: +((g.capy && g.capy.loaf) || 0).toFixed(2),
                         restT: +((g.capy && g.capy.restT) || 0).toFixed(2),
                         swimming: !!(g.capy && g.capy.swimming),
                         grounded: !!(g.capy && g.capy.grounded),
                         chaos: +(g.state.chaos || 0).toFixed(2),
                         vel: g.capy ? +Math.hypot(g.capy.velocity.x, g.capy.velocity.z).toFixed(3) : null,
                         started: !!g.state.started, carried: !!(g.capy && g.capy.carriedBy), depth: +((g.capy && g.capy.depth) || 0).toFixed(2),
                         pos: g.capy ? [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(1), +g.capy.position.z.toFixed(1)] : null };

        // STILL: hands off, long enough for the loaf (6.5 s) and the calm (8 s)
        for (let i = 0; i < 60 * 16; i++) {
          g.input.moveX = 0; g.input.moveZ = 0;
          g.tick(1 / 60, false);
        }
        const still = { list: mine(), calm: +g.calm().toFixed(2),
                        loaf: +((g.capy && g.capy.loaf) || 0).toFixed(2) };
        return { biome: n, registered: mine().length, moving: moving, still: still };
      }, nm);
    } catch (e) { row = { biome: nm, error: String(e).slice(0, 250) }; }
    rows.push(row);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=v36-critters.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, { rows: rows });
}
