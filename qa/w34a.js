async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  const out = {};
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  out.started = await page.evaluate(() => window.__capy.state.started);
  out.err0 = await page.evaluate(() => String(window.__capy.state.lastError));
  await page.waitForTimeout(1000);
  out.calmAtStart = await page.evaluate(() => window.__capy.state.calm);
  await page.waitForTimeout(12000);
  out.calmAfter12s = await page.evaluate(() => window.__capy.state.calm);
  out.stillT = await page.evaluate(() => window.__capy.capy.stillT);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyW');
  out.calmAfterStep = await page.evaluate(() => window.__capy.state.calm);
  out.err1 = await page.evaluate(() => String(window.__capy.state.lastError));
  await page.evaluate((o) => fetch('/shot?name=w34a.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
