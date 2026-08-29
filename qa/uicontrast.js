async page => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(5000);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1800);
  const out = await page.evaluate(() => {
    function parse(c) {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(',').map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    }
    function over(fg, bg) {
      const a = fg.a;
      return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a),
               b: fg.b * a + bg.b * (1 - a), a: 1 };
    }
    function lum(c) {
      const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    }
    function ratio(a, b) {
      const l1 = lum(a), l2 = lum(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }
    const rows = [];
    document.querySelectorAll('.capyui-pick').forEach(el => {
      const body = el.querySelector('.capyui-pickbody');
      const name = el.querySelector('b');
      const sub = el.querySelector('i');
      if (!body || !name) return;
      const tileBg = parse(getComputedStyle(el).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
      const pt = parse((getComputedStyle(el).getPropertyValue('--pt') || '').trim());
      const bg = pt ? over(pt, tileBg) : tileBg;    // worst case: the top of the wash
      const nc = over(parse(getComputedStyle(name).color), bg);
      const sc = over(parse(getComputedStyle(sub).color), bg);
      rows.push({ name: name.textContent.slice(0, 14),
                  fontPx: +getComputedStyle(sub).fontSize.replace('px', ''),
                  nameRatio: +ratio(nc, bg).toFixed(2),
                  subRatio: +ratio(sc, bg).toFixed(2) });
    });
    return rows;
  });
  await page.evaluate(o => fetch('/shot?name=uicontrast.json', {
    method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
