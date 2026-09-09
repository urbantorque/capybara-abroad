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
    for (let i=0;i<60*25;i++){ g.tick(1/60,false); b.position.set(4,1.0,26); b.velocity.set(0,0,0) }
    await shot('CQ2-concourse.png', 4, 8, 4, 0, 2, 40)
    await shot('CQ2-crowd.png', -6, 5, 14, -4, 1.6, 34)
    await shot('CQ2-bridge.png', 12, 26, 10, 12, 20, -62)
    await shot('CQ2-opera.png', 34, 14, -34, 78, 8, 4)
    await shot('CQ2-sea.png', 20, 14, -110, 40, 0, -300)
    await shot('CQ2-manlywharf.png', 118, 12, -520, 118, 4, -572)
  })
}
