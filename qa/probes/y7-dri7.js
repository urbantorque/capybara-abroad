async page => {
  await page.reload(); await page.waitForTimeout(5600);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
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
    hold(-4, 34, -2); for (let i=0;i<120;i++) g.tick(1/60,false);
    await shoot('Y7-dri-stairs', 12, 44, 14, -14, 34, -18);
    await shoot('Y7-dri-step', -4, 39, 10, -4, 33, -4);
    const vis = (n) => { let p=n; while(p){ if(!p.visible) return false; p=p.parent;} return true; };
    let t=0; g.scene.traverse(n=>{ if(!n.isMesh||!n.geometry||!vis(n)) return;
      const ix=n.geometry.index; const c=ix?ix.count:(n.geometry.attributes.position?n.geometry.attributes.position.count:0);
      t += (c/3)*(n.isInstancedMesh?n.count:1); });
    return { tris: Math.round(t), bodies: g.world.bodies.length, err: g.state.lastError || null };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=y7dri7.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
