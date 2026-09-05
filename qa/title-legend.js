async page => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://localhost:5188/');
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6500);
  const m = await page.evaluate(() => {
    const r = s => { const e = document.querySelector(s); if (!e) return null;
      const b = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      return { l: Math.round(b.left), w: Math.round(b.width),
        maxW: cs.maxWidth, ta: cs.textAlign, ml: cs.marginLeft, mr: cs.marginRight,
        disp: cs.display }; };
    const first = document.querySelector('.capyui-p1 .capyui-legend kbd');
    return { label: r('.capyui-p1 .capyui-label'), legend: r('.capyui-p1 .capyui-legend'),
      firstKbd: first ? Math.round(first.getBoundingClientRect().left) : -1,
      card: r('.capyui-card') };
  });
  await page.evaluate(o => { document.title = JSON.stringify(o); }, m);
}
