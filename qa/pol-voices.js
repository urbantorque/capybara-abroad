async page => {
  // HEARING THE GAME HEADLESSLY, AND THE INSTRUMENT THAT DID NOT WORK.
  //
  // The hand-driven game.tick() loop never unlocks the AudioContext, so an
  // entire class of audio bug is invisible to it. This uses real mouse and key
  // events and the page's own clock.
  //
  // The FIRST version of this probe measured peak amplitude on the master bus
  // over the four seconds after each cue and compared it against two seconds of
  // baseline. It measured nothing: the score is playing underneath, its own
  // peaks run 0.13 to 0.40, and seven of seventeen voices came back with a
  // NEGATIVE lift purely because of what the music happened to be doing. Suspect
  // the harness before the code.
  //
  // What is measured instead is the GRAPH. sfx() runs synchronously, so the
  // nodes a voice creates and the connections it makes into the master bus can
  // both be counted across the call itself, with the score contributing nothing
  // because the score is not being asked for anything on that line. A voice that
  // throws half way through builds a short graph and is caught; a voice that
  // silently does nothing makes no connections at all.
  //
  // AND IT MATTERS THAT IT IS COUNTED, because sfx() wraps every generator in a
  // try/catch that SWALLOWS the error on purpose ("audio node budget
  // exhausted - ignore"). A voice that throws on its first line is therefore
  // completely silent AND completely invisible; the node count is the only
  // thing that can tell the difference between that and a working one.
  //
  // Note connections are counted GLOBALLY rather than into acMaster: sfx()
  // rebinds acMaster to a per-call panner bus for the duration of the call, so
  // nothing a generator builds ever touches the node that reaches the
  // destination. The first version of this probe looked for that and reported
  // zero for all seventeen, which is a fact about sfx() and not about them.
  await page.reload();
  await page.evaluate(() => {
    window.__tap = { master: null, ac: null, nodes: 0, conns: 0 };
    const origConnect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest) {
      try {
        const ctx = this.context;
        if (ctx && dest === ctx.destination && !window.__tap.master) {
          window.__tap.master = this;
          window.__tap.ac = ctx;
        }
        window.__tap.conns++;
      } catch (e) { /* a tap that fails must never break the game */ }
      return origConnect.apply(this, arguments);
    };
    for (const k of ['createOscillator', 'createGain', 'createBufferSource',
                     'createBiquadFilter', 'createConstantSource']) {
      const o = AudioContext.prototype[k];
      if (!o) continue;
      AudioContext.prototype[k] = function () { window.__tap.nodes++; return o.apply(this, arguments); };
    }
  });
  await page.waitForTimeout(5000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(1500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);

  const NAMES = ['higurashi', 'shishi', 'bonsho', 'muezzin', 'darbuka', 'cart',
                 'mahjong', 'cleaver', 'tram', 'pigeons', 'lap', 'campanile',
                 'vendor', 'bowls', 'cicada', 'magpie', 'lorikeet'];
  const out = {};
  out.acState = await page.evaluate(() => window.__tap.ac ? window.__tap.ac.state : 'no-tap');
  out.started = await page.evaluate(() => !!(window.__capy && window.__capy.state.started));
  out.hidden = await page.evaluate(() => document.hidden);
  out.rows = [];

  for (const n of NAMES) {
    const row = await page.evaluate((name) => {
      const g = window.__capy, T = window.__tap;
      if (!T.master) return { name, err: 'no master bus found' };
      const n0 = T.nodes, c0 = T.conns;
      let err = null;
      try { g.sfx(name, { volume: 0.9, pitch: 1, force: true }); }
      catch (e) { err = String(e && e.message || e); }
      return { name, err, nodes: T.nodes - n0, wired: T.conns - c0,
               lastError: g.state.lastError ? String(g.state.lastError) : null };
    }, n);
    out.rows.push(row);
    await page.waitForTimeout(700);
  }
  await page.evaluate((o) => fetch('/shot?name=pol-voices.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
