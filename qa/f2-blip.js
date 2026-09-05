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
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const B = window.BaseAudioContext.prototype;
    const raw = {};
    let n = 0, byKind = {};
    for (const k of ['createOscillator', 'createGain', 'createBiquadFilter', 'createBufferSource']) {
      raw[k] = B[k];
      B[k] = function () { n++; byKind[k] = (byKind[k] || 0) + 1; return raw[k].apply(this, arguments); };
    }
    // SYNCHRONOUS window only: the synth builds every node inside the call, so
    // nothing else in the frame can get into the count.
    const one = (streak) => {
      n = 0; byKind = {};
      g.sfx('blip', { volume: 0.26, pitch: 1, streak: streak, force: true,
                      at: { x: g.capy.position.x, y: 1, z: g.capy.position.z } });
      return { streak: streak, nodes: n, byKind: Object.assign({}, byKind) };
    };
    const rows = [one(2), one(3), one(2)];
    // ...and through the real door. sayBubble is the only place a line goes.
    const live = g.biome.current;
    const L = (g.locals || []).find(x => x.biome === live && x.anchor && x.anchor.speak);
    let viaSpeak = null;
    if (L) {
      n = 0; byKind = {};
      L.anchor.speak('Do not.');
      viaSpeak = { nodes: n, byKind: Object.assign({}, byKind), vpitch: +(+L.vpitch).toFixed(3) };
    }
    let viaSpeakLong = null;
    if (L) {
      // a second, longer line from the same person — 3 pulses, not 2
      n = 0; byKind = {};
      L.anchor.speak('I said we should have gone to Bondi, honestly.');
      viaSpeakLong = { nodes: n, byKind: Object.assign({}, byKind) };
    }
    for (const k in raw) B[k] = raw[k];
    return { rows: rows, viaSpeak: viaSpeak, viaSpeakLong: viaSpeakLong,
             locals: (g.locals || []).filter(x => x.biome === live).length };
  });
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f2-blip.json', { method: 'POST', body: s }), bl);
}
