async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3500);
  const out = {};
  // What is ON THE PAPER at the very start of a fresh save?
  out.window = await page.evaluate(() => {
    const rows = document.querySelectorAll('.capyui-todo li, .capyui-todorow');
    const vis = [];
    rows.forEach(function (r) {
      const st = getComputedStyle(r);
      if (!r.hidden && st.display !== 'none' && st.visibility !== 'hidden' &&
          r.getBoundingClientRect().height > 0 && !r.classList.contains('done')) {
        vis.push((r.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70));
      }
    });
    return vis;
  });
  // The full HUD text, so the clue line under the pinned row is visible too
  out.paperText = await page.evaluate(() => {
    const el = document.querySelector('.capyui-todo') || document.querySelector('[class*=todo]');
    return el ? (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 400) : null;
  });
  out.legend = await page.evaluate(() => {
    const el = document.querySelector('.capyui-keys, .capyui-legend');
    return el ? (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300) : null;
  });
  await page.evaluate(o => fetch('/shot?name=pf2-firsthour.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
