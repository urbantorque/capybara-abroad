async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE
    const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }))
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))
    g.biome.switchTo('drift')
    const b = g.capy.body
    const put = (x,y,z) => { b.position.set(x,y,z); b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }
    put(-38, 81.2, -114)
    for (let i=0;i<180;i++) g.tick(1/60,false)
    const g1 = g.capy.grounded, y1 = +g.capy.position.y.toFixed(2)
    for (let k=0;k<14 && g.drift.lampflies() < 6; k++) {
      down('KeyQ')
      for (let i=0;i<3;i++) g.tick(1/60,false)
      up('KeyQ')
      for (let i=0;i<50;i++) g.tick(1/60,false)
    }
    const awake = g.drift.lampflies()
    put(36, 109.2, -190)
    for (let i=0;i<120;i++) g.tick(1/60,false)
    down('KeyE'); for (let i=0;i<3;i++) g.tick(1/60,false); up('KeyE')
    for (let i=0;i<60*7;i++) g.tick(1/60,false)
    g.renderer.setSize(1280, 760, false)
    g.camera.aspect = 1280/760; g.camera.fov = 50; g.camera.far = 4000
    g.camera.updateProjectionMatrix()
    g.camera.position.set(36, 116, -174)
    g.camera.lookAt(new THREE.Vector3(36, 113, -194))
    g.camera.updateMatrixWorld(true)
    g.renderer.render(g.scene, g.camera)
    await fetch('/shot?name=D6-lit.png', { method:'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
    g.camera.position.set(4, 128, -146)
    g.camera.lookAt(new THREE.Vector3(36, 110, -190))
    g.camera.updateMatrixWorld(true)
    g.renderer.render(g.scene, g.camera)
    await fetch('/shot?name=D6-lit-wide.png', { method:'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
    return { g1, y1, awake, lit: g.drift.lit(), glow: +g.drift.glow().toFixed(2), pos: [+g.capy.position.x.toFixed(1),+g.capy.position.y.toFixed(1),+g.capy.position.z.toFixed(1)], e: g.state.lastError?String(g.state.lastError):'none' }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=dri6.json', { method:'POST', body: btoa(JSON.stringify(o)) }) }, out)
}
