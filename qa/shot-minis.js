async page => {
  await page.evaluate(async () => {
    const g = window.__capy;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const btns = document.querySelectorAll('.capyui-pick');
    if (btns[0]) btns[0].click();
    await sleep(500);
    g.renderer.setSize(1280, 760, false);
    const V = g.THREE.Vector3;
    async function look(name, from, at, fov) {
      g.camera.fov = fov || 48;
      g.camera.aspect = 1280 / 760;
      g.camera.updateProjectionMatrix();
      g.camera.position.set(from[0], from[1], from[2]);
      g.camera.lookAt(new V(at[0], at[1], at[2]));
      g.camera.updateMatrixWorld(true);
      g.renderer.render(g.scene, g.camera);
      await fetch('/shot?name=' + name, { method: 'POST', body: g.canvas.toDataURL('image/png') });
    }
    function place(x, y, z) {
      const b = g.capy.body;
      b.position.set(x, y, z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.capy.position.set(x, y, z);
      if (g.capy.group) g.capy.group.position.set(x, y, z);
    }

    // ---- PASTO: la carroza ----
    g.biome.switchTo('pasto');
    place(0, 1.4, 26);
    await sleep(900);
    let p = g.pasto.carroza();
    await look('N1-carroza', [p.x + 11, 7.5, p.z - 13], [p.x, 3.0, p.z], 46);
    await look('N2-carroza-plaza', [0, 20, 60], [0, 4, 20], 52);

    // ---- QUAY: the Freshwater ----
    g.biome.switchTo('quay');
    await sleep(900);
    let f = g.quay.freshwater();
    await look('N3-freshwater', [f.x + 34, 16, f.z + 46], [f.x, 4, f.z], 44);

    // ---- KYOTO: the bonsho ----
    g.biome.switchTo('kyoto');
    await sleep(900);
    const bl = g.kyoto.bell;
    const by = g.kyoto.terrainHeight(bl.x, bl.z);
    await look('N4-bell', [bl.x + 9, by + 5.5, bl.z + 11], [bl.x, by + 3.0, bl.z], 46);
    await look('N5-bell-under', [bl.x, by + 0.5, bl.z + 0.1], [bl.x, by + 3.4, bl.z], 60);

    // ---- CALI: la carretilla ----
    g.biome.switchTo('cali');
    await sleep(900);
    const c = g.cali.cart();
    await look('N6-cart', [c.x + 5, c.y + 3.2, c.z + 6], [c.x, c.y + 0.9, c.z], 44);

    // ---- RIO: the set ----
    g.biome.switchTo('rio');
    await sleep(400);
    for (let i = 0; i < 900; i++) { await sleep(16); if (g.rio.waveAt().z > -50) break; }
    let w = g.rio.waveAt();
    await look('N7-wave', [w.x + 8, 5.5, w.z + 34], [w.x, 0, w.z], 50);

    // ---- ICELAND: the whale ----
    g.biome.switchTo('iceland');
    await sleep(400);
    const pier = g.iceland.pier;
    place(pier.x, 2.4, pier.z);
    for (let i = 0; i < 3000; i++) {
      await sleep(16);
      const wh = g.scene.getObjectByName('iceWhale');
      if (wh && wh.visible && wh.position.y > 3) break;
    }
    const wh = g.scene.getObjectByName('iceWhale');
    if (wh) await look('N8-whale', [wh.position.x + 22, 12, wh.position.z + 26], [wh.position.x, 4, wh.position.z], 46);

    // ---- MARRAKECH: the acrobats ----
    g.biome.switchTo('sahara');
    await sleep(900);
    const m = g.sahara.acrobatMat();
    await look('N9-acrobats', [m.x + 6, m.y + 3.4, m.z + 7], [m.x, m.y + 1.0, m.z], 46);

    // ---- THE DRIFT: the seeds ----
    g.biome.switchTo('drift');
    await sleep(900);
    const sd = g.drift.seed();
    await look('NA-seed', [sd.x + 7, sd.y + 3, sd.z + 8], [sd.x, sd.y, sd.z], 48);

    // ---- VENICE: the traghetto ----
    g.biome.switchTo('venice');
    await sleep(900);
    const t = g.venice.traghetto();
    await look('NB-traghetto', [t.x + 12, t.y + 6, t.z + 13], [t.x, t.y + 1, t.z], 46);

    // ---- HONG KONG: the open top ----
    g.biome.switchTo('kowloon');
    await sleep(900);
    const bu = g.kowloon.bus();
    await look('NC-bus', [bu.x + 9, bu.y + 7.5, bu.z + 14], [bu.x, bu.y + 3, bu.z], 46);
    await look('ND-bus-street', [bu.x - 1, bu.y + 6.4, bu.z + 3], [bu.x, bu.y + 5, bu.z - 40], 58);

    // ---- PALAWAN: the bait ball ----
    g.biome.switchTo('palawan');
    await sleep(900);
    const bb = g.palawan.baitBall();
    place(bb.x, bb.y, bb.z);
    await sleep(400);
    await look('NE-baitball', [bb.x + 12, bb.y + 3, bb.z + 12], [bb.x, bb.y, bb.z], 50);

    // ---- CAPPADOCIA: the herd ----
    g.biome.switchTo('goreme');
    await sleep(400);
    for (let i = 0; i < 1200; i++) { await sleep(16); if (g.goreme.mareRunning()) break; }
    await sleep(2500);
    const mr = g.goreme.mare();
    await look('NF-herd', [mr.x + 16, mr.y + 6, mr.z + 18], [mr.x, mr.y + 1.2, mr.z], 46);
    await look('NG-herd-wide', [mr.x + 40, mr.y + 22, mr.z + 44], [mr.x, mr.y, mr.z - 20], 54);
  });
}
