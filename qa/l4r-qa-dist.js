async page => {
  const out = { errors: [] };
  page.on('pageerror', e => out.errors.push('pageerror: ' + String(e && e.message || e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') out.errors.push('console: ' + m.text().slice(0, 300)); });
  await page.goto('file:///C:/Users/roger/OneDrive/Desktop/capy3/dist/untitled-capybara-game.html');
  await page.waitForTimeout(8000);
  out.boot = await page.evaluate(() => ({
    running: !!window.__capyRunning, hasGame: !!window.__capy, title: document.title,
    h1: (document.querySelector('h1') || {}).textContent || null,
    btn: (document.querySelector('.capyui-go b') || {}).textContent || null,
    bootCard: (document.getElementById('boot') || {}).hidden, proto: location.protocol,
    softGL: window.__capySoftGL || null, watchdog: !!window.__capyWatchdog,
  }));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3500);
  out.started = await page.evaluate(() => { const g = window.__capy; return { started: g.state.started, biome: g.biome.current, err: g.state.lastError || null, time: +g.state.time.toFixed(1) }; });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyQ');
  await page.waitForTimeout(1500);
  out.walk = await page.evaluate(() => { const g = window.__capy; return { pos: [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(1), +g.capy.position.z.toFixed(1)], err: g.state.lastError || null }; });
  // the string: the worklet is a Blob URL — does it load from file:// ?
  await page.waitForTimeout(4000);
  out.audio = await page.evaluate(() => { const g = window.__capy; let a = null; try { a = g.hud.musAudit ? g.hud.musAudit() : (g.musAudit ? g.musAudit() : null); } catch (e) { a = { err: String(e) }; } const b = g.hud.audioBuses ? g.hud.audioBuses() : null; return { audit: a && { ks: a.ks, ksN: a.ksN, pal: a.pal || a.palette, second: a.second, secondN: a.secondN }, ctx: b && b.state, bkeys: b ? Object.keys(b).slice(0, 12) : null }; });
  // a crossing from the built file
  await page.evaluate(() => window.__capy.hud.cross('kyoto'));
  await page.waitForTimeout(6000);
  out.cross = await page.evaluate(() => { const g = window.__capy; return { biome: g.biome.current, err: g.state.lastError || null, bodies: g.world.bodies.length }; });
  await page.screenshot({ path: 'qa/l4r-qa-dist.png' });
  // localStorage under file:// (Chromium allows it; the game must not throw)
  out.save = await page.evaluate(() => { let ok = null; try { localStorage.setItem('capy3.probe', '1'); localStorage.removeItem('capy3.probe'); ok = true; } catch (e) { ok = String(e); } return { ok, file: (localStorage.getItem('capy3.journey.v1') || '').length }; });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(3000);
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4r-qa-dist.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
