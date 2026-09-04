async page => {
  await page.setViewportSize({ width: 1220, height: 260 });
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4300);
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.id = '__gsheet';
    d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#faf6ec;display:flex;' +
                      'align-items:center;justify-content:center;gap:34px;color:#3a3226;';
    for (const s of ['.capyui-look', '.capyui-menu', '.capyui-touch .capyui-back', '.capyui-slide',
                     '.capyui-hop', '.capyui-grab', '.capyui-wheek']) {
      const src = document.querySelector(s);
      if (!src) continue;
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:10px;' +
                           'font:600 11px system-ui;letter-spacing:.14em;text-transform:uppercase;';
      const box = document.createElement('div');
      box.style.cssText = 'width:120px;height:120px;border-radius:50%;background:#fff;' +
                          'border:2px solid rgba(58,50,38,.18);display:flex;align-items:center;' +
                          'justify-content:center;';
      const svg = src.querySelector('svg').cloneNode(true);
      svg.style.cssText = 'width:78px;height:78px;';
      box.appendChild(svg);
      wrap.appendChild(box);
      const lab = document.createElement('span');
      lab.textContent = s.replace('.capyui-', '');
      wrap.appendChild(lab);
      d.appendChild(wrap);
    }
    document.body.appendChild(d);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'qa/px-glyph-sheet.png' });
}
