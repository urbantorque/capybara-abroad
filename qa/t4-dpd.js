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
    g.biome.switchTo('kowloon')
    b.position.set(2, 1.4, -20); b.velocity.set(0,0,0)
    for (let i=0;i<60*6;i++){ g.tick(1/60,false); b.position.set(2,1.4,-20); b.velocity.set(0,0,0) }
    await shot('T4-hk-dpd.png', -1, 2.6, -18, 8, 1.2, -25)
    await shot('T4-hk-dpd2.png', 2, 3.6, -34, 8, 1.4, -22)
    await shot('T4-hk-street3.png', 0, 2.2, 6, 0, 1.4, -40)
  })
}
