async page => {
  await page.reload(); await page.waitForTimeout(5200);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const res = {};
    if (!g.biome.isActive('sydney')) { g.biome.switchTo('sydney'); for (let i=0;i<90;i++) g.tick(1/60,false); }
    const b = g.capy.body;
    const hold = (x,z) => { b.position.set(x,1.0,z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
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
    // ---- 1: the queue at the van ------------------------------------------
    let guard = 0, q = 0;
    while (guard++ < 60 * 200) {
      const v = g.env.van();
      hold(v.x + 6, v.z + 6);
      g.tick(1/60, false);
      q = 0; for (const r of g.npcs) if (r.state === 'queue') q++;
      if (q >= 2) break;
    }
    res.queueFound = q;
    const v = g.env.van();
    res.van = [+v.x.toFixed(1), +v.z.toFixed(1)];
    await shoot('Z-vanqueue', v.x + 9, 6.0, v.z + 9, v.x, 1.4, v.z);
    // ---- 2: the fig canopy, from the side ---------------------------------
    hold(-19, 12);
    for (let i = 0; i < 120; i++) { g.tick(1/60, false); hold(-19, 12); }
    await shoot('Z-lorikeet', -19, 7.5, 14, -19, 6.3, 5);
    // ---- 3: a flush -------------------------------------------------------
    for (let i = 0; i < 90; i++) { g.tick(1/60, false); hold(-19, 6.5); }
    await shoot('Z-loriflush', -19, 9.0, 17, -19, 7.5, 5);
    res.err = g.state.lastError || null;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=z6.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
