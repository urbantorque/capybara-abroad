async page => {
  await page.reload(); await page.waitForTimeout(5500);
  await page.mouse.click(640, 400); await page.waitForTimeout(2200);
  const out = {};
  await page.keyboard.press('KeyK');
  await page.waitForTimeout(1400);
  out.wide = await page.evaluate(() => {
    const cap = document.querySelector('.capyui-pcap');
    const el = document.querySelector('.capyui-photo');
    return { scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
             capOverflow: cap.scrollWidth > cap.clientWidth,
             aria: el.getAttribute('aria-hidden'),
             tabular: getComputedStyle(cap.querySelector('i')).fontVariantNumeric };
  });
  await page.setViewportSize({ width: 375, height: 700 });
  await page.waitForTimeout(1200);
  out.narrow = await page.evaluate(() => {
    const cap = document.querySelector('.capyui-pcap');
    const hint = document.querySelector('.capyui-phint');
    return { scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
             capOverflow: cap.scrollWidth > cap.clientWidth + 1,
             hintOverflow: hint.scrollWidth > hint.clientWidth + 1 };
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(800);
  out.err = await page.evaluate(() => String(window.__capy.state.lastError));
  await page.evaluate((o) => fetch('/shot?name=w34ui.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
