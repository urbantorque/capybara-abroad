async page => {
  await page.reload();
  await page.evaluate(() => {
    if (window.__err) return;
    window.__err = [];
    const e0 = console.error;
    console.error = function () { window.__err.push([].slice.call(arguments).join(' ')); e0.apply(console, arguments); };
    window.addEventListener('error', ev => window.__err.push('WINDOW ' + (ev.message || ev.error)));
  });
  await page.waitForFunction(() => window.__capy && window.__capy.biome, null, { timeout: 30000 });
  await page.keyboard.press('Digit1');
  await page.waitForFunction(() => window.__capy.state.started, null, { timeout: 20000 });
  const out = {};
  const inst = (n, k) => page.evaluate(a => {
    const g = window.__capy;
    let m = null;
    g.scene.traverse(o => { if (o.name === a[0]) m = o; });
    if (!m) return null;
    const e = new g.THREE.Matrix4();
    const r = [];
    for (let i = 0; i < Math.min(m.count || 1, a[1]); i++) {
      if (m.getMatrixAt) { m.getMatrixAt(i, e); r.push([+e.elements[12].toFixed(1), +e.elements[13].toFixed(1), +e.elements[14].toFixed(1)]); }
      else r.push([+m.position.x.toFixed(1), +m.position.y.toFixed(1), +m.position.z.toFixed(1)]);
    }
    return { vis: m.visible, n: m.count || 1, at: r };
  }, [n, k]);
  const pair = async (biome, name, k) => {
    await page.evaluate(b => window.__capy.biome.switchTo(b), biome);
    await page.waitForTimeout(2600);
    const a = await inst(name, k);
    await page.waitForTimeout(3500);
    const b = await inst(name, k);
    return { t0: a, t1: b };
  };
  out.swifts = await pair('pasto', 'pastoSwifts', 3);
  out.kites = await pair('cali', 'caliKites', 3);
  out.fox = await pair('iceland', 'iceFox', 1);
  // the skein is on a 96 s gap and starts hidden; watch for it
  await page.evaluate(() => window.__capy.biome.switchTo('drift'));
  await page.waitForTimeout(2600);
  const sk = [];
  for (let i = 0; i < 26; i++) {
    sk.push(await inst('driSkein', 1));
    await page.waitForTimeout(1200);
    if (sk[sk.length - 1] && sk[sk.length - 1].vis) break;
  }
  out.skein = sk[sk.length - 1];
  out.skeinTicks = sk.length;
  out.errors = await page.evaluate(() => (window.__err || []).slice(0, 12));
  await page.evaluate(async o => {
    await fetch('/shot?name=amb2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
