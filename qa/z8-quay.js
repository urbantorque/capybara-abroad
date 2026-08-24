async page => {
  await page.reload(); await page.waitForTimeout(5200);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const res = {};
    g.biome.switchTo('quay');
    for (let i = 0; i < 120; i++) g.tick(1/60, false);
    const shoot = async (name, cx, cy, cz, tx, ty, tz) => {
      g.renderer.setSize(1280, 760, false);
      g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix();
      g.camera.position.set(cx, cy, cz);
      g.camera.lookAt(tx, ty, tz);
      g.camera.updateMatrixWorld(true);
      g.post.render();
      const url = g.renderer.domElement.toDataURL('image/png');
      await fetch('/shot?name=' + name + '.png', { method: 'POST', body: url.split(',')[1] });
    };
    // walk to the helm and take it
    const b = g.capy.body;
    const h = g.quay.boat.helm;
    b.position.set(h.x, h.y + 0.4, h.z); b.velocity.set(0,0,0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
    for (let i = 0; i < 40; i++) g.tick(1/60, false);
    down('KeyE'); g.tick(1/60, false); up('KeyE');
    for (let i = 0; i < 10; i++) g.tick(1/60, false);
    res.atHelm = g.quay.boat.atHelm;
    // full ahead
    down('KeyW');
    for (let i = 0; i < 60 * 25; i++) g.tick(1/60, false);
    up('KeyW');
    res.speed = +g.quay.boat.speed.toFixed(1);
    const bp = g.quay.boat.position;
    res.pos = [+bp.x.toFixed(0), +bp.z.toFixed(0)];
    await shoot('Z-wakegulls', bp.x + 26, 16, bp.z + 40, bp.x, 3, bp.z);
    res.err = g.state.lastError || null;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=z8.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
