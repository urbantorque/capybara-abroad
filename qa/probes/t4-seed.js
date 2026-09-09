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
    g.biome.switchTo('venice')
    b.position.set(-4, 1.6, -26); b.velocity.set(0,0,0)
    const hold = (n) => { for(let i=0;i<n;i++){ g.tick(1/60,false); b.position.set(-4,1.6,-26); b.velocity.set(0,0,0) } }
    hold(60*10)
    await shot('T4-ven-seed1.png', -4, 3.4, -12, -8, 0.8, -20)
    hold(60*3)
    await shot('T4-ven-seed2.png', -4, 3.4, -12, -8, 0.8, -20)
    hold(60*3)
    await shot('T4-ven-seed3.png', -4, 3.4, -12, -8, 0.8, -20)
  })
}
