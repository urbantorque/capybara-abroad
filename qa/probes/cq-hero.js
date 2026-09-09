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
    for (let i=0;i<60*20;i++){ g.tick(1/60,false); b.position.set(4,1.0,26); b.velocity.set(0,0,0) }
    await shot('CQ0-H1-terminal.png', 6, 26, 78, 4, 4, 0)
    await shot('CQ0-H2-bridge.png', 12, 30, 20, 12, 12, -70)
    b.position.set(6.6,1.0,10); b.velocity.set(0,0,0)
    for (let i=0;i<60*4;i++){ g.tick(1/60,false); b.position.set(6.6,1.0,10); b.velocity.set(0,0,0) }
    await shot('CQ0-H3-berth.png', 24, 9, 26, 6, 1, 4)
    await shot('CQ0-H4-harbour.png', -30, 60, -120, 40, 0, -330)
    await shot('CQ0-H5-manly.png', 118, 22, -500, 118, 4, -600)
    await shot('CQ0-H6-corso.png', 118, 18, -570, 118, 3, -630)
    await shot('CQ0-H7-fort.png', 20, 12, -100, 6, 4, -126)
  })
}
