async page => {
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(6000);
  await page.evaluate(() => document.querySelector('.capyui-go').click());
  await page.waitForTimeout(3000);
  const res = await page.evaluate(() => {
    const g = window.__capy;
    const rec = g.state.qaSpawnDrop('yuzugold');
    const p = rec.prop;
    const cp = g.capy.body.position;
    p.body.position.set(cp.x, cp.y + 0.1, cp.z);
    p.body.velocity.set(0, 0, 0);
    const samples = [];
    for (let i = 0; i < 6; i++) {
      g.tick(1 / 60, false);
      const wEl = document.querySelector('.capyui-wallet');
      samples.push({ i, taken: !!p.dropTaken, big: wEl.classList.contains('big'), bump: wEl.classList.contains('bump'), text: wEl.textContent, worth: p.dropWorth, kind: p.dropKind });
    }
    return { samples, err: g.state.lastError || null };
  });
  await page.evaluate(async (o) => { await fetch('/shot?name=l10-verify-big.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, res);
}
