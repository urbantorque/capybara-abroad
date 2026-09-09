async page => {
  // NINETY SECONDS PER CHAPTER, WITH A REAL CLOCK AND REAL KEYS, and a tally of
  // which voice actually fired.
  //
  // There is no name on an audio node, and the ambience ladder calls the
  // module-private sfx() rather than game.sfx, so there is nothing to wrap. The
  // one thing that DOES carry the name is the call stack: the bundle keeps its
  // function names, so an Error captured inside createOscillator names the
  // generator that asked for it. One Error per node at a cue every few seconds
  // costs nothing and it is the only name-resolved counter available here.
  const CH = [['Digit1', 'sydney'], ['Digit4', 'kyoto'], ['Digit8', 'sahara'],
              ['Digit0', 'venice'], ['Minus', 'kowloon'], ['Slash', 'hanoi']];
  const out = [];
  for (const [key, name] of CH) {
    await page.reload();
    await page.evaluate(() => {
      window.__tally = {};
      window.__tapAc = { ac: null };
      const origConnect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function () {
        try { if (!window.__tapAc.ac && this.context) window.__tapAc.ac = this.context; } catch (e) { /* never break the game */ }
        return origConnect.apply(this, arguments);
      };
      for (const k of ['createOscillator', 'createBufferSource']) {
        const o = AudioContext.prototype[k];
        if (!o) continue;
        AudioContext.prototype[k] = function () {
          try {
            const st = new Error().stack || '';
            const m = st.match(/sfx[A-Z]\w+/g);
            if (m && m.length) {
              const nm = m[0];
              window.__tally[nm] = (window.__tally[nm] || 0) + 1;
            }
          } catch (e) { /* never break the game for a counter */ }
          return o.apply(this, arguments);
        };
      }
    });
    await page.waitForTimeout(5000);
    // THE CHAPTER KEY AND NOTHING BEFORE IT.
    //
    // A digit pressed on the TITLE CARD starts the game in that chapter; the
    // same digit once the game is already running does nothing at all. Two runs
    // of this probe were thrown away learning that. The first pressed Enter
    // first; the second replaced Enter with a mouse click, which also starts
    // the game — so both times five of the six chapters soaked for ninety
    // seconds in SYDNEY under the right chapter's name. The key press is itself
    // a user gesture, so it unlocks the AudioContext too and nothing before it
    // is needed; acState is reported per chapter to prove that.
    await page.keyboard.press(key);
    await page.waitForTimeout(6000);
    // clear the tally so the title screen and the switch are not counted
    await page.evaluate(() => { window.__tally = {}; });
    // ninety seconds of the page's own clock, with the animal walking about so
    // the positional half of sysAmb has something to do
    for (let i = 0; i < 9; i++) {
      const k2 = ['KeyW', 'KeyA', 'KeyD', 'KeyS'][i % 4];
      await page.keyboard.down(k2);
      await page.waitForTimeout(2500);
      await page.keyboard.up(k2);
      await page.waitForTimeout(7500);
    }
    const r = await page.evaluate((want) => {
      const g = window.__capy;
      const T = window.__tapAc;
      return { want, biome: g.biome && g.biome.current,
               acState: T && T.ac ? T.ac.state : 'none',
               lastError: g.state.lastError ? String(g.state.lastError) : null,
               tally: window.__tally };
    }, name);
    out.push(r);
  }
  await page.evaluate((o) => fetch('/shot?name=pol-amb.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
