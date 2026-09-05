async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(3500);
  const cross = n => page.evaluate(function (n) {
    const g = window.__capy;
    try { g.hud.cross(n); } catch (e) { g.biome.switchTo(n); }
    return true;
  }, n);
  const out = {};

  // ---- 4: the merged wary/incident pools --------------------------------
  await cross('venice'); await wait(7000);
  out.pools = await page.evaluate(() => {
    const g = window.__capy, h = g;
    const rows = [];
    for (const b of ['venice', 'kowloon', 'monaco', 'antarctic']) {
      for (const k of ['wary', 'incident', 'startled', 'splash']) {
        rows.push(Object.assign({ kind: k }, h.sayAudit(k, b)));
      }
    }
    return rows;
  });

  // ---- 6: one voice per person ------------------------------------------
  out.voices = await page.evaluate(() => {
    const g = window.__capy;
    const live = g.biome.current;
    const vs = (g.locals || []).filter(L => L.biome === live).map(L => +(+L.vpitch).toFixed(3));
    const rs = (g.npcs || []).filter(r => r.vpitch !== undefined).map(r => +(+r.vpitch).toFixed(3));
    const all = vs.concat(rs);
    return { locals: vs.length, roster: rs.length, distinct: new Set(all).size,
             min: all.length ? Math.min.apply(null, all) : null,
             max: all.length ? Math.max.apply(null, all) : null,
             anyNaN: all.some(v => !(v === v)) };
  });

  // ---- 7: the blip, and its pulse count follows the line -----------------
  out.blip = await page.evaluate(async () => {
    const g = window.__capy;
    const B = window.BaseAudioContext && window.BaseAudioContext.prototype;
    let n = 0;
    const raw = {};
    for (const k of ['createOscillator', 'createGain', 'createBiquadFilter']) {
      raw[k] = B[k];
      B[k] = function () { n++; return raw[k].apply(this, arguments); };
    }
    const rows = [];
    for (const s of [2, 3]) {
      n = 0;
      g.sfx('blip', { volume: 0.26, pitch: 1, streak: s, force: true,
                      at: { x: g.capy.position.x, y: 1, z: g.capy.position.z } });
      await new Promise(r => setTimeout(r, 300));
      rows.push({ streak: s, nodes: n });
    }
    // ...and one through the real door: a person saying a line.
    n = 0;
    let spoke = false;
    const L = (g.locals || []).find(x => x.biome === g.biome.current && x.anchor && x.anchor.speak);
    if (L) { L.anchor.speak('Do not.'); spoke = true; }
    await new Promise(r => setTimeout(r, 300));
    rows.push({ streak: 'via speak()', nodes: n, spoke: spoke });
    for (const k in raw) B[k] = raw[k];
    return rows;
  });

  // (the Monaco ride is its own probe: qa/f2-mon.js)
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f2-check.json', { method: 'POST', body: s }), bl);
}
