async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const cam = async (o) => {
    await page.evaluate(async (q) => {
      const g = window.__capy, THREE = g.THREE
      if (g.biome.current !== q.biome) { g.biome.switchTo(q.biome) }
      const b = g.capy.body
      const ter = g.antarctic.terrainHeight
      b.position.set(q.px, ter(q.px,q.pz)+0.5, q.pz); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<(q.warm||140);i++) {
        g.tick(1/60, false)
        b.position.set(q.px, ter(q.px,q.pz)+0.5, q.pz); b.velocity.set(0,0,0)
      }
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.fov = q.fov||50; g.camera.far = 3000
      g.camera.updateProjectionMatrix()
      if (q.cx !== undefined) {
        g.camera.position.set(q.cx, q.cy, q.cz)
        g.camera.lookAt(new THREE.Vector3(q.tx, q.ty, q.tz))
        g.camera.updateMatrixWorld(true)
        g.renderer.render(g.scene, g.camera)
      } else { g.tick(1/60, true) }
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + q.name, { method:'POST', body: d.split(',')[1] })
    }, o)
  }
  await cam({ biome:'antarctic', px:-120, pz:-110, warm:160, name:'I-ant-blue.png' })
  await cam({ biome:'antarctic', px:-150, pz:-110, warm:160, cx:-176, cy:60, cz:-110, tx:-60, ty:0, tz:-110, name:'I-ant-fall.png' })
  await cam({ biome:'antarctic', px:-95, pz:-112, warm:160, cx:-40, cy:26, cz:-112, tx:-130, ty:14, tz:-112, name:'I-ant-toe.png' })
  await cam({ biome:'antarctic', px:114, pz:20, warm:150, name:'I-ant-bones.png' })
  const out = await page.evaluate(() => {
    const g = window.__capy
    for (let i=0;i<90;i++) g.tick(1/60,false)
    let tris=0
    g.scene.traverse(o => { if (!o.isMesh && !o.isInstancedMesh) return
      for (let p=o;p;p=p.parent) if(!p.visible) return
      const gm=o.geometry; if(!gm) return
      const t = gm.index ? gm.index.count/3 : (gm.attributes.position?gm.attributes.position.count/3:0)
      tris += t * (o.isInstancedMesh ? o.count : 1) })
    g.tick(1/60,true)
    return { tris: Math.round(tris), bodies: g.world.bodies.length, err: g.state.lastError||null }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=i-ant.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
