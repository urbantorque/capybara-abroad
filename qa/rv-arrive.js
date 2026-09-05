async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(4000);
  const ALL = ['pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara',
               'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal',
               'cave', 'antarctic', 'monaco', 'hanoi', 'sydney'];
  const rows = [];
  for (let i = 0; i < ALL.length; i++) {
    const name = ALL[i];
    await page.evaluate(function (n) {
      const g = window.__capy;
      try { g.hud.cross(n); } catch (e) { g.biome.switchTo(n); }
      return true;
    }, name);
    await wait(9000);
    await page.screenshot({ path: 'qa/RV-arrive-' + (i + 1) + '-' + name + '.png' });
    rows.push(await page.evaluate(function (n) {
      const g = window.__capy;
      const txt = s => Array.from(document.querySelectorAll(s)).map(e => (e.textContent || '').trim()).filter(Boolean);
      const bub = Array.from(document.querySelectorAll('#hud div')).filter(e => {
        const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
        return r.width > 40 && r.height > 20 && +cs.opacity > 0.3 && cs.visibility !== 'hidden' && e.children.length === 0 && (e.textContent || '').trim().length > 3 && !/capyui/.test(e.className);
      }).map(e => (e.textContent || '').trim().slice(0, 80));
      const p = g.capy.position;
      return { n: n, biome: g.biome.current,
               pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)],
               todo: txt('.capyui-todo .capyui-txt').slice(0, 4),
               clue: txt('.capyui-clue').slice(0, 2),
               bubbles: bub.slice(0, 6),
               fov: +g.camera.fov.toFixed(1),
               err: g.state.lastError ? String(g.state.lastError) : null };
    }, name));
  }
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), { rows });
  await page.evaluate(s => fetch('/shot?name=rv-arrive.json', { method: 'POST', body: s }), bl);
}
