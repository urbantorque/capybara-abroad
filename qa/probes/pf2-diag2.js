async page => {
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));
  const out = await page.evaluate(() => ({
    diag: window.__pickDiag || null,
    errs: window.__pickErr || null,
    lsLen: (localStorage.getItem('capy3.album.v1') || '').length,
    shots: document.querySelectorAll('.capyui-pickshot').length,
    tiles: document.querySelectorAll('.capyui-pickart').length
  }));
  await page.evaluate(o => fetch('/shot?name=pf2-diag2.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
