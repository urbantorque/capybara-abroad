async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await wait(7000);
  await page.keyboard.press('Digit1');
  await wait(5000);
  await page.evaluate(() => {
    const l = document.querySelector('.capyui-touch');
    if (l) l.classList.add('on');
    return true;
  });
  await wait(800);
  const out = await page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    return Array.from(document.querySelectorAll('.capyui-btn')).map(function (b) {
      const r = b.getBoundingClientRect();
      const cs = getComputedStyle(b);
      return { label: b.getAttribute('aria-label'),
               x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
               onScreen: r.x > -1 && r.y > -1 && r.right <= vw + 1 && r.bottom <= vh + 1,
               op: cs.opacity, vis: cs.visibility, z: cs.zIndex, bg: cs.backgroundColor };
    });
  });
  await page.screenshot({ path: 'qa/F4-touch2.png' });
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f4-touch2.json', { method: 'POST', body: s }), bl);
}
