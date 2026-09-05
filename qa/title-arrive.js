async page => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5188/');
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  // Installed BEFORE the card is built, so the sampler is already running when
  // it appears. The first probe waited 4.2 s and read a finished animation.
  const rec = await page.evaluate(() => new Promise(res => {
    const rows = []; let t0 = 0;
    const tick = () => {
      const c = document.querySelector('.capyui-card');
      if (c) {
        if (!t0) t0 = performance.now();
        const cs = getComputedStyle(c);
        rows.push({ ms: Math.round(performance.now() - t0),
          op: +(+cs.opacity).toFixed(2), tr: cs.transform,
          kids: [...document.querySelectorAll('.capyui-p1 > *')]
            .map(e => +(+getComputedStyle(e).opacity).toFixed(2)) });
        if (performance.now() - t0 > 1500) { res(rows); return; }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    setTimeout(() => res(rows), 14000);
  }));
  // thin it out
  const thin = rec.filter((r, i) => i % 4 === 0 || i === rec.length - 1);
  await page.screenshot({ path: 'qa/TA-settled.png' });
  await page.evaluate(o => fetch('/shot?name=ta.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }),
    { n: rec.length, rows: thin });
}
