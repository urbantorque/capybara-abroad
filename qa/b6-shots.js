async page => {
  // ---- THE NINETEEN ARRIVALS (batch 6, job 2b) ----------------------------
  // Entered through the game's own picker, exactly as qa/b5-shots.js does, so
  // what is photographed is the frame a player is actually handed. Two shots
  // per chapter:
  //   -arr  at 2.0 s: the place card is up and the arrival framing is at full
  //         weight. THIS is the shot being audited.
  //   -set  at 6.5 s: the shot has handed the lens back and the rig has
  //         settled. The pair is the proof that the framing LEAVES.
  // page.screenshot, never toDataURL — harness trap 12.
  const TAG = 'c';
  const KEYS = ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9',
                'Digit0','Minus','Equal','BracketLeft','BracketRight','Semicolon','Quote',
                'Comma','Period','Slash'];
  await page.reload();
  await page.waitForTimeout(5000);
  const names = await page.evaluate(async () => {
    const src = await (await fetch('/src/shared.js', { cache: 'no-store' })).text();
    const i = src.indexOf('export const CHAPTERS = [');
    if (i < 0) throw new Error('b6-shots: CHAPTERS not found — this audit has gone stale');
    const j = src.indexOf('\n];', i);
    const keys = [];
    for (const m of src.slice(i, j).matchAll(/\bbiome:\s*'([a-z]+)'/g)) keys.push(m[1]);
    return keys;
  });
  const log = [];
  for (let i = 0; i < names.length; i++) {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5000);
    await page.keyboard.press(KEYS[i]);
    await page.waitForTimeout(2000);
    const n2 = String(i + 1).padStart(2, '0');
    await page.screenshot({ path: 'qa/B6-' + n2 + '-' + names[i] + '-arr-' + TAG + '.png' });
    const mid = await page.evaluate(() => {
      const g = window.__capy;
      return { yaw: +g.input.camYaw.toFixed(3), shot: !!g.state.shotLive,
               x: +g.capy.position.x.toFixed(1), y: +g.capy.position.y.toFixed(1),
               z: +g.capy.position.z.toFixed(1) };
    });
    await page.waitForTimeout(4500);
    await page.screenshot({ path: 'qa/B6-' + n2 + '-' + names[i] + '-set-' + TAG + '.png' });
    const st = await page.evaluate(() => {
      const g = window.__capy;
      const el = document.querySelector('.capyui-rec');
      return { biome: g.biome.current, started: g.state.started,
               yaw: +g.input.camYaw.toFixed(3),
               recUp: !!(el && el.classList.contains('on')),
               recText: el ? el.textContent : '(none)',
               err: (g.state.lastError && String(g.state.lastError)) || '' };
    });
    log.push({ n: i + 1, want: names[i], got: st.biome, arrYaw: mid.yaw, setYaw: st.yaw,
               at: [mid.x, mid.y, mid.z], recUp: st.recUp, err: st.err });
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b6-shots-' + o.tag + '.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o.log, null, 1)))) });
  }, { tag: TAG, log: log });
}
