async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);

  const ROWS = [
    { b: 'sydney',    t: 'steal-hat',    w: 'sunhat' },
    { b: 'quay',      t: 'manly-voyage', w: 'ferrycap' },
    { b: 'rio',       t: 'samba-parade', w: 'plumes' },
    { b: 'venice',    t: 'gondola-ride', w: 'boater' },
    { b: 'palawan',   t: 'first-dive',   w: 'snorkel' },
    { b: 'goreme',    t: 'sunrise',      w: 'flycap' },
    { b: 'manly',     t: 'all-the-way',  w: 'surfcap' },
    { b: 'cave',      t: 'the-doline',   w: 'cavehelm' },
    { b: 'antarctic', t: 'orca-ride',    w: 'parka' },
    { b: 'monaco',    t: 'black-tie',    w: 'black-tie' },
  ];

  const out = [];
  for (const r of ROWS) {
    // switch, tick the task the real way, and let the per-frame rule dress it
    const st = await page.evaluate((q) => {
      const g = window.__capy;
      g.biome.switchTo(q.b);
      g.completeTask(q.t, true);
      const sp = g.biome.spawnOf(q.b);
      const bd = g.capy.body;
      bd.position.set(sp.x, sp.y + 0.4, sp.z);
      bd.velocity.set(0, 0, 0);
      bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position);
      return { done: g.taskDone(q.t) };
    }, r);
    await page.waitForTimeout(2600);
    const chk = await page.evaluate((q) => {
      const g = window.__capy;
      let vis = 0;
      g.capy.group.traverse(o => { if (o.isMesh && o.visible) vis++; });
      return { worn: g.capy.worn, want: q.w, biome: g.biome.current, vis,
               err: g.state.lastError || null };
    }, r);
    out.push(Object.assign({ row: r.w }, st, chk));

    for (const s of [{ n: 'W-' + r.w + '-3q', yaw: 2.25, pitch: -0.06 },
                     { n: 'W-' + r.w + '-face', yaw: 3.14, pitch: -0.10 }]) {
      await page.evaluate((q) => {
        window.__capy.frameShot({ yaw: q.yaw, dist: 2.1, pitch: q.pitch,
                                  raise: 0.30, hold: 3.4 });
      }, s);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'qa/' + s.n + '.png',
                              clip: { x: 515, y: 300, width: 260, height: 175 } });
      await page.waitForTimeout(2300);
    }
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=wardrobe.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
