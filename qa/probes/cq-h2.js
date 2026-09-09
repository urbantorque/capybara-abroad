async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(640, 400)
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
    g.biome.switchTo('quay')
    b.position.set(4, 1.0, 26); b.velocity.set(0,0,0)
    for (let i=0;i<60*15;i++){ g.tick(1/60,false); b.position.set(4,1.0,26); b.velocity.set(0,0,0) }
    await shot('CQ1-opera.png', 40, 16, -46, 80, 8, 4)
    await shot('CQ1-operaclose.png', 62, 12, -30, 80, 10, 4)
    await shot('CQ1-city.png', 10, 30, -80, 6, 22, 90)
    await shot('CQ1-quaywide.png', -10, 24, -70, 10, 6, 30)
    await shot('CQ1-apron.png', 0, 12, -6, 6, 3, 40)
  })
}
