async page => {
  for (const [name, key] of [['kowloon','Minus'], ['monaco','Period']]) {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5200);
    await page.keyboard.press(key);
    await page.waitForTimeout(7000);
    await page.evaluate(async (n) => {
      const g = window.__capy;
      const c = g.canvas || g.renderer.domElement;
      const P = g.post.params;
      const keep = P.airLight;
      for (const [tag, v] of [['off', 0], ['on', keep]]) {
        P.airLight = v;
        g.post.render();
        await fetch('/shot?name=AIRLIT-' + n + '-' + tag,
                    { method: 'POST', body: c.toDataURL('image/png') });
      }
      P.airLight = keep;
    }, name);
  }
}
