// THE NO-REGRET BATCH, ACROSS ALL NINETEEN.
//
// Three additive changes, and the claim made for all three is that they cannot
// break anything: the flow look is one factor on one radius and a hold on one
// field, customs is an armed sentence, and the line mark is an accumulator and
// a save key. This is the soak that has to agree.
//
// It runs every chapter with the animal SPRINTING rather than standing, which
// is the only mode in which any of the three does anything at all — a soak
// that walks through nineteen worlds would exercise none of it and come back
// green for the wrong reason.
async page => {
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).slice(0, 200)));

  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(6500);
  await page.keyboard.press('Space');
  await page.waitForTimeout(3000);

  const CH = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara',
              'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal',
              'cave', 'antarctic', 'monaco', 'hanoi'];
  const rows = [];
  for (const b of CH) {
    await page.evaluate((n) => {
      const g = window.__capy;
      try { g.hud.cross(n); } catch (e) { g.biome.switchTo(n); }
    }, b);
    await page.waitForTimeout(3800);
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(4500);
    await page.keyboard.up('KeyW');
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(4500);
    await page.keyboard.up('KeyD');
    await page.keyboard.up('ShiftLeft');
    await page.waitForTimeout(700);
    rows.push(await page.evaluate(() => {
      const g = window.__capy;
      const p = g.capy.position;
      let held = 0, nan = 0;
      const live = g.biome.current;
      for (const r of g.locals) {
        if (r.biome !== live) continue;
        if ((r.flowSeen || 0) > 0) held++;
        if (!(r.x === r.x) || !(r.z === r.z) || !(r.yaw === r.yaw)) nan++;
      }
      return {
        biome: live,
        lastError: (g.state && g.state.lastError) || null,
        capyNaN: !(p.x === p.x && p.y === p.y && p.z === p.z),
        flow: +((g.state && g.state.flow) || 0).toFixed(2),
        localsHolding: held, localNaN: nan,
        keep: g.keepAudit ? g.keepAudit().said : -1,
      };
    }));
  }
  const marks = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('capy3.journey.v1') || '{}').lin || {}; }
    catch (e) { return { err: 1 }; }
  });
  await page.evaluate(async (p) => {
    await fetch('/shot?name=NR-SOAK', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(p)))) });
  }, { rows: rows, marks: marks, errors: errs.slice(0, 20), errorCount: errs.length });
}
