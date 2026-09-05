async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(7000);
  const out = {};
  out.isTouch = await page.evaluate(() =>
    !!(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches));
  out.title = await page.evaluate(() => {
    const foot = document.querySelector('.capyui-footnote');
    const caps = Array.from(document.querySelectorAll('.capyui-legend kbd')).map(e => e.textContent.trim());
    return { note: foot ? foot.textContent.trim() : null, caps: caps.slice(0, 14) };
  });
  // START WITH A TAP, NOT A KEY: the touch layer's `.on` class is removed on
  // the first keydown, so an Enter here measures a fan that is display:none.
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.capyui-go, button'))
      .find(e => /begin/i.test(e.textContent || ''));
    if (b) b.click();
    return !!b;
  });
  await wait(4000);
  out.buttons = await page.evaluate(() => {
    const rows = [];
    for (const cls of ['capyui-wheek', 'capyui-grab', 'capyui-hop', 'capyui-slide',
                       'capyui-back', 'capyui-menu', 'capyui-look']) {
      const b = document.querySelector('.capyui-btn.' + cls);
      if (!b) { rows.push({ cls: cls, missing: true }); continue; }
      const br = b.getBoundingClientRect();
      const g = b.querySelector('.capyui-g');
      const gr = g ? g.getBoundingClientRect() : null;
      rows.push({ cls: cls,
                  btn: [Math.round(br.width), Math.round(br.height)],
                  glyph: gr ? [Math.round(gr.width), Math.round(gr.height)] : null,
                  // how far the mark's centre is from the button's, in px
                  offX: gr ? +(((gr.left + gr.right) / 2) - ((br.left + br.right) / 2)).toFixed(2) : null,
                  offY: gr ? +(((gr.top + gr.bottom) / 2) - ((br.top + br.bottom) / 2)).toFixed(2) : null,
                  gbg: g ? getComputedStyle(g).getPropertyValue('--capyui-gbg').trim() : null });
    }
    return rows;
  });
  await page.screenshot({ path: 'qa/F1-touch-fan.png' });
  // ...and the touch legend, which lives in the journal on a phone.
  out.legend = await page.evaluate(() => {
    const g = window.__capy;
    try { g.hud.journal ? g.hud.journal() : null; } catch (e) {}
    return null;
  });
  await page.keyboard.press('Tab');
  await wait(1200);
  out.journalRows = await page.evaluate(() => {
    const el = document.querySelector('.capyui-jr');
    if (!el) return null;
    const caps = Array.from(el.querySelectorAll('.capyui-legend kbd')).map(e => e.textContent.trim());
    return caps;
  });
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f1-touch.json', { method: 'POST', body: s }), bl);
}
