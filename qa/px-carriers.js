// WHICH KINEMATIC CARRIERS RE-ASSERT THEIR POSITION, AND WHICH ONLY SET A
// VELOCITY.
//
// A kinematic body in cannon is integrated by the solver: position += velocity
// * STEP, once per substep. A carrier that derives its velocity from the FRAME
// dt and never writes a position is therefore correct only when the frame rate
// and the fixed step agree — at 144 Hz it accumulates error every frame and the
// deck slides out from under its own drawing. A carrier that also writes
// `position.set` every frame cannot drift, because the write is the truth and
// the integration is overwritten before anybody looks.
//
// You cannot tell the two apart by reading forty constructors. You can tell
// them apart by counting the writes: patch `set` on each body's OWN position
// vector (per-instance, so Vec3.prototype is untouched) and count for two
// seconds of real frames.
//
// It also records the fastest carrier in the game, which is the number
// capyPLAT_VMAX has to be bigger than.
async page => {
  const CH = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7',
              'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'BracketLeft',
              'BracketRight', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash'];
  const out = { chapters: [] };
  // A DIGIT ONLY TRAVELS FROM THE TITLE CARD, so this reloads per chapter.
  // Pressed in a running game it does nothing at all, and the first run of this
  // probe reported nineteen rows of Sydney.
  for (const key of CH) {
    await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(4200);
    await page.keyboard.press(key);
    await page.waitForTimeout(6000);
    const row = await page.evaluate(async () => {
      const g = window.__capy, K = g.CANNON.Body.KINEMATIC;
      const bodies = g.world.bodies.filter(b => b.type === K);
      const marks = bodies.map(b => {
        const rec = { setN: 0, vmax: 0, moved: 0 };
        const p = b.position, real = p.set.bind(p);
        p.set = function (x, y, z) { rec.setN++; return real(x, y, z); };
        rec.restore = () => { delete p.set; };
        rec.body = b;
        return rec;
      });
      const t0 = performance.now();
      await new Promise(res => {
        const id = setInterval(() => {
          for (const m of marks) {
            const v = Math.hypot(m.body.velocity.x, m.body.velocity.z);
            if (v > m.vmax) m.vmax = v;
          }
          if (performance.now() - t0 > 2000) { clearInterval(id); res(); }
        }, 33);
      });
      const secs = (performance.now() - t0) / 1000;
      const list = marks.map(m => {
        m.restore();
        return {
          shapes: m.body.shapes.length,
          setHz: +(m.setN / secs).toFixed(1),
          vmax: +m.vmax.toFixed(2),
        };
      });
      // Only the ones that actually MOVE are carriers; a kinematic body that
      // never moves is a door or a lid and cannot drift anywhere.
      const movers = list.filter(x => x.vmax > 0.05);
      return {
        biome: g.biome.current,
        kinematic: list.length,
        movers: movers.length,
        // the ones the shelf asks for: moving, and never re-asserted
        velocityOnly: movers.filter(x => x.setHz < 1).length,
        fastest: movers.length ? Math.max.apply(null, movers.map(x => x.vmax)) : 0,
        sample: movers.slice(0, 8),
        err: (window.__capyErr && window.__capyErr.length) ? window.__capyErr[0] : null,
      };
    });
    out.chapters.push(row);
  }
  await page.evaluate(o => fetch('/shot?name=px-carriers.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
