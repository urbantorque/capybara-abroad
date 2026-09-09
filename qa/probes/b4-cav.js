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
      const ter = g.cave.terrainHeight
      b.position.set(q.px, ter(q.px,q.pz)+0.5, q.pz); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<(q.warm||140);i++) {
        g.tick(1/60, false)
        b.position.set(q.px, ter(q.px,q.pz)+0.5, q.pz); b.velocity.set(0,0,0)
      }
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760
      g.camera.fov = q.fov || 50
      g.camera.far = q.far || 3000
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
  await cam({ biome:'cave', px:0, pz:64, warm:220, cx:0, cy:9, cz:76, tx:0, ty:3, tz:44, name:'F-cav-spawn.png' })
  await cam({ biome:'cave', px:4, pz:-42, warm:260, cx:14, cy:8, cz:-30, tx:0, ty:14, tz:-56, name:'F-cav-glade.png' })
  await cam({ biome:'cave', px:4, pz:-48, warm:260, name:'F-cav-dolin.png' })
  await cam({ biome:'cave', px:4, pz:-30, warm:260, cx:4, cy:12, cz:-2, tx:4, ty:6, tz:-52, name:'F-cav-dolapp.png' })
  await cam({ biome:'cave', px:0, pz:-150, warm:180, cx:0, cy:20, cz:-140, tx:0, ty:16, tz:-186, name:'F-cav-slot.png' })
  await cam({ biome:'cave', px:0, pz:-166, warm:180, name:'F-cav-exit.png' })
  await cam({ biome:'cave', px:-30, pz:-124, warm:180, cx:-20, cy:16, cz:-124, tx:-46, ty:22, tz:-126, name:'F-cav-roost.png' })
  await cam({ biome:'cave', px:22, pz:-132, warm:150, name:'F-cav-pearls.png' })
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
    return { tris: Math.round(tris), bodies: g.world.bodies.length, calls: g.renderer.info.render.calls, err: g.state.lastError||null }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=f-cav.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
