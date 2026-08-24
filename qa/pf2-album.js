async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 4500)));
  await page.keyboard.press('Digit1');
  await page.evaluate(() => new Promise(r => setTimeout(r, 3500)));
  const out = {};

  out.before = await page.evaluate(() => window.__capy.hud.albumAudit());

  // Take three pictures: K to raise the camera, Enter to keep, K to lower.
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('KeyK');
    await page.evaluate(() => new Promise(r => setTimeout(r, 700)));
    await page.keyboard.press('Enter');
    await page.evaluate(() => new Promise(r => setTimeout(r, 700)));
    await page.keyboard.press('KeyK');
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
    // walk a little so the pictures are not identical
    await page.keyboard.down('KeyW');
    await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
    await page.keyboard.up('KeyW');
    await page.evaluate(() => new Promise(r => setTimeout(r, 400)));
  }
  out.afterThree = await page.evaluate(() => window.__capy.hud.albumAudit());

  // Does it SURVIVE? Reload and ask again. No addInitScript anywhere in this
  // script, because that would wipe the very thing under test (harness trap 10).
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 4500)));
  await page.keyboard.press('Digit1');
  await page.evaluate(() => new Promise(r => setTimeout(r, 3000)));
  out.afterReload = await page.evaluate(() => window.__capy.hud.albumAudit());

  // Does the card open, and does it actually contain <img> elements with data?
  out.card = await page.evaluate(() => {
    window.__capy.hud.albumShow();
    const el = document.querySelector('.capyui-alb');
    const imgs = el ? el.querySelectorAll('.capyui-albshot img') : [];
    const first = imgs[0];
    return {
      shown: !!(el && el.classList.contains('show')),
      paused: !!window.__capy.state.paused,
      figs: el ? el.querySelectorAll('.capyui-albshot').length : 0,
      firstSrcHead: first ? String(first.src).slice(0, 24) : null,
      firstCap: el && el.querySelector('.capyui-albshot figcaption')
        ? el.querySelector('.capyui-albshot figcaption').textContent : null,
      sub: el && el.querySelector('.capyui-ledsub') ? el.querySelector('.capyui-ledsub').textContent : null
    };
  });
  // ...and do the images actually decode? A dataURL that is not a real JPEG
  // renders as a broken image and the grid still looks populated.
  await page.evaluate(() => new Promise(r => setTimeout(r, 900)));
  out.decoded = await page.evaluate(() => {
    const imgs = document.querySelectorAll('.capyui-alb .capyui-albshot img');
    let ok = 0, bad = 0, dims = [];
    imgs.forEach(function (im) {
      if (im.naturalWidth > 0 && im.naturalHeight > 0) { ok++; if (dims.length < 2) dims.push(im.naturalWidth + 'x' + im.naturalHeight); }
      else bad++;
    });
    return { ok: ok, bad: bad, dims: dims };
  });
  // Escape must close it and unpause.
  await page.keyboard.press('Escape');
  await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
  out.afterEsc = await page.evaluate(() => {
    const el = document.querySelector('.capyui-alb');
    return { shown: !!(el && el.classList.contains('show')), paused: !!window.__capy.state.paused };
  });
  out.err = await page.evaluate(() => {
    const g = window.__capy; return g.state.lastError ? String(g.state.lastError) : null;
  });
  const b = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=pf2-album.json', { method: 'POST', body: s }), b);
}
