async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(7000);
  const err = await page.evaluate(() => (window.__capy && window.__capy.state.lastError) || null);
  await page.screenshot({ path: 'qa/LENS-on-sydney.png' });
  await page.evaluate(() => { const s = window.__capy.state;
    s.noWide = true; s.noSplit = true; s.noShoulder = true; s.noVigTone = true; });
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'qa/LENS-off-sydney.png' });
  await page.evaluate(async (e) => { await fetch('/shot?name=lens-err.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify({ err: e })))) }) }, err);
}
