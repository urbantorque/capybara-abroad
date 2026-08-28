async page => {
  // THE TOP-UP. Three of the seventeen — higurashi, the pigeons and the magpie
  // — did not come up in the ninety-second sweep, which is what a one-in-five
  // branch on a ten-to-thirty-second timer does about a fifth of the time. Same
  // instrument, longer window, and STANDING STILL: Kyoto's rung is positional
  // and the walking sweep spent most of it in the grove and on the river, which
  // are the two branches that do not contain the cicada.
  const CH = [['Digit4', 'kyoto']];
  const out = [];
  for (const [key, name] of CH) {
    await page.reload();
    await page.evaluate(() => {
      window.__tally = {};
      for (const k of ['createOscillator', 'createBufferSource']) {
        const o = AudioContext.prototype[k];
        if (!o) continue;
        AudioContext.prototype[k] = function () {
          try {
            const st = new Error().stack || '';
            const m = st.match(/sfx[A-Z]\w+/g);
            if (m && m.length) window.__tally[m[0]] = (window.__tally[m[0]] || 0) + 1;
          } catch (e) { /* never break the game for a counter */ }
          return o.apply(this, arguments);
        };
      }
    });
    await page.waitForTimeout(5000);
    await page.keyboard.press(key);
    await page.waitForTimeout(6000);
    // ...AND WALK OUT OF THE RIVER FIRST. Kyoto's rung is positional and the
    // spawn sits inside its onRiver band, whose branch contains no cicada at
    // all: two windows came back with a full tally and no higurashi in it,
    // which was a fact about where the animal was standing.
    await page.keyboard.down('KeyS');
    await page.waitForTimeout(6000);
    await page.keyboard.up('KeyS');
    await page.waitForTimeout(1500);
    await page.evaluate(() => { window.__tally = {}; });
    for (let i = 0; i < 20; i++) await page.waitForTimeout(10000);
    const r = await page.evaluate((want) => {
      const g = window.__capy;
      return { want, biome: g.biome && g.biome.current,
               lastError: g.state.lastError ? String(g.state.lastError) : null,
               tally: window.__tally };
    }, name);
    out.push(r);
  }
  await page.evaluate((o) => fetch('/shot?name=pol-amb2.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
