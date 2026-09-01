async page => {
  // The bell record, twice over. FIRST CUT counted rings, and one strike plus
  // thirty seconds of walking away scored 17 while a worked rope scored 6 —
  // `av` is a magnitude and a pendulum's is zero at both ends, so the
  // hysteresis re-arms twice a period and a decaying bell rings itself.
  // SECOND CUT is the swing ANGLE, and this is what sets its par: what one
  // strike reaches on its own, against what pumping the rope reaches.
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 4500)));
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 6000)));
  await page.keyboard.press('Digit2');
  await page.evaluate(() => new Promise(r => setTimeout(r, 7000)));

  const out = await page.evaluate(() => {
    const g = window.__capy, P = g.pasto, D = 1 / 60;
    const inp = g.input, cb = g.capy.body;
    const idle = n => { for (let i = 0; i < n; i++) { inp.x = 0; inp.z = 0; inp.run = false; g.tick(D, false); } };
    // Well away from the rope, so nothing the probe does can pull it.
    cb.position.set(40, 3, -20); cb.velocity.set(0, 0, 0);
    cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
    idle(120);
    g.hud.recordAudit(true);            // not used here, but clears any live id

    // ---- ONE strike, then hands off for thirty seconds -------------------
    const trace = [];
    P.bell.ring();
    for (let s = 0; s < 30; s++) {
      idle(60);
      const a = g.hud.recordAudit();
      trace.push(a.live === 'church-bell' ? a.val : 0);
    }
    const oneStrike = { peak: Math.max.apply(null, trace), trace: trace.slice(0, 14) };

    // ---- and now a player who keeps working the rope ----------------------
    idle(60 * 10);                       // let the peal lapse
    let peak2 = 0;
    for (let s = 0; s < 40; s++) {
      P.bell.ring();
      for (let i = 0; i < 90; i++) {
        g.tick(D, false);
        const a = g.hud.recordAudit();
        if (a.live === 'church-bell' && a.val > peak2) peak2 = a.val;
      }
    }
    idle(60 * 10);
    const a = g.hud.recordAudit();
    return { oneStrike: oneStrike, worked: peak2, filed: a.best['church-bell'],
             err: g.state.lastError ? String(g.state.lastError) : null };
  });
  const b = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=r8-bell2.json', { method: 'POST', body: s }), b);
}
