async page => {
  // Rio and Manly keep the line up on a fifth of a wandering soak, and the
  // question that number cannot answer is WHERE the animal was. Both chapters
  // are beaches and the soak above walks forward, which on both spawns is
  // straight into the sea — so this is the same sixty seconds spent on the
  // sand. If the line is up for zero of it, it is not furniture: it is up
  // while the water is carrying you, which is the attempt.
  const PICK = { rio: 'Digit6', manly: 'BracketRight' };
  const out = [];
  for (const name of Object.keys(PICK)) {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5000);
    await page.keyboard.press(PICK[name]);
    await page.waitForTimeout(3000);
    await page.evaluate(() => {
      window.__b6 = { n: 0, up: 0, wet: 0 };
      window.__b6t = setInterval(function () {
        const el = document.querySelector('.capyui-rec');
        const g = window.__capy, s = window.__b6;
        s.n++;
        if (g.capy && (g.capy.wet > 0.35 || g.capy.swimming)) s.wet++;
        if (el && el.classList.contains('on')) s.up++;
      }, 100);
    });
    // inland only: back away from the water, then along the front
    for (let r = 0; r < 6; r++) {
      await page.keyboard.down('KeyS'); await page.waitForTimeout(2500);
      await page.keyboard.up('KeyS');
      await page.keyboard.down('KeyA'); await page.waitForTimeout(3000);
      await page.keyboard.press('Space');
      await page.keyboard.up('KeyA');
      await page.keyboard.down('KeyD'); await page.waitForTimeout(3000);
      await page.keyboard.up('KeyD');
      await page.waitForTimeout(1500);
    }
    out.push(await page.evaluate((n) => {
      clearInterval(window.__b6t);
      const g = window.__capy, p = g.capy.position;
      return { chapter: n, samples: window.__b6.n, up: window.__b6.up, wetSamples: window.__b6.wet,
               at: [+p.x.toFixed(1), +p.z.toFixed(1)],
               err: (g.state.lastError && String(g.state.lastError)) || '' };
    }, name));
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b6-dry.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
