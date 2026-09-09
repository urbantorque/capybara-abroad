async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.setViewportSize({ width: 900, height: 300 });
  await page.reload();
  await wait(4500);
  await page.keyboard.press('Digit1');
  await wait(4500);
  // Cloned out of the LIVE card rather than rebuilt, so what is on screen here
  // is what is on the paper — a swatch that reimplements its subject is worth
  // nothing (the sayAudit lesson).
  const ok = await page.evaluate(() => {
    const src = {
      wow: document.querySelector('.capyui-tier.wow'),
      mini: document.querySelector('.capyui-tier.mini'),
      clock: document.querySelector('.capyui-meas'),
    };
    const box = document.createElement('div');
    box.id = 'qaswatch';
    box.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#faf6ec;' +
      'padding:16px 20px;display:flex;gap:24px;align-items:flex-end;' +
      'font:11px/1.2 "Trebuchet MS",sans-serif;color:#6b5a48;';
    const found = {};
    for (const n in src) {
      found[n] = !!src[n];
      if (!src[n]) continue;
      [10, 22, 56].forEach(function (px) {
        const cell = document.createElement('div');
        cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;';
        const c = src[n].cloneNode(true);
        c.style.fontSize = px + 'px';
        c.style.opacity = getComputedStyle(src[n]).opacity;
        c.style.color = getComputedStyle(src[n]).color;
        cell.appendChild(c);
        cell.appendChild(document.createTextNode(n + ' ' + px));
        box.appendChild(cell);
      });
    }
    document.body.appendChild(box);
    return found;
  });
  await wait(400);
  const b = await page.evaluate(() => {
    const r = document.getElementById('qaswatch').getBoundingClientRect();
    return { x: 0, y: 0, width: Math.ceil(r.width), height: Math.ceil(r.height) };
  });
  await page.screenshot({ path: 'qa/F4-glyphs.png', clip: b });
  await page.evaluate(() => { const e = document.getElementById('qaswatch'); if (e) e.remove(); return true; });
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), ok);
  await page.evaluate(s => fetch('/shot?name=f4-glyph.json', { method: 'POST', body: s }), bl);
}
