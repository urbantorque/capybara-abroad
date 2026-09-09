async page => {
  // ---- TRAP 2: IS THE LIVE RECORD LINE FURNITURE? ------------------------
  // Sixty seconds of ordinary play in each of the nineteen chapters, sampled
  // ten times a second, counting the frames on which `.capyui-rec` is up. The
  // question is not "does it ever appear" — it is whether a player who is
  // simply walking about is given a permanent counter, which is what nineteen
  // chapters of HUD furniture would look like. Any sample where the line is up
  // is also tagged with the id that was live, so a hit is attributable rather
  // than merely a number: the Pantanal cowbird was found exactly this way, up
  // on 60 samples out of 60 while the animal stood still on its spawn.
  const KEYS = ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9',
                'Digit0','Minus','Equal','BracketLeft','BracketRight','Semicolon','Quote',
                'Comma','Period','Slash'];
  await page.reload();
  await page.waitForTimeout(5000);
  const names = await page.evaluate(async () => {
    const src = await (await fetch('/src/shared.js', { cache: 'no-store' })).text();
    const i = src.indexOf('export const CHAPTERS = [');
    const j = src.indexOf('\n];', i);
    const keys = [];
    for (const m of src.slice(i, j).matchAll(/\bbiome:\s*'([a-z]+)'/g)) keys.push(m[1]);
    return keys;
  });
  const out = [];
  for (let i = 0; i < names.length; i++) {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5000);
    await page.keyboard.press(KEYS[i]);
    await page.waitForTimeout(3000);
    // the sampler, and a tap on the channel so a hit can be named
    await page.evaluate(() => {
      const g = window.__capy;
      window.__b6 = { n: 0, up: 0, ids: {}, live: '' };
      const raw = g.recordLive;
      g.recordLive = function (id, v) { window.__b6.live = id; return raw.call(g, id, v); };
      window.__b6t = setInterval(function () {
        const el = document.querySelector('.capyui-rec');
        const s = window.__b6;
        s.n++;
        if (el && el.classList.contains('on')) {
          s.up++;
          s.ids[s.live] = (s.ids[s.live] || 0) + 1;
        }
      }, 100);
    });
    // sixty seconds of ordinary play: walk, turn, walk, hop. Real key events,
    // real clock — the whole point is that this is what a player does.
    for (let r = 0; r < 6; r++) {
      await page.keyboard.down('KeyW'); await page.waitForTimeout(3000);
      await page.keyboard.down('KeyD'); await page.waitForTimeout(1000);
      await page.keyboard.up('KeyD');
      await page.keyboard.press('Space'); await page.waitForTimeout(2000);
      await page.keyboard.up('KeyW');
      await page.keyboard.down('KeyA'); await page.waitForTimeout(1500);
      await page.keyboard.up('KeyA');
      await page.keyboard.down('KeyS'); await page.waitForTimeout(1500);
      await page.keyboard.up('KeyS');
      await page.waitForTimeout(1000);
    }
    const s = await page.evaluate(() => {
      clearInterval(window.__b6t);
      const g = window.__capy;
      return { s: window.__b6, biome: g.biome.current,
               err: (g.state.lastError && String(g.state.lastError)) || '' };
    });
    out.push({ n: i + 1, chapter: names[i], got: s.biome,
               samples: s.s.n, up: s.s.up, ids: s.s.ids, err: s.err });
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b6-soak.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
