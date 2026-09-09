async page => {
  await page.reload(); await page.waitForTimeout(6000);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    g.biome.switchTo('quay');
    for (let i = 0; i < 200; i++) g.tick(1/60, false);
    const res = { near: [] };
    // find every mesh whose world bbox overlaps the fort area
    const box = new g.THREE.Box3();
    g.scene.traverse(o => {
      if (!o.isMesh || !o.geometry) return;
      try {
        box.setFromObject(o);
        if (box.max.x > -20 && box.min.x < 40 && box.max.z > -140 && box.min.z < -80 && box.max.y > 2) {
          res.near.push([o.name || '(unnamed)', o.type,
            [+box.min.x.toFixed(0), +box.min.y.toFixed(1), +box.min.z.toFixed(0)],
            [+box.max.x.toFixed(0), +box.max.y.toFixed(1), +box.max.z.toFixed(0)]]);
        }
      } catch (e) {}
    });
    g.renderer.setSize(1280, 760, false);
    g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix();
    g.camera.position.set(30, 18, -60); g.camera.lookAt(6, 4, -112);
    g.camera.updateMatrixWorld(true);
    g.post.render();
    const u = g.renderer.domElement.toDataURL('image/png');
    await fetch('/shot?name=Z-fort.png', { method: 'POST', body: u.split(',')[1] });
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=zl.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
