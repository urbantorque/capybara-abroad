async page => {
  // The last three chapters to be wired — Sydney's ice-cream van, Pasto's
  // carnival float and Cappadocia's balloon — soaked for the same sixty
  // seconds as the other sixteen. Every one of the three is a RIDE, and a ride
  // is the shape most likely to leave a counter up while a player is doing
  // nothing, so these are the three that most needed the measurement.
  const PICK = { sydney: 'Digit1', pasto: 'Digit2', goreme: 'BracketLeft' };
  const out = [];
  for (const name of Object.keys(PICK)) {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5000);
    await page.keyboard.press(PICK[name]);
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
    const s = await page.evaluate(() => {
      clearInterval(window.__b6t);
      const g = window.__capy;
      return { s: window.__b6, biome: g.biome.current,
               err: (g.state.lastError && String(g.state.lastError)) || '' };
    });
    out.push({ chapter: name, got: s.biome, samples: s.s.n, up: s.s.up, ids: s.s.ids, err: s.err });
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b6-soak3.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
