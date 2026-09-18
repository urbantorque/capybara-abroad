async page => {
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(6000);
  await page.evaluate(() => document.querySelector('.capyui-go').click());
  await page.waitForTimeout(3000);
  const res = await page.evaluate(() => {
    const g = window.__capy;
    // settle first, same pattern as qa/l9-yuzu-visible-live.js
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false);
    const wEl = document.querySelector('.capyui-wallet');
    const walletBefore = wEl.textContent;
    const rec = g.state.qaSpawnDrop('yuzugold');
    const p = rec.prop;
    const cp = g.capy.body.position;
    p.body.position.set(cp.x, cp.y + 0.1, cp.z);
    p.body.velocity.set(0, 0, 0);
    p.body.previousPosition.copy(p.body.position);
    if (p.body.interpolatedPosition) p.body.interpolatedPosition.copy(p.body.position);
    const samples = [];
    for (let i = 0; i < 40; i++) {
      g.tick(1 / 60, false);
      samples.push({ i, taken: !!p.dropTaken, big: wEl.classList.contains('big'), bump: wEl.classList.contains('bump'), text: wEl.textContent });
    }
    return { walletBefore, samples: samples.filter((s, i) => i === 0 || s.taken !== samples[i - 1].taken || s.big !== samples[i - 1].big), err: g.state.lastError || null };
  });
  await page.evaluate(async (o) => { await fetch('/shot?name=l10-verify-big2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, res);
}
