async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE
    const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }))
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))
    const shot = async (name, cx,cy,cz, tx,ty,tz) => {
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.fov = 50; g.camera.far = 4000
      g.camera.updateProjectionMatrix()
      g.camera.position.set(cx,cy,cz); g.camera.lookAt(new THREE.Vector3(tx,ty,tz))
      g.camera.updateMatrixWorld(true)
      g.renderer.render(g.scene, g.camera)
      await fetch('/shot?name=' + name, { method:'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
    }
    const b = g.capy.body
    // VENICE at the top of the tide
    g.biome.switchTo('venice')
    b.position.set(-4, 1.6, -30); b.velocity.set(0,0,0)
    for (let i=0;i<60*118;i++){ g.tick(1/60,false); b.position.set(-4,1.6,-30); b.velocity.set(0,0,0) }
    await shot('HERO-venice.png', -4, 4.4, -17, -4, 1.8, -52)
    // KOWLOON, the Symphony from the roof
    g.biome.switchTo('kowloon')
    b.position.set(-10.5, 35.4, 0); b.velocity.set(0,0,0)
    for (let i=0;i<60*80;i++){ g.tick(1/60,false); b.position.set(-10.5,35.4,0); b.velocity.set(0,0,0) }
    await shot('HERO-kowloon.png', -3, 43, 14, -13, 33, -40)
    // DRIFT, the lantern lit
    g.biome.switchTo('drift')
    b.position.set(-38, 81.2, -114); b.velocity.set(0,0,0)
    for (let i=0;i<180;i++) g.tick(1/60,false)
    for (let k=0;k<14 && g.drift.lampflies() < 6; k++) {
      down('KeyQ'); for (let i=0;i<3;i++) g.tick(1/60,false); up('KeyQ')
      for (let i=0;i<50;i++) g.tick(1/60,false)
    }
    b.position.set(36, 109.2, -190); b.velocity.set(0,0,0)
    for (let i=0;i<120;i++) g.tick(1/60,false)
    down('KeyE'); for (let i=0;i<3;i++) g.tick(1/60,false); up('KeyE')
    for (let i=0;i<60*8;i++) g.tick(1/60,false)
    await shot('HERO-drift.png', 12, 122, -158, 36, 111, -190)
  })
}
