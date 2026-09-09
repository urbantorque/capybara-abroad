async page => {
  const out = { seq: [] };
  const K = code => page.evaluate(c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true })), code);
  const read = tag => page.evaluate(t => {
    const ph = document.querySelector('.capyui-photo');
    let shots = -1;
    try { const o = JSON.parse(localStorage.getItem('capy3.album.v1') || '{}'); shots = (o.shots || []).length } catch (e) { }
    return [t, !!(ph && ph.classList.contains('show')), shots,
            !!window.__capy.state.paused, document.hasFocus(), document.visibilityState];
  }, tag);
  await page.evaluate(() => { try { localStorage.removeItem('capy3.album.v1') } catch (e) { } });
  for (let i = 0; i < 4; i++) { await K('KeyK'); out.seq.push(await read('K' + i)); }
  // now a shot, then more toggles
  await K('KeyK'); out.seq.push(await read('openForShot'));
  await K('Enter'); await page.waitForTimeout(600); out.seq.push(await read('afterShot1'));
  await K('KeyK'); out.seq.push(await read('closeAfterShot'));
  await K('KeyK'); out.seq.push(await read('openAgain'));
  await K('Enter'); await page.waitForTimeout(600); out.seq.push(await read('afterShot2'));
  // is the listener still alive at all? P is in the same handler
  out.pBefore = await page.evaluate(() => { const ph = document.querySelector('.capyui-photo'); return ph.parentElement.classList.contains('bare') });
  await K('KeyP');
  out.pAfter = await page.evaluate(() => { const ph = document.querySelector('.capyui-photo'); return ph.parentElement.classList.contains('bare') });
  // and does a plain movement key still register?
  out.inputBefore = await page.evaluate(() => JSON.stringify(window.__capy.input));
  await K('KeyW');
  out.inputAfter = await page.evaluate(() => JSON.stringify(window.__capy.input));
  await page.evaluate(async o => {
    await fetch('/shot?name=b4fz-8.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out);
}
