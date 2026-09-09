async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE
    g.biome.switchTo('kowloon')
    const b = g.capy.body
    b.position.set(0,1.4,-56); b.velocity.set(0,0,0)
    for (let i=0;i<60*82;i++){ g.tick(1/60,false); b.position.set(0,1.4,-56); b.velocity.set(0,0,0) }
    g.renderer.setSize(1280, 760, false)
    g.camera.aspect = 1280/760; g.camera.fov = 50; g.camera.far = 4000
    g.camera.updateProjectionMatrix()
    g.camera.position.set(0, 26, -46)
    g.camera.lookAt(new THREE.Vector3(0, -0.5, -150))
    g.camera.updateMatrixWorld(true)
    g.renderer.render(g.scene, g.camera)
    await fetch('/shot?name=H5-water.png', { method:'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
  })
}
