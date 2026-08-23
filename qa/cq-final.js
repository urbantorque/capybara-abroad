async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.keyboard.press('Enter'); await page.waitForTimeout(1200)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2000)
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
    for (let i=0;i<60*30;i++){ g.tick(1/60,false); b.position.set(4,1.0,26); b.velocity.set(0,0,0) }
    // the Freshwater, close aboard
    const f = g.quay.freshwater()
    await shot('CQ5-freshwater.png', f.x + 26, 10, f.z + 22, f.x, 5, f.z)
    await shot('CQ5-opera.png', 44, 18, -40, 80, 8, 2)
    await shot('CQ5-wide.png', -10, 30, 60, 20, 6, -80)
    await shot('CQ5-manly.png', 118, 16, -505, 118, 4, -585)
    await shot('CQ5-corso.png', 118, 9, -562, 118, 3, -610)
    await shot('CQ5-beach.png', 84, 10, -560, 118, 2, -580)
    await shot('CQ5-north.png', 190, 70, -420, 236, 30, -500)
  })
}
