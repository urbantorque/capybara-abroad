async page => {
  await page.reload(); await page.waitForTimeout(5600);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  await page.evaluate(async () => {
    const g = window.__capy;
    const shoot = async (name, cx, cy, cz, tx, ty, tz) => {
      g.renderer.setSize(1280, 760, false);
      g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix();
      g.camera.position.set(cx, cy, cz); g.camera.lookAt(tx, ty, tz);
      g.camera.updateMatrixWorld(true); g.post.render();
      const url = g.renderer.domElement.toDataURL('image/png');
      await fetch('/shot?name=' + name + '.png', { method: 'POST', body: url.split(',')[1] });
    };
    const hold=(x,y,z)=>{const b=g.capy.body;b.position.set(x,y,z);b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);};
    g.biome.switchTo('drift');
    for (let i=0;i<400;i++) g.tick(1/60,false);
    const D = g.drift;
    hold(D.orchard.x, D.orchard.y !== undefined ? D.orchard.y + 1 : 81, D.orchard.z);
    for (let i=0;i<120;i++) g.tick(1/60,false);
    await shoot('Y7-dri-orch', D.orchard.x + 14, 88, D.orchard.z + 16, D.orchard.x, 81, D.orchard.z);
    const L = D.lantern;
    hold(L.x + 8, 110, L.z + 10);
    for (let i=0;i<120;i++) g.tick(1/60,false);
    await shoot('Y7-dri-crown', L.x + 22, 122, L.z + 26, L.x, 112, L.z);
    const A = D.arch;
    hold(A.x, 86, A.z);
    for (let i=0;i<120;i++) g.tick(1/60,false);
    await shoot('Y7-dri-gap', A.x - 16, 96, A.z + 18, A.x + 20, 76, A.z - 26);
  });
}
