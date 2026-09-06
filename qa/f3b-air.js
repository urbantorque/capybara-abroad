async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(4000);
  const out = { runs: [] };
  // Movement is CAMERA-RELATIVE, so a different key is a different heading and
  // the animal does not keep running into whatever stopped it last time. The
  // first cut turned with KeyD between runs, drove into the harbour on run 1
  // and reported five slides that never happened.
  const dirs = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyW', 'KeyA'];
  for (let r = 0; r < dirs.length; r++) {
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down(dirs[r]);
    await wait(1700);
    await page.keyboard.down('KeyG');
    const s = await page.evaluate(function (dir) { return new Promise(res => {
      const g = window.__capy;
      const air = [], surf = [];
      const p0 = { x: +g.capy.position.x.toFixed(1), z: +g.capy.position.z.toFixed(1) };
      const v0 = g.capy.velocity;
      const spd0 = +Math.hypot(v0.x, v0.z).toFixed(2);
      let n = 0;
      (function step() {
        if (g.capy.sliding) {
          air.push(+(g.capy.slideAir || 0).toFixed(3));
          surf.push(g.capy.slideSurf);
        }
        if (++n < 130) requestAnimationFrame(step);
        else res({ dir: dir, at: p0, spd0: spd0, frames: n, sliding: air.length,
                   maxAir: air.length ? Math.max.apply(null, air) : null,
                   over12: air.filter(a => a >= 0.12).length,
                   over18: air.filter(a => a >= 0.18).length,
                   over24: air.filter(a => a >= 0.24).length,
                   surf: Array.from(new Set(surf)) });
      })();
    }); }, dirs[r]);
    await page.keyboard.up('KeyG');
    await page.keyboard.up(dirs[r]);
    await page.keyboard.up('ShiftLeft');
    out.runs.push(s);
    await wait(700);
  }
  out.err = await page.evaluate(() => window.__capy.state.lastError ? String(window.__capy.state.lastError) : null);
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f3b-air.json', { method: 'POST', body: s }), bl);
}
