async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE
    const shot = async (name, cx,cy,cz, tx,ty,tz) => {
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.fov = 45; g.camera.far = 4000
      g.camera.updateProjectionMatrix()
      g.camera.position.set(cx,cy,cz); g.camera.lookAt(new THREE.Vector3(tx,ty,tz))
      g.camera.updateMatrixWorld(true)
      g.renderer.render(g.scene, g.camera)
      await fetch('/shot?name=' + name, { method:'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
    }
    const b = g.capy.body
    g.biome.switchTo('kowloon')
    b.position.set(4.5, 1.4, -22); b.velocity.set(0,0,0)
    for (let i=0;i<60*5;i++){ g.tick(1/60,false); b.position.set(4.5,1.4,-22); b.velocity.set(0,0,0) }
    await shot('T4-hk-seat.png', 3.2, 1.9, -20.5, 7.2, 1.0, -22.8)
    g.biome.switchTo('drift')
    b.position.set(30, 108.6, -184); b.velocity.set(0,0,0)
    for (let i=0;i<60*4;i++){ g.tick(1/60,false); b.position.set(30,108.6,-184); b.velocity.set(0,0,0) }
    await shot('T4-dri-keeper.png', 24, 110.4, -180, 30, 108.8, -188)
    b.position.set(-34, 81.2, -112)
    for (let i=0;i<60*4;i++){ g.tick(1/60,false); b.position.set(-34,81.2,-112); b.velocity.set(0,0,0) }
    await shot('T4-dri-keeper2.png', -38, 82.4, -116, -29, 80.8, -108)
  })
}
