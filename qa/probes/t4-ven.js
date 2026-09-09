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
    b.position.set(-4, 1.6, -30); b.velocity.set(0,0,0)
    const hold = (n) => { for(let i=0;i<n;i++){ g.tick(1/60,false); b.position.set(-4,1.6,-30); b.velocity.set(0,0,0) } }
    hold(60*2)
    await shot('T4-ven-low.png', -4, 5.0, -14, -4, 1.8, -52)
    await shot('T4-ven-arcade-low.png', -12, 2.6, -26, -19, 1.6, -34)
    await shot('T4-ven-cafe.png', -13, 3.0, -16, -19, 1.6, -22)
    hold(60*84)      // mid rise
    await shot('T4-ven-mid.png', -4, 5.0, -14, -4, 1.8, -52)
    await shot('T4-ven-mid-low.png', -4, 2.2, -22, -4, 1.0, -46)
    hold(60*32)
    await shot('T4-ven-top.png', -4, 5.0, -14, -4, 1.8, -52)
    await shot('T4-ven-top-back.png', -4, 6.0, -50, -4, 1.4, -10)
    await shot('T4-ven-arcade.png', -12, 2.6, -26, -19, 2.0, -34)
  })
}
