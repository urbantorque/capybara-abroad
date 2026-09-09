async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);
  const a = await page.evaluate(() => {
    const g = window.__capy;
    const el = document.querySelector('.capyui-rec');
    return { biome: g.biome.current, started: g.state.started,
             hasLive: typeof g.recordLive, hasEnd: typeof g.recordEnd,
             recFound: !!el, recUp: !!(el && el.classList.contains('on')),
             yaw: +g.input.camYaw.toFixed(3),
             err: (g.state.lastError && String(g.state.lastError)) || '' };
  });
  // drive a fake attempt through the channel and watch the line appear
  const b = await page.evaluate(async () => {
    const g = window.__capy;
    const el = document.querySelector('.capyui-rec');
    const out = { frames: [] };
    for (let i = 0; i < 40; i++) {
      g.recordLive('uji-run', i * 0.1);
      await new Promise(r => requestAnimationFrame(r));
      if (i % 12 === 0) out.frames.push({ i: i, up: el.classList.contains('on'), t: el.textContent });
    }
    // now stop asking, and it should close itself
    let waited = 0;
    while (waited < 3000 && el.classList.contains('on')) {
      await new Promise(r => setTimeout(r, 100)); waited += 100;
    }
    out.closedAfterMs = waited;
    out.upAtEnd = el.classList.contains('on');
    out.textAtEnd = el.textContent;
    return out;
  });
  // and explicit recordEnd
  const c = await page.evaluate(async () => {
    const g = window.__capy;
    const el = document.querySelector('.capyui-rec');
    g.recordLive('uji-run', 4.2);
    await new Promise(r => requestAnimationFrame(r));
    const up = el.classList.contains('on');
    g.recordEnd('uji-run');
    await new Promise(r => requestAnimationFrame(r));
    return { upAfterLive: up, upAfterEnd: el.classList.contains('on'),
             err: (g.state.lastError && String(g.state.lastError)) || '' };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b6-smoke.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, { a: a, b: b, c: c });
}
