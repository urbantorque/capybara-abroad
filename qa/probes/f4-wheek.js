async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(4000);
  // Wrap game.sfx and record every CALL and whether it survived the throttle.
  // Survival is measured by node creations across the call, synchronously —
  // the F2 lesson: a counter that spans an await catches every other voice.
  await page.evaluate(() => {
    const g = window.__capy;
    const B = window.BaseAudioContext.prototype;
    const rawO = B.createOscillator, rawB = B.createBufferSource;
    let n = 0;
    B.createOscillator = function () { n++; return rawO.apply(this, arguments); };
    B.createBufferSource = function () { n++; return rawB.apply(this, arguments); };
    const raw = g.sfx;
    window.__w = [];
    g.sfx = function (name, opts) {
      if (name !== 'wheek') return raw.apply(null, arguments);
      const before = n;
      const r = raw.apply(null, arguments);
      window.__w.push({ vol: opts && opts.volume !== undefined ? opts.volume : null,
                        pitch: opts && opts.pitch !== undefined ? opts.pitch : null,
                        placed: !!(opts && (opts.at || typeof opts.x === 'number')),
                        nodes: n - before });
      return r;
    };
    return true;
  });
  // Stand still long enough for the CALM variant to be the one capybara.js picks.
  await wait(6000);
  await page.evaluate(() => { window.__w.length = 0; return true; });
  await page.keyboard.press('KeyQ');
  await wait(900);
  const calm = await page.evaluate(() => ({ calls: window.__w.slice(),
                                            stillT: +(window.__capy.capy.stillT || 0).toFixed(1) }));
  // ...and again while moving, which is the loud one.
  await page.evaluate(() => { window.__w.length = 0; return true; });
  await page.keyboard.down('KeyW');
  await wait(1200);
  await page.keyboard.press('KeyQ');
  await wait(900);
  await page.keyboard.up('KeyW');
  const moving = await page.evaluate(() => ({ calls: window.__w.slice(),
                                              stillT: +(window.__capy.capy.stillT || 0).toFixed(1) }));
  const out = { calm, moving,
                err: await page.evaluate(() => window.__capy.state.lastError ? String(window.__capy.state.lastError) : null) };
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f4-wheek.json', { method: 'POST', body: s }), bl);
}
