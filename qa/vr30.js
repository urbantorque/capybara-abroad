async page => {
  const KEYS = ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9',
                'Digit0','Minus','Equal','BracketLeft','BracketRight','Semicolon','Quote',
                'Comma','Period','Slash'];
  const NAMES = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                 'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic',
                 'monaco','hanoi'];
  const out = [];
  for (let i = 0; i < 19; i++) {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5200);
    await page.keyboard.press(KEYS[i]);
    await page.waitForTimeout(7000);
    const n2 = String(i + 1).padStart(2, '0');
    await page.screenshot({ path: 'qa/VR30-' + n2 + '-' + NAMES[i] + '.png' });
    const row = await page.evaluate(() => {
      const g = window.__capy;
      const r = g.renderer.info.render;
      return { biome: g.biome && g.biome.current, calls: r.calls, tris: r.triangles,
               err: g.state.lastError || null };
    });
    row.want = NAMES[i];
    out.push(row);
  }
  await page.evaluate(o => {
    const b = btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1))));
    return fetch('/shot?name=vr30.json', { method: 'POST', body: b });
  }, out);
}
