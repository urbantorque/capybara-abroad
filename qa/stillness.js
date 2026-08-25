// STILLNESS, MEASURED BY DISPLACEMENT — all seventeen chapters.
//
// A capybara that is given no input must not go anywhere. This sounds like the
// kind of thing that could not possibly be wrong, and it has now been wrong
// twice for two different reasons:
//
//   ANTARCTICA (v15) — groundSlip 0.66 with idle grip off. A parked animal
//   crept half a metre in 35 s while its speed readout reached 1.78 m/s.
//   VENICE (v26) — the collision heightfield sampled every 4 m over a THREE
//   metre quay edge, so the triangle under the animal was a 6.6-degree ramp
//   four metres back from the real edge, while the analytic `slopeAt` answered
//   0.003 and nothing applied any anti-slide. 2.76 m in 60 s, straight into the
//   lagoon, with `body.velocity.z` reading exactly 0.000 the whole way and
//   `capy.loaf` sitting at 1.0.
//
// BOTH OF THEM READ AS ZERO VELOCITY. That is the point of this file: judge
// stillness by DISPLACEMENT, never by speed. A solver resolving a penetration
// moves a body without ever putting a number in its velocity.
//
// It also samples a second point per chapter, away from the spawn, because a
// spawn is the one square metre of a chapter anybody ever tests.
//
// Run under playwright:
//   playwright-cli -s=<s> run-code --filename=qa/stillness.js
//   then read qa/stillness.json.png
async page => {
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200)));
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(7000);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const o = { issues: [], rows: [] };
    const settle = n => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    // 1.0 m in 60 s of no input. Generous on purpose: this is not a tuning
    // check, it is a "the ground is not carrying you away" check.
    const LIMIT = 1.0;
    const SECONDS = 60;
    const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara',
                   'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal',
                   'cave', 'antarctic'];
    function park(name, dx, dz) {
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name), b = g.capy.body;
      b.position.set(sp.x + (dx || 0), sp.y + 0.4, sp.z + (dz || 0));
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.input.x = 0; g.input.z = 0; g.input.action = false; g.input.run = false;
      settle(150);                       // let it land and settle first
      const a = { x: g.capy.position.x, y: g.capy.position.y, z: g.capy.position.z };
      settle(60 * SECONDS);
      const c = g.capy.position;
      // WHAT THE CHAPTER THINKS IS UNDER YOU. A capybara sliding down a real
      // hill or floating on real water is not this bug and must not be
      // reported as it — that is how a detector becomes something everybody
      // learns to ignore. Venice was diagnostic precisely BECAUSE slopeAt
      // answered 0.003 while the animal moved.
      const api = g.biome && g.biome.api ? g.biome.api() : (g[name] || null);
      let slope = 0;
      try { if (api && api.slopeAt) slope = api.slopeAt(c.x, c.z); } catch (e) { slope = -1; }
      return {
        slope: +(slope || 0).toFixed(3),
        swim: !!(g.capy.swimming || (g.capy.wet || 0) > 0.9),
        moved: +Math.hypot(c.x - a.x, c.z - a.z).toFixed(2),
        fell: +(c.y - a.y).toFixed(2),
        vel: +Math.hypot(g.capy.body.velocity.x, g.capy.body.velocity.z).toFixed(3),
        wet: +(g.capy.wet || 0).toFixed(2)
      };
    }
    for (const n of names) {
      try {
        const at = park(n, 0, 0);
        // ...and one point that is not the spawn, because the spawn is the one
        // square metre of any chapter that has ever been stood on in a test.
        const off = park(n, 9, 9);
        o.rows.push({ n, spawn: at.moved, off: off.moved, fell: at.fell,
                      vel: at.vel, wet: at.wet, slope: at.slope, offSlope: off.slope,
                      swim: at.swim, offSwim: off.swim });
        const FLAT = 0.08;   // anything steeper is a hill, and a hill is allowed
        if (at.moved > LIMIT && at.slope >= 0 && at.slope < FLAT && !at.swim)
          o.issues.push(n + ': drifted ' + at.moved + ' m in ' + SECONDS +
                        ' s at the spawn with no input, on ground its own slopeAt calls flat (' + at.slope + '), velocity ' + at.vel + ')');
        if (off.moved > LIMIT && off.slope >= 0 && off.slope < FLAT && !off.swim)
          o.issues.push(n + ': drifted ' + off.moved + ' m in ' + SECONDS +
                        ' s at spawn+(9,9) with no input, slopeAt ' + off.slope + ', fell ' + off.fell + ' m (a big fall here means the offset point is off the edge, not that the ground moved)');
      } catch (e) {
        o.issues.push(n + ': threw ' + String(e).slice(0, 140));
      }
    }
    o.lastError = g.state.lastError ? String(g.state.lastError).slice(0, 200) : null;
    return o;
  });
  out.pageErrors = errs.slice(0, 10);
  await page.evaluate(async d => {
    await fetch('/shot?name=stillness.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(d))))
    });
  }, out);
}
