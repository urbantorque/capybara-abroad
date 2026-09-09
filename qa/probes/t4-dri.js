async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE
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
    g.biome.switchTo('drift')
    b.position.set(2, 31.6, 42); b.velocity.set(0,0,0)
    for (let i=0;i<60*3;i++){ g.tick(1/60,false); b.position.set(2,31.6,42); b.velocity.set(0,0,0) }
    await shot('T4-dri-spawn.png', 6, 34.5, 48, -8, 31, 30)
    await shot('T4-dri-house.png', -6, 34, 44, -16, 31.5, 36)
    await shot('T4-dri-wide.png', 60, 62, 70, -20, 40, -30)
    b.position.set(-38, 81.2, -114)
    for (let i=0;i<60*3;i++){ g.tick(1/60,false); b.position.set(-38,81.2,-114); b.velocity.set(0,0,0) }
    await shot('T4-dri-orchard.png', -22, 84, -100, -31, 81, -110)
    b.position.set(11, 84.6, -110)
    for (let i=0;i<60*3;i++){ g.tick(1/60,false); b.position.set(11,84.6,-110); b.velocity.set(0,0,0) }
    await shot('T4-dri-lip.png', 4, 88, -100, 34, 76, -130)
  })
}
