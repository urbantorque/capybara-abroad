async page => {
  await page.reload(); await page.waitForTimeout(5500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE
    g.biome.switchTo('drift')
    for (let i=0;i<120;i++) g.tick(1/60,false)
    const b = g.capy.body
    b.position.set(3,85,-100); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i=0;i<160;i++){ g.tick(1/60,false); b.position.set(3,85,-100); b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }
    g.camera.updateMatrixWorld(true)
    // shoot rays at the pale squares seen in D3-arch (1280x760)
    const pts = [[1160,595],[830,190],[380,255],[1080,52],[463,368]]
    const rc = new T.Raycaster()
    const res = []
    const objs = []
    g.scene.traverse(o => { if (o.isMesh || o.isInstancedMesh) objs.push(o) })
    for (const [px,py] of pts) {
      const ndc = new T.Vector2(px/1280*2-1, -(py/760*2-1))
      rc.setFromCamera(ndc, g.camera)
      const hit = rc.intersectObjects(objs, false)[0]
      res.push(hit ? { px, py, d: +hit.distance.toFixed(1),
        tris: hit.object.geometry.index? hit.object.geometry.index.count/3 : hit.object.geometry.attributes.position.count/3,
        inst: !!hit.object.isInstancedMesh, cnt: hit.object.count||1,
        nm: hit.object.name||(hit.object.parent&&hit.object.parent.name)||"?", col: (Array.isArray(hit.object.material)?hit.object.material[0]:hit.object.material).color.getHexString(),
        mt: (Array.isArray(hit.object.material)?hit.object.material[0]:hit.object.material).type,
        vc: !!(Array.isArray(hit.object.material)?hit.object.material[0]:hit.object.material).vertexColors } : { px, py, miss: true })
    }
    return res
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=L6.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
