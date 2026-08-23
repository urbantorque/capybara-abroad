async page => {
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    const b = document.querySelectorAll('.capyui-pick');
    if (b[0]) b[0].click();
    await sleep(500);
    g.biome.switchTo('venice');
    await sleep(400);
    const V = g.venice;

    // wind the tide, and REPORT what it actually reached rather than assuming
    let n = 0;
    for (; n < 4000 && V.tide() < 0.98; n++) g.venice.update(1 / 6);

    // stand the animal in the middle of the square
    const px = -4, pz = -34;
    const bd = g.capy.body;
    bd.position.set(px, 2.0, pz); bd.velocity.set(0, 0, 0);
    bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position);
    g.capy.position.set(px, 2.0, pz);
    await sleep(1400);            // let it settle onto the waterline

    const report = {
      wound: n,
      tide: +V.tide().toFixed(3),
      waterY: +V.tideY().toFixed(2),
      terrainAtSquare: +V.terrainHeight(px, pz).toFixed(2),
      overWater: V.isOverWater(px, pz),
      capyY: +g.capy.position.y.toFixed(2),
      wet: +g.capy.wet.toFixed(2),
      boardsOut: +V.boardsOut().toFixed(2),
      pigeonsUp: V.pigeonsUp(),
    };

    // and a picture, from the PLAYER'S OWN RIG geometry: 9.5 m back, 41 degrees
    // down, 48 degree FOV. Anything flatter than that flatters a thin
    // transparent sheet and is not what anybody will ever see.
    g.renderer.setSize(1280, 760, false);
    const d = 9.5, pitch = 41 * Math.PI / 180;
    g.camera.fov = 48;
    g.camera.aspect = 1280 / 760;
    g.camera.updateProjectionMatrix();
    g.camera.position.set(px, g.capy.position.y + 1.0 + Math.sin(pitch) * d,
                          pz + Math.cos(pitch) * d);
    g.camera.lookAt(new g.THREE.Vector3(px, g.capy.position.y + 0.6, pz - 6));
    g.camera.updateMatrixWorld(true);
    g.renderer.render(g.scene, g.camera);
    await fetch('/shot?name=G1-flood-rig', { method: 'POST',
      body: g.canvas.toDataURL('image/png') });

    // and the same square at DEAD LOW, for comparison
    for (let i = 0; i < 4000 && V.tide() > 0.02; i++) g.venice.update(1 / 6);
    bd.position.set(px, 1.2, pz); bd.velocity.set(0, 0, 0);
    bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position);
    g.capy.position.set(px, 1.2, pz);
    await sleep(900);
    g.camera.position.set(px, g.capy.position.y + 1.0 + Math.sin(pitch) * d,
                          pz + Math.cos(pitch) * d);
    g.camera.lookAt(new g.THREE.Vector3(px, g.capy.position.y + 0.6, pz - 6));
    g.camera.updateMatrixWorld(true);
    g.renderer.render(g.scene, g.camera);
    await fetch('/shot?name=G2-low-rig', { method: 'POST',
      body: g.canvas.toDataURL('image/png') });
    report.lowTide = +V.tide().toFixed(3);
    report.lowCapyY = +g.capy.position.y.toFixed(2);
    return report;
  });
  await page.evaluate(async o => {
    await fetch('/shot?name=flood.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
