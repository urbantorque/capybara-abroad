async page => {
  const KEYS = ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9',
                'Digit0','Minus','Equal','BracketLeft','BracketRight','Semicolon','Quote',
                'Comma','Period','Slash'];
  const NAMES = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                 'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic',
                 'monaco','hanoi'];
  const errs = [];
  for (let i = 0; i < 19; i++) {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5200);
    await page.keyboard.press(KEYS[i]);
    await page.waitForTimeout(7000);
    const n2 = String(i + 1).padStart(2, '0');
    await page.screenshot({ path: 'qa/VA-' + n2 + '-' + NAMES[i] + '.png' });
    const e = await page.evaluate(() => {
      const g = window.__capy;
      return { b: g.biome && g.biome.current, err: g.state.lastError || null,
               post: g.post.enabled, p: JSON.parse(JSON.stringify(g.post.params)) };
    });
    errs.push({ want: NAMES[i], got: e });
  }
  await page.evaluate(async o => { await fetch('/shot?name=visafter.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, errs);
}
