async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Semicolon');
  await page.waitForTimeout(4000);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const el = document.querySelector('.capyui-rec');
    const rows = [];
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 200));
      if (el.classList.contains('on')) rows.push({ t: +(i * 0.2).toFixed(1), s: el.textContent });
    }
    const api = g.pantanal || {};
    return { upFrames: rows.length, first: rows[0] || null, last: rows[rows.length - 1] || null,
             sample: rows.slice(0, 4),
             cow: typeof api.cowState === 'function' ? api.cowState() : '(no api)',
             err: (g.state.lastError && String(g.state.lastError)) || '' };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b6-pan.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
