async page => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(5000);
  const r = await page.evaluate(() => {
    const t = document.querySelector('.capyui-title');
    const c = document.querySelector('.capyui-card');
    const before = t.scrollWidth;
    const s = document.createElement('style');
    s.textContent = '.capyui-card:not(.two):before{display:none!important}';
    document.head.appendChild(s);
    const after = t.scrollWidth;
    s.remove();
    // and which child is actually the wide one
    const kids = [];
    c.querySelectorAll('*').forEach(el => {
      const b = el.getBoundingClientRect();
      if (b.right > window.innerWidth + 1 || b.left < -1) {
        kids.push({ cls: el.className || el.tagName, l: Math.round(b.left), r: Math.round(b.right) });
      }
    });
    return { win: window.innerWidth, before, after, over: kids.slice(0, 6) };
  });
  await page.evaluate(o => fetch('/shot?name=uiwide.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), r);
}
