async page => {
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 4500)));
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 6000)));
  await page.keyboard.press('Digit2');
  await page.evaluate(() => new Promise(r => setTimeout(r, 8000)));
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const card = document.querySelector('.capyui-todo');
    const rows = Array.from(card ? card.querySelectorAll('*') : [])
      .filter(function (e) { return e.children.length === 0 && (e.textContent || '').trim(); })
      .map(function (e) {
        const r = e.getBoundingClientRect();
        return { t: (e.textContent || '').trim().slice(0, 44), cls: e.className,
                 vis: r.width > 0 && r.height > 0,
                 op: +getComputedStyle(e).opacity };
      });
    return { biome: g.biome.current, rows: rows };
  });
  const b = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=r8-card.json', { method: 'POST', body: s }), b);
}
