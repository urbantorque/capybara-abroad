async page => {
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });

  // No server and no network — but the file:// navigation itself must still be
  // allowed through, which is what `**://**` was eating.
  await page.route('http://**', r => r.abort());
  await page.route('https://**', r => r.abort());
  await page.goto('file:///C:/Users/roger/OneDrive/Desktop/capy3/dist/untitled-capybara-game.html',
                  { waitUntil: 'load' });
  await page.waitForTimeout(12000);

  const out = await page.evaluate(() => {
    const g = window.__capy;
    return {
      booted: !!g,
      running: !!window.__capyRunning,
      failedCard: (() => { const b = document.getElementById('boot');
        return !!b && b.classList.contains('failed'); })(),
      bootVisible: (() => { const b = document.getElementById('boot');
        return !!b && !b.classList.contains('hidden'); })(),
      biome: g && g.biome && g.biome.current,
      time: g && g.state && Math.round(g.state.time * 10) / 10,
      lastError: g && g.state && g.state.lastError || null,
      three: (typeof THREE !== 'undefined') ? 'in scope' : (g && g.THREE ? 'on game' : 'missing'),
      threeRev: g && g.THREE && g.THREE.REVISION,
      cannon: g && g.CANNON ? 'on game' : 'missing',
      bodies: g && g.world && g.world.bodies && g.world.bodies.length,
      props: g && g.props && g.props.length,
      canvas: (() => { const c = document.querySelector('canvas'); return c ? c.width + 'x' + c.height : null; })()
    };
  });
  out.errors = errs.slice(0, 12);
  // No server to POST to; stash it where the next Bash call can read it.
  await page.evaluate(o => { document.title = 'RESULT ' + JSON.stringify(o); }, out);
}
