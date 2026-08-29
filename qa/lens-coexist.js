async page => {
  const KEYS = { sydney: 'Digit1', iceland: 'Digit7', kowloon: 'Minus',
                 goreme: 'BracketLeft', monaco: 'Period' };
  const out = [];
  for (const name in KEYS) {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5200);
    await page.keyboard.press(KEYS[name]);
    await page.waitForTimeout(7000);
    const r = await page.evaluate((n) => {
      const g = window.__capy, p = g.post.params;
      return { want: n, got: g.biome && g.biome.current, post: g.post.enabled,
               err: g.state.lastError || null,
               wide: +p.wide.toFixed(3), splitW: +p.splitW.toFixed(4),
               splitC: +p.splitC.toFixed(4), shoulder: p.shoulder, vigTone: p.vigTone };
    }, name);
    out.push(r);
    await page.screenshot({ path: 'qa/CX-' + name + '.png' });
  }
  await page.evaluate(async o => { await fetch('/shot?name=coexist.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out);
}
