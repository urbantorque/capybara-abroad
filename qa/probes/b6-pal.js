async page => {
  // Palawan alone, on the CORRECT picker key. qa/b6-soak2.js pressed
  // BracketLeft for it, which is Cappadocia — so the 0/605 that run reported
  // for "palawan" was Cappadocia's, and Palawan's own re-soak after the
  // placeCue import was never taken.
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Equal');
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const g = window.__capy;
    window.__b6 = { n: 0, up: 0, ids: {}, live: '' };
    const raw = g.recordLive;
    g.recordLive = function (id, v) { window.__b6.live = id; return raw.call(g, id, v); };
    window.__b6t = setInterval(function () {
      const el = document.querySelector('.capyui-rec');
      const s = window.__b6;
      s.n++;
      if (el && el.classList.contains('on')) { s.up++; s.ids[s.live] = (s.ids[s.live] || 0) + 1; }
    }, 100);
  });
  for (let r = 0; r < 6; r++) {
    await page.keyboard.down('KeyW'); await page.waitForTimeout(3000);
    await page.keyboard.down('KeyD'); await page.waitForTimeout(1000);
    await page.keyboard.up('KeyD');
    await page.keyboard.press('Space'); await page.waitForTimeout(2000);
    await page.keyboard.up('KeyW');
    await page.keyboard.down('KeyA'); await page.waitForTimeout(1500);
    await page.keyboard.up('KeyA');
    await page.keyboard.down('KeyS'); await page.waitForTimeout(1500);
    await page.keyboard.up('KeyS');
    await page.waitForTimeout(1000);
  }
  const out = await page.evaluate(() => {
    clearInterval(window.__b6t);
    const g = window.__capy;
    return { chapter: 'palawan', got: g.biome.current, samples: window.__b6.n,
             up: window.__b6.up, ids: window.__b6.ids,
             err: (g.state.lastError && String(g.state.lastError)) || '' };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b6-pal.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
