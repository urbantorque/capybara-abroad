async page => {
  const out = {};
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(1500);
  // ---- THE GRAZE. Spawn a sandwich at the animal's feet, grab it, stand still.
  out.grab = await page.evaluate(() => {
    const g = window.__capy;
    const c = g.capy.position;
    const p = g.physics.spawnProp('sandwich', c.x + 0.6, c.z + 0.2);
    window.__qaFood = p;
    const ok = g.physics.grab(p);
    return { spawned: !!p, grabbed: !!ok, held: !!p.held, eaten: p.eaten, edible: true };
  });
  const trail = [];
  for (let i = 0; i < 9; i++) {
    await page.waitForTimeout(1000);
    trail.push(await page.evaluate(() => {
      const p = window.__qaFood;
      return { t: +window.__capy.capy.stillT.toFixed(1), eaten: p.eaten,
               scale: +p.mesh.scale.x.toFixed(3), hidden: p.hidden, held: p.held };
    }));
  }
  out.trail = trail;
  out.after = await page.evaluate(() => {
    const p = window.__qaFood;
    return { hidden: p.hidden, held: p.held, eaten: p.eaten,
             scale: +p.mesh.scale.x.toFixed(3),
             heldNow: !!window.__capy.capy.heldProp,
             restockIn: +(p.hiddenUntil - window.__capy.state.time).toFixed(1) };
  });
  out.err = await page.evaluate(() => String(window.__capy.state.lastError));
  await page.evaluate((o) => fetch('/shot?name=w34j.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
