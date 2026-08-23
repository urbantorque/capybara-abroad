async page => {
  await page.evaluate(() => {
    window.__errs = [];
    const oe = console.error;
    console.error = function () {
      window.__errs.push(Array.from(arguments).map(a => (a && a.stack) ? a.stack : String(a)).join(' ').slice(0, 400));
      oe.apply(console, arguments);
    };
  });
  await page.waitForFunction(() => !!window.__capy && !!window.__capy.drift, { timeout: 20000 });
  await page.keyboard.press('Digit9');
  await page.waitForTimeout(3000);
  // every voice this chapter reaches for, through the dispatcher, never bare
  await page.evaluate(async () => {
    const g = window.__capy;
    const names = ['chime', 'hiss', 'pop', 'splash', 'cheer', 'organ', 'tick', 'wheek', 'thud', 'horn'];
    for (const n of names) {
      for (const v of [0.05, 0.5, 1.0]) g.sfx(n, { volume: v, pitch: 0.5 });
      g.sfx(n);                      // and with no options at all
    }
  });
  await page.waitForTimeout(1500);
  // sit still long enough for the ambient bed to fire several times
  await page.waitForTimeout(42000);
  const mid = await page.evaluate(() => {
    const g = window.__capy;
    let ac = null;
    try { ac = (window.AudioContext || window.webkitAudioContext) ? 'ctor' : 'none'; } catch (e) {}
    return { errs: window.__errs.slice(0, 8), lastError: g.state.lastError || null, gravity: g.world.gravity.y };
  });
  // now LEAVE, and make sure the world's gravity comes back
  await page.evaluate(() => { window.__capy.biome.switchTo('sydney'); });
  await page.waitForTimeout(2500);
  const left = await page.evaluate(() => {
    const g = window.__capy;
    return { biome: g.biome.current, gravity: g.world.gravity.y, lastError: g.state.lastError || null };
  });
  // ...and going back in takes it away again
  await page.evaluate(() => { window.__capy.biome.switchTo('drift'); });
  await page.waitForTimeout(2000);
  const back = await page.evaluate(() => {
    const g = window.__capy;
    return { biome: g.biome.current, gravity: g.world.gravity.y };
  });
  await page.evaluate(() => { window.__capy.biome.switchTo('iceland'); });
  await page.waitForTimeout(2000);
  const out = await page.evaluate((o) => {
    const g = window.__capy;
    const r = Object.assign({}, o, {
      afterIceland: { biome: g.biome.current, gravity: g.world.gravity.y },
      errsFinal: window.__errs.slice(0, 10),
      errCount: window.__errs.length,
      lastError: g.state.lastError || null,
    });
    return r;
  }, { mid, left, back });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=audio-result.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
  return 'done';
}
