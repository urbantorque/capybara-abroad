async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(3500);
  await page.evaluate(() => {
    const g = window.__capy;
    try { g.hud.cross('venice'); } catch (e) { g.biome.switchTo('venice'); }
    return true;
  });
  await wait(8000);
  await page.evaluate(() => {
    const B = window.BaseAudioContext.prototype;
    window.__raw = {}; window.__n = 0; window.__k = {};
    for (const k of ['createOscillator', 'createGain', 'createBiquadFilter']) {
      window.__raw[k] = B[k];
      B[k] = function () { window.__n++; window.__k[k] = (window.__k[k] || 0) + 1; return window.__raw[k].apply(this, arguments); };
    }
    return true;
  });
  const speak = (text) => page.evaluate(function (text) {
    const g = window.__capy;
    const live = g.biome.current;
    const L = (g.locals || []).find(x => x.biome === live && x.anchor && x.anchor.speak);
    if (!L) return { error: 'no speaker' };
    window.__n = 0; window.__k = {};
    L.anchor.speak(text);
    return { text: text, len: text.length, nodes: window.__n,
             byKind: Object.assign({}, window.__k), vpitch: +(+L.vpitch).toFixed(3) };
  }, text);
  const out = { rows: [] };
  // One second of quiet between each, comfortably over the 0.18 s gap, so the
  // throttle cannot be what is being measured.
  await wait(1200);
  out.rows.push(await speak('Do not.'));
  await wait(1200);
  out.rows.push(await speak('I said we should have gone to Bondi, honestly.'));
  await wait(1200);
  out.rows.push(await speak('Any news?'));
  // ...and prove the throttle is real: two in the same frame, second dropped.
  out.throttled = await page.evaluate(() => {
    const g = window.__capy;
    const live = g.biome.current;
    const L = (g.locals || []).find(x => x.biome === live && x.anchor && x.anchor.speak);
    window.__n = 0; L.anchor.speak('One.');
    const first = window.__n;
    window.__n = 0; L.anchor.speak('Two, immediately after.');
    return { first: first, second: window.__n };
  });
  await page.evaluate(() => {
    const B = window.BaseAudioContext.prototype;
    for (const k in window.__raw) B[k] = window.__raw[k];
    return true;
  });
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f2-blip2.json', { method: 'POST', body: s }), bl);
}
