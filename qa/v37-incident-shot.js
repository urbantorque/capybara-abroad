async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3500);
  await page.evaluate(() => {
    const g = window.__capy;
    g.capy.body.position.set(-4, 1.0, 20);
    g.capy.body.velocity.setZero();
    g.input.camYaw = 1.0;
  });
  await page.waitForTimeout(1500);
  // three bangs in real time, a beat apart
  await page.evaluate(() => {
    const g = window.__capy;
    const c = g.capy.body.position;
    let k = 0;
    window.__bangT = setInterval(() => {
      const p = (g.props || []).filter(q => q && q.body && !q.hidden)[k % 12];
      if (!p) return;
      p.disturbed = true; p.lastCapyTouch = g.state.time;
      p.body.position.set(c.x + (k % 2 ? 2.2 : -2.2), c.y + 0.3, c.z + (k < 2 ? 2 : -2));
      g.events.emit('prop:impact', { prop: p, speed: 6, position: p.body.position });
      k++;
      if (k >= 3) clearInterval(window.__bangT);
    }, 500);
  });
  await page.waitForTimeout(2200);
}
