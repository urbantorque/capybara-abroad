async page => {
  await page.reload(); await page.waitForTimeout(5500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE
    g.biome.switchTo('iceland')
    for (let i=0;i<120;i++) g.tick(1/60,false)
    const b = g.capy.body
    const hold=()=>{b.position.set(34,3,6);b.velocity.set(0,0,0);b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position)}
    hold(); for (let i=0;i<200;i++){ g.tick(1/60,false); hold() }
    g.renderer.setSize(1280,760,false); g.camera.aspect=1280/760; g.camera.updateProjectionMatrix()
    g.tick(1/60,true)
    g.camera.updateMatrixWorld(true)
    const objs=[]; g.scene.traverse(o=>{ if(o.isMesh||o.isInstancedMesh) objs.push(o) })
    const rc=new T.Raycaster(); const res=[]
    for (const [px,py] of [[930,430],[960,200],[900,470],[770,50],[640,340],[170,110]]) {
      rc.setFromCamera(new T.Vector2(px/1280*2-1, -(py/760*2-1)), g.camera)
      const h=rc.intersectObjects(objs,false)[0]
      const m=h?(Array.isArray(h.object.material)?h.object.material[0]:h.object.material):null
      res.push(h?{px,py,d:+h.distance.toFixed(1),nm:h.object.name||'?',
        col:m.color.getHexString(), inst:!!h.object.isInstancedMesh, cnt:h.object.count||1,
        idx: h.instanceId===undefined?null:h.instanceId,
        pt:[+h.point.x.toFixed(1),+h.point.y.toFixed(2),+h.point.z.toFixed(1)]}:{px,py,miss:true})
    }
    return res
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=L7.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
