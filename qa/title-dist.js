async page => {
  // The shipped artefact, opened the way a player opens it: from the disk,
  // with no server. Scoped to http/https so the file:// navigation itself is
  // not aborted (see capy3-the-front-door).
  await page.route('http://**', r => r.abort());
  await page.route('https://**', r => r.abort());
  await page.setViewportSize({ width: 1440, height: 900 });
  const url = 'file:///' + 'C:/Users/roger/OneDrive/Desktop/capy3/dist/untitled-capybara-game.html';
  await page.goto(url);
  await page.waitForTimeout(9000);
  const m = await page.evaluate(() => {
    const g = window.__capy;
    if (!g) return { boot: false };
    const c = g.camera, p = g.capy && g.capy.group ? g.capy.group.position : null;
    let nx = -9;
    if (p) { const v = new g.THREE.Vector3(p.x, p.y + 0.5, p.z); v.project(c); nx = +v.x.toFixed(3); }
    const bubs = [...document.getElementById('hud').children].filter(e =>
      e.style && e.style.transformOrigin === '50% 100%' && e.offsetParent).length;
    return { boot: true, running: !!window.__capyRunning,
      pitch: +(g.camInfo.pitch * 180 / Math.PI).toFixed(1),
      reach: +g.camInfo.reach.toFixed(2), nx, bubbles: bubs,
      bodies: g.world ? g.world.bodies.length : -1,
      backdrop: getComputedStyle(document.querySelector('.capyui-title')).backdropFilter };
  });
  await page.screenshot({ path: 'qa/TD-dist.png' });
  await page.evaluate(o => fetch('/shot?name=td.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), m)
    .catch(() => {});
  // the sink is unreachable from file://, so hand it back through the title
  await page.evaluate(o => { document.title = JSON.stringify(o); }, m);
}
