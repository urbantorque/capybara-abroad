async page => {
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(6000);
  await page.keyboard.press('Space');
  await page.waitForTimeout(3500);
  const shots = ['kyoto', 'cali', 'antarctic', 'cave', 'iceland', 'hanoi'];
  for (const b of shots) {
    await page.evaluate((n) => { try { window.__capy.hud.cross(n); } catch (e) { window.__capy.biome.switchTo(n); } }, b);
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'qa/RV-shot-' + b + '.png' });
  }
  const errs = await page.evaluate(() => {
    const g = window.__capy;
    return { last: (g.state && g.state.lastError) || null, biome: g.biome.current, started: !!(g.state && g.state.started) };
  });
  await page.evaluate(async (payload) => {
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    await fetch('/shot?name=RV-SHOTS', { method: 'POST', body: b64 });
  }, errs);
}
