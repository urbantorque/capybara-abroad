async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const g = window.__capy;
    g.capy.body.position.set(0, 1.55, 2.4);
    g.capy.body.velocity.set(0, 0, 0);
  });
  const before = await page.evaluate(() => window.__capy.state.score);
  let fired = -1;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(300);
    const s = await page.evaluate(() => {
      const g = window.__capy; const p = g.capy.position;
      if (p.x * p.x + (p.z - 2.4) * (p.z - 2.4) > 9 || p.y < 1.0) {
        g.capy.body.position.set(0, 1.55, 2.4); g.capy.body.velocity.set(0, 0, 0);
      }
      return g.state.score;
    });
    if (s > before) { fired = i; break; }
  }
  // hold the frame ~700 ms after the tick: the celebration, if there is one, is up
  await page.waitForTimeout(700);
  const st = await page.evaluate(() => {
    const g = window.__capy;
    const grab = sel => { const e = document.querySelector(sel); return e && e.getBoundingClientRect().height > 0 ? (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) : null; };
    return { score: g.state.score, firedOk: true,
             toast: grab('.capyui-toast'), place: grab('.capyui-place'),
             confetti: document.querySelectorAll('[class*=conf]').length,
             camY: +g.camera.position.y.toFixed(2) };
  });
  await page.evaluate(o => fetch('/shot?name=pf2-marquee1b.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify({ fired: o.f, st: o.s })))) }), { f: fired, s: st });
}
