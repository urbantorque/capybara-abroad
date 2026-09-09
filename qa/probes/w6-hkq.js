async page => {
  await page.reload(); await page.waitForTimeout(6500);
  await page.mouse.click(500, 400);
  await page.waitForTimeout(2500);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    g.biome.switchTo('kowloon');
    for (let i=0;i<300;i++) g.tick(1/60,false);
    const res = { drip: null, tris: 0, locals: 0, ex: 0 };
    g.scene.traverse(o => {
      if (o.isInstancedMesh && o.material && o.material.transparent && o.count <= 32
          && o.geometry && o.geometry.attributes.position.count < 40) {
        res.drip = (res.drip || 0) + 1;
      }
    });
    // count visible drop instances by reading matrices
    let live = 0, seen = 0;
    g.scene.traverse(o => {
      if (o.isInstancedMesh && o.count > 0 && o.count <= 32) {
        seen++;
        const m = o.instanceMatrix.array;
        for (let i=0;i<o.count;i++) if (m[i*16+13] > -100 && m[i*16+13] < 40 && m[i*16+0] > 0.01) live++;
      }
    });
    res.instMeshSmall = seen; res.liveSmall = live;
    g.renderer.render(g.scene, g.camera);
    res.tris = g.renderer.info.render.triangles;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=w6.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
