async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 4500)));
  await page.keyboard.press('Digit1');
  await page.evaluate(() => new Promise(r => setTimeout(r, 3500)));
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('KeyK');
    await page.evaluate(() => new Promise(r => setTimeout(r, 650)));
    await page.keyboard.press('Enter');
    await page.evaluate(() => new Promise(r => setTimeout(r, 650)));
    await page.keyboard.press('KeyK');
    await page.evaluate(() => new Promise(r => setTimeout(r, 400)));
    await page.keyboard.down('KeyA');
    await page.evaluate(() => new Promise(r => setTimeout(r, 900)));
    await page.keyboard.up('KeyA');
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
  }
  const btn = await page.evaluate(() => {
    const g = window.__capy;
    g.hud.albumShow();
    return g.hud.albumAudit();
  });
  await page.evaluate(() => new Promise(r => setTimeout(r, 1400)));
  await page.evaluate(o => fetch('/shot?name=pf2-albshot.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), btn);
}
