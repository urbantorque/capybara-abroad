async page => {
  // ---- A PAUSE KEEPS THE HELD BEAT (L4, qa #7) ------------------------------
  // The slowmo case of qa/l4r-qa-input.js, alone. slowmo(0.4, 4), Esc at
  // 0.5 s, resume at 3 s: timeScale must still read 0.4 on resume and go back
  // to 1 about two and a half seconds later — the pause spent none of the
  // beat. Before this fix the resume row read 1.00.
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('http://localhost:5188/', { waitUntil: 'commit', timeout: 90000 });
  await page.waitForTimeout(7000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3500);
  const st = () => page.evaluate(() => { const g = window.__capy; return { paused: g.state.paused, ts: +g.state.timeScale.toFixed(2), t: +g.state.time.toFixed(2), err: g.state.lastError || null, pauseShown: g.hud.pauseShown() }; });
  const out = {};
  await page.evaluate(() => window.__capy.slowmo(0.4, 4));
  await page.waitForTimeout(500);
  out.slowBefore = await st();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  out.slowPaused = await st();
  await page.waitForTimeout(2000);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  out.slowResumed = await st();
  await page.waitForTimeout(1200);
  out.slowResumedMid = await st();
  await page.waitForTimeout(2600);
  out.slowResumedLater = await st();
  // ...and the biome change still clears it: slowmo, then a crossing
  await page.evaluate(() => window.__capy.slowmo(0.4, 6));
  await page.waitForTimeout(400);
  out.crossBefore = await st();
  await page.evaluate(() => window.__capy.biome.switchTo('pasto'));
  await page.waitForTimeout(400);
  out.crossAfter = await st();
  out.crossAfter.biome = await page.evaluate(() => window.__capy.biome.current);
  out.pass = out.slowBefore.ts < 0.5 && out.slowPaused.pauseShown === true &&
    out.slowResumed.ts < 0.5 && out.slowResumedMid.ts < 0.5 && out.slowResumedLater.ts === 1 &&
    out.crossAfter.ts === 1 && !out.slowResumedLater.err;
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4-pausebeat.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
  if (!out.pass) throw new Error('l4-pausebeat FAILED: ' + JSON.stringify(out));
}
