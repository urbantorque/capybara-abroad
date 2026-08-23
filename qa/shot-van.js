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
    // parked at the eastern terminus, near the forecourt
    let guard = 0;
    while (!g.env.vanParked() && guard++ < 900) await sleep(16);
    let v = g.env.van();
    await look('MV1-parked', [v.x + 7, 3.4, v.z + 7], [v.x, 1.6, v.z], 44);
    await look('MV2-hatch', [v.x - 4.6, 1.9, v.z + 1.2], [v.x, 1.3, v.z], 46);
    guard = 0;
    while (g.env.vanParked() && guard++ < 900) await sleep(16);
    await sleep(3500);
    v = g.env.van();
    await look('MV3-rolling', [v.x + 11, 6.5, v.z + 13], [v.x, 1.4, v.z], 46);
    // and from up on the roof, which is where the task happens
    const b = g.capy.body;
    b.position.set(v.x, 3.0, v.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    g.capy.position.set(v.x, 3.0, v.z);
    await sleep(2200);
    v = g.env.van();
    const p = g.capy.position;
    await look('MV4-riding', [p.x + 8, 5.2, p.z + 9], [v.x, 2.2, v.z], 48);
    await look('MV5-wide', [-30, 26, 42], [-34, 2, -4], 52);
  });
}
