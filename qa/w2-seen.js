async page => {
  // THE PLACE YOU START IN (W2). The contact sheet dims a chapter you have not
  // been to, and it dimmed SYDNEY on a journey that had begun there, walked
  // around it and left. `jrSeen` is written on `biome:enter` and the first
  // chapter of a session fires none — so this asks the save directly, at three
  // moments, rather than inferring it from a tile's alpha.
  await page.reload();
  await page.waitForTimeout(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(9000);
  const read = () => page.evaluate(() => {
    let f = null;
    try { f = JSON.parse(localStorage.getItem('capy3.journey.v1') || 'null'); } catch (e) {}
    return { seen: f ? (f.seen || []) : null, chapms: f ? (f.chapms || {}) : null,
             tasks: f ? (f.tasks || []).length : null };
  });
  const start = await read();
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('venice');
    for (let i = 0; i < 60 * 8; i++) g.tick(1 / 60, false);
  });
  await page.waitForTimeout(2000);
  const after = await read();
  await page.evaluate((o) => fetch('/shot?name=w2-seen.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), { atStart: start, afterLeaving: after });
}
