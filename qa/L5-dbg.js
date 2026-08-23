async page => {
  await page.reload(); await page.waitForTimeout(5500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE
    g.biome.switchTo('drift')
    for (let i=0;i<120;i++) g.tick(1/60,false)
    const b = g.capy.body
    b.position.set(36,109,-184); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i=0;i<150;i++){ g.tick(1/60,false); b.position.set(36,109,-184); b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }
    g.renderer.setSize(1280,760,false); g.camera.aspect=1280/760; g.camera.updateProjectionMatrix()
    g.tick(1/60,true)
    await fetch('/shot?name=L5-crown.png', { method:'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
    // what is actually in the frustum?
    g.camera.updateMatrixWorld(true)
    const fr = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(g.camera.projectionMatrix, g.camera.matrixWorldInverse))
    const rows = []
    g.scene.traverse(o => {
      if (!o.isMesh && !o.isInstancedMesh) return
      let vis = true; for (let p=o;p;p=p.parent) if(!p.visible) vis=false
      if (!vis) return
      const gm=o.geometry; if(!gm) return
      if(!gm.boundingSphere) gm.computeBoundingSphere()
      const inF = fr.intersectsObject(o)
      const t = gm.index? gm.index.count/3 : gm.attributes.position.count/3
      rows.push({t: Math.round(t*(o.isInstancedMesh?o.count:1)), inF, fc:o.frustumCulled,
                 c: o.geometry.boundingSphere ? [+o.geometry.boundingSphere.center.x.toFixed(0),+o.geometry.boundingSphere.center.y.toFixed(0),+o.geometry.boundingSphere.center.z.toFixed(0),+o.geometry.boundingSphere.radius.toFixed(0)] : null})
    })
    rows.sort((a,c)=>c.t-a.t)
    return { inFrustum: rows.filter(r=>r.inF||!r.fc).length, total: rows.length, top: rows.slice(0,10),
             fog: g.scene.fog ? [g.scene.fog.near, g.scene.fog.far, '#'+g.scene.fog.color.getHexString()] : null,
             post: g.post && g.post.params ? JSON.parse(JSON.stringify(g.post.params)) : null }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=L5.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
