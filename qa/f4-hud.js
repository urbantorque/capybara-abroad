async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(5000);
  // Every font-size in the sheet went through a regex; this is the look at the
  // whole HUD that says the rewrite produced a sheet and not a mess.
  const sizes = await page.evaluate(() => {
    const pick = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).fontSize : null; };
    return { todoHead: pick('.capyui-todo h2'), todoTxt: pick('.capyui-txt'),
             clue: pick('.capyui-clue'), count: pick('.capyui-count'),
             toast: pick('.capyui-toast'), mapdist: pick('.capyui-mapdist'),
             t: document.getElementById('hud').style.getPropertyValue('--capyui-t'),
             bad: Array.from(document.querySelectorAll('#hud *'))
                   .filter(e => { const f = getComputedStyle(e).fontSize;
                                  return f && (f === '0px' || parseFloat(f) > 60); }).length };
  });
  await page.screenshot({ path: 'qa/F4-hud-1440.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await wait(1200);
  await page.screenshot({ path: 'qa/F4-hud-390.png' });
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), sizes);
  await page.evaluate(s => fetch('/shot?name=f4-hud.json', { method: 'POST', body: s }), bl);
}
