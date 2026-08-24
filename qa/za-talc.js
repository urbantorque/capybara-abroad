async page => {
  await page.reload(); await page.waitForTimeout(5200);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const res = {};
    g.biome.switchTo('pasto');
    for (let i = 0; i < 120; i++) g.tick(1/60, false);
    const b = g.capy.body;
    // wait for the float to be parked, then stand on its deck
    let guard = 0;
    while (guard++ < 60 * 60 && !g.pasto.carrozaParked()) g.tick(1/60, false);
    const put = () => {
      const c = g.pasto.carroza();
      b.position.set(c.x, c.y + 2.3, c.z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    };
    put();
    for (let i = 0; i < 60 * 3; i++) { g.tick(1/60, false); }
    res.aboard0 = g.pasto.onCarroza();
    // let it roll with the animal on it
    let liveMax = 0;
    let talc = null; g.scene.traverse(o => { if (o.name === 'pastoTalc') talc = o; });
    res.talcMesh = !!talc;
    const M = new g.THREE.Matrix4(), V = new g.THREE.Vector3();
    for (let i = 0; i < 60 * 18; i++) {
      g.tick(1/60, false);
      if (!g.pasto.onCarroza()) put();
      if (talc && i % 20 === 0) {
        let n = 0;
        for (let k = 0; k < talc.count; k++) { talc.getMatrixAt(k, M); V.setFromMatrixPosition(M); if (V.y > -100) n++; }
        if (n > liveMax) liveMax = n;
      }
      const cc = g.pasto.carroza();
      if (i > 60 * 6 && !g.pasto.carrozaParked() && cc.z > 20 && cc.z < 30) break;
    }
    res.talcLive = liveMax;
    res.carrozaDone = g.state && g.state.done ? !!g.state.done['carroza'] : null;
    // picture
    const c = g.pasto.carroza();
    g.renderer.setSize(1280, 760, false);
    g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix();
    g.camera.position.set(c.x - 13, 6.5, c.z - 11);
    g.camera.lookAt(c.x, 2.8, c.z);
    g.camera.updateMatrixWorld(true);
    g.post.render();
    const url = g.renderer.domElement.toDataURL('image/png');
    await fetch('/shot?name=Z-talc.png', { method: 'POST', body: url.split(',')[1] });
    res.err = g.state.lastError || null;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=za.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
