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
    b.position.set(0, 1.4, 34); b.velocity.set(0,0,0)
    const hold = (n,x,y,z) => { for(let i=0;i<n;i++){ g.tick(1/60,false); b.position.set(x,y,z); b.velocity.set(0,0,0) } }
    hold(60*3, 0,1.4,34)
    await shot('T4-hk-street.png', 0, 2.4, 40, 0, 1.6, 0)
    await shot('T4-hk-street2.png', 3, 1.8, 10, -2, 3.0, -30)
    // roof, before the show
    b.position.set(-10.5, 35.4, 0)
    hold(60*40, -10.5, 35.4, 0)
    await shot('T4-hk-roof-pre.png', -3, 43, 14, -13, 33, -40)
  })
}
