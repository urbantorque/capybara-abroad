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
    b.position.set(5, 85.2, -106); b.velocity.set(0,0,0)
    for (let i=0;i<120;i++) g.tick(1/60,false)
    const shot = async (name, cx,cy,cz, tx,ty,tz) => {
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.fov = 50; g.camera.far = 4000
      g.camera.updateProjectionMatrix()
      g.camera.position.set(cx,cy,cz); g.camera.lookAt(new THREE.Vector3(tx,ty,tz))
      g.camera.updateMatrixWorld(true)
      g.renderer.render(g.scene, g.camera)
      await fetch('/shot?name=' + name, { method:'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
    }
    await shot('D8-lip.png', -4, 90, -98, 24, 80, -124)
    // jump then puff
    down('Space'); for (let i=0;i<6;i++) g.tick(1/60,false); up('Space')
    for (let i=0;i<20;i++) g.tick(1/60,false)
    down('KeyQ'); for (let i=0;i<3;i++) g.tick(1/60,false); up('KeyQ')
    for (let i=0;i<12;i++) g.tick(1/60,false)
    const p2 = g.capy.position
    await shot('D8-puff.png', p2.x - 7, p2.y + 3, p2.z + 8, p2.x, p2.y - 0.5, p2.z)
    return { e: g.state.lastError?String(g.state.lastError):'none', y: +p2.y.toFixed(2), ring: g.drift.puffReady() }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=dri8.json', { method:'POST', body: btoa(JSON.stringify(o)) }) }, out)
}
