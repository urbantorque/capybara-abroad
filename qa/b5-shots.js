async page => {
  // ---- THE NINETEEN-CHAPTER VISUAL BASELINE (batch 5, job 1c) -------------
  // Entered through the GAME'S OWN PICKER — 1-9, 0, then the sysPICK_EXTRA
  // row — so what is photographed is what a player gets, arrival camera and
  // all. Not biome.switchTo, which skips the arrival, and NOT toDataURL:
  // harness trap 12 says a manual setSize plus a single tick gives a stretched
  // projection and a camera caught mid-transition, which looks exactly like a
  // camera bug and is not one. page.screenshot composites a real rAF frame.
  //
  // The same script takes the before and the after — only this one word
  // changes between them, so nothing else can drift. `process` does not exist
  // inside run-code and neither does an argument, so it is a literal.
  const TAG = 'after';
  const KEYS = ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9',
                'Digit0','Minus','Equal','BracketLeft','BracketRight','Semicolon','Quote',
                'Comma','Period','Slash'];
  // Derived from CHAPTERS, never spelled — see the note in qa/route.js.
  await page.reload();
  await page.waitForTimeout(5000);
  const names = await page.evaluate(async () => {
    const src = await (await fetch('/src/shared.js', { cache: 'no-store' })).text();
    const i = src.indexOf('export const CHAPTERS = [');
    if (i < 0) throw new Error('b5-shots: CHAPTERS not found — this audit has gone stale');
    const j = src.indexOf('\n];', i);
    const keys = [];
    for (const m of src.slice(i, j).matchAll(/\bbiome:\s*'([a-z]+)'/g)) keys.push(m[1]);
    return keys;
  });
  const log = [];
  for (let i = 0; i < names.length; i++) {
    // Fresh title card every time, and a cleared save — a chapter entered from
    // inside another chapter arrives through the crossing rather than through
    // the picker, and the save decides whether a digit resumes or starts.
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5000);
    await page.keyboard.press(KEYS[i]);
    // rAF settles: the arrival card, the white, the fog swap and the camera
    // spring are all still moving at 3 s. Six.
    await page.waitForTimeout(6000);
    const n2 = String(i + 1).padStart(2, '0');
    await page.screenshot({ path: 'qa/B5-' + n2 + '-' + names[i] + '-' + TAG + '.png' });
    // ...and the same standstill with the eye-raise held. The at-rest pair is
    // the REGRESSION — nothing about the idle rig moved, and the two shots
    // should be the same picture — and this one is the payoff.
    if (TAG !== 'before') {
      await page.keyboard.down('KeyV');
      await page.waitForTimeout(2600);
      await page.screenshot({ path: 'qa/B5-' + n2 + '-' + names[i] + '-raise.png' });
      await page.keyboard.up('KeyV');
      await page.waitForTimeout(400);
    }
    const st = await page.evaluate(() => {
      const g = window.__capy;
      return { biome: g.biome.current, started: g.state.started,
               err: (g.state.lastError && String(g.state.lastError)) || '' };
    });
    log.push({ n: i + 1, want: names[i], got: st.biome, started: st.started, err: st.err });
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b5-shots-' + o.tag + '.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o.log, null, 1)))) });
  }, { tag: TAG, log: log });
}
