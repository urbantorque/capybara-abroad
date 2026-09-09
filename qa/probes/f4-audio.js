async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(4000);
  const out = {};

  // ---- every new voice builds nodes, and none of them throws -------------
  // SYNCHRONOUS node counting (the F2 lesson) and force:true so the gap does
  // not decide the answer.
  out.voices = await page.evaluate(() => {
    const g = window.__capy;
    const B = window.BaseAudioContext.prototype;
    const raws = {};
    let n = 0;
    for (const k of ['createOscillator', 'createBufferSource', 'createGain', 'createBiquadFilter']) {
      raws[k] = B[k];
      B[k] = function () { n++; return raws[k].apply(this, arguments); };
    }
    const r = {};
    for (const name of ['geyser', 'berg', 'groan', 'fluff', 'purr', 'wheek', 'splash']) {
      const before = n;
      let threw = null;
      try { g.sfx(name, { volume: 0.5, pitch: 1, force: true }); } catch (e) { threw = String(e); }
      r[name] = { nodes: n - before, threw: threw };
    }
    for (const k in raws) B[k] = raws[k];
    return r;
  });

  // ---- the wheek is the animal's again, placed, and picks its row --------
  await wait(6500);   // let the calm row become the live one
  out.wheek = await page.evaluate(() => new Promise(res => {
    const g = window.__capy;
    const B = window.BaseAudioContext.prototype;
    const rawO = B.createOscillator;
    let n = 0;
    B.createOscillator = function () { n++; return rawO.apply(this, arguments); };
    const raw = g.sfx;
    const calls = [];
    g.sfx = function (name, opts) {
      if (name !== 'wheek') return raw.apply(null, arguments);
      const b = n;
      const v = raw.apply(null, arguments);
      calls.push({ vol: opts && opts.volume, pitch: opts && opts.pitch,
                   placed: !!(opts && opts.at), nodes: n - b });
      return v;
    };
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }));
    setTimeout(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', bubbles: true }));
      g.sfx = raw; B.createOscillator = rawO;
      res({ calls: calls, stillT: +(g.capy.stillT || 0).toFixed(1),
            chaos: +(g.state.chaos || 0).toFixed(2), blown: !!g.capy.blown });
    }, 500);
  }));

  // ---- the shimmer is about THIS chapter ---------------------------------
  out.prog = [];
  out.prog.push(await page.evaluate(() => ({ at: 'sydney fresh',
    biome: window.__capy.biome.current, shim: window.__capy.hud.mixAudit().shim, prog: window.__capy.hud.mixAudit().prog })));
  await page.evaluate(() => { window.__capy.completeTask('wheek'); window.__capy.completeTask('swim'); return true; });
  await wait(1200);
  out.prog.push(await page.evaluate(() => ({ at: 'two sydney rows done',
    biome: window.__capy.biome.current, shim: window.__capy.hud.mixAudit().shim, prog: window.__capy.hud.mixAudit().prog })));
  await page.evaluate(() => { window.__capy.biome.switchTo('rio'); return true; });
  await wait(3000);
  out.prog.push(await page.evaluate(() => ({ at: 'arrived in rio',
    biome: window.__capy.biome.current, shim: window.__capy.hud.mixAudit().shim, prog: window.__capy.hud.mixAudit().prog })));

  out.err = await page.evaluate(() => window.__capy.state.lastError ? String(window.__capy.state.lastError) : null);
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f4-audio.json', { method: 'POST', body: s }), bl);
}
