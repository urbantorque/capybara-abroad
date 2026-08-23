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
    g.biome.switchTo('pasto');
    await sleep(900);
    let p = g.pasto.carroza();
    await look('P1-carroza', [p.x + 12, 8.5, p.z - 15], [p.x, 3.4, p.z], 46);

    g.biome.switchTo('rio');
    await sleep(400);
    for (let i = 0; i < 1600; i++) { await sleep(16); if (g.rio.waveAt().z > -46) break; }
    let w = g.rio.waveAt();
    await look('P2-wave', [w.x + 6, 4.2, w.z + 30], [w.x, 0.4, w.z], 50);
    await look('P3-wave-air', [w.x + 30, 26, w.z + 52], [w.x, 0, w.z], 52);

    g.biome.switchTo('iceland');
    await sleep(400);
    for (let i = 0; i < 4000; i++) {
      await sleep(16);
      const wh = g.scene.getObjectByName('iceWhale');
      if (wh && wh.visible && wh.position.y > 3) break;
    }
    const wh = g.scene.getObjectByName('iceWhale');
    if (wh) await look('P4-whale', [wh.position.x + 20, 11, wh.position.z + 24], [wh.position.x, 4, wh.position.z], 46);

    g.biome.switchTo('palawan');
    await sleep(900);
    const bb = g.palawan.baitBall();
    const b = g.capy.body;
    b.position.set(bb.x, bb.y, bb.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    g.capy.position.copy(b.position);
    await sleep(600);
    await look('P5-baitball', [bb.x + 11, bb.y + 2, bb.z + 11], [bb.x, bb.y, bb.z], 50);
  });
}
