async page => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://localhost:5188/');
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  // Watch the whole title screen for half a minute. A bubble lives about two
  // seconds, so a single sample proves nothing: the first run of this check
  // read zero on the UNPATCHED build simply by looking between two lines.
  const seen = await page.evaluate(() => new Promise(res => {
    const hits = []; let n = 0, peak = 0;
    const id = setInterval(() => {
      const bubs = [...document.getElementById('hud').children].filter(e =>
        e.style && e.style.transformOrigin === '50% 100%' &&
        e.offsetParent && getComputedStyle(e).display !== 'none' &&
        +getComputedStyle(e).opacity > 0.05);
      if (bubs.length > peak) peak = bubs.length;
      for (const b of bubs) {
        const t = b.textContent.trim();
        if (t && hits.indexOf(t) < 0) hits.push(t);
      }
      if (++n >= 60) { clearInterval(id); res({ peak, lines: hits, started: window.__capy.state.started }); }
    }, 500);
  }));
  await page.screenshot({ path: 'qa/TB-title.png' });
  // ...and once the game IS running, the locals must talk again: a gate that
  // never opens is not a gate, it is a deletion.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  const after = await page.evaluate(() => new Promise(res => {
    const hits = []; let n = 0, peak = 0;
    const id = setInterval(() => {
      const bubs = [...document.getElementById('hud').children].filter(e =>
        e.style && e.style.transformOrigin === '50% 100%' &&
        e.offsetParent && getComputedStyle(e).display !== 'none' &&
        +getComputedStyle(e).opacity > 0.05);
      if (bubs.length > peak) peak = bubs.length;
      for (const b of bubs) {
        const t = b.textContent.trim();
        if (t && hits.indexOf(t) < 0) hits.push(t);
      }
      if (++n >= 70) { clearInterval(id); res({ peak, lines: hits, started: window.__capy.state.started }); }
    }, 500);
  }));
  await page.evaluate(o => fetch('/shot?name=tb.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), { title: seen, playing: after });
}
