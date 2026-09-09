async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 4500)));
  await page.keyboard.press('Digit1');
  await page.evaluate(() => new Promise(r => setTimeout(r, 3500)));
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('KeyK');
    await page.evaluate(() => new Promise(r => setTimeout(r, 650)));
    await page.keyboard.press('Enter');
    await page.evaluate(() => new Promise(r => setTimeout(r, 650)));
    await page.keyboard.press('KeyK');
    await page.evaluate(() => new Promise(r => setTimeout(r, 400)));
    await page.keyboard.down('KeyD');
    await page.evaluate(() => new Promise(r => setTimeout(r, 800)));
    await page.keyboard.up('KeyD');
  }
  const out = {};
  out.took = await page.evaluate(() => ({
    audit: window.__capy.hud.albumAudit(),
    ls: (localStorage.getItem('capy3.album.v1') || '').length
  }));
  // back to the title in the SAME session, storage intact
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 5200)));
  out.title = await page.evaluate(() => ({
    lsLen: (localStorage.getItem('capy3.album.v1') || '').length,
    diag: window.__pickDiag || null,
    errs: window.__pickErr || null,
    tiles: document.querySelectorAll('.capyui-pickart').length,
    shots: document.querySelectorAll('.capyui-pickshot').length
  }));
  await page.evaluate(o => fetch('/shot?name=pf2-picks2.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
