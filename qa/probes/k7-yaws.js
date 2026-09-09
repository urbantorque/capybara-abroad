async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('cave')
    const b=g.capy.body, ter=g.cave.terrainHeight, D=g.cave.doline
    let n=0
    for (const yaw of [0, 1.6, 3.14, 4.7]) {
      b.position.set(D.x, ter(D.x,D.z)+0.5, D.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.input.camYaw = yaw
      for(let i=0;i<420;i++){ g.tick(1/60,false); b.position.set(D.x, ter(D.x,D.z)+0.5, D.z); b.velocity.set(0,0,0); g.input.camYaw=yaw }
      g.renderer.setSize(1280,760,false); g.camera.aspect=1280/760; g.camera.updateProjectionMatrix()
      g.tick(1/60,true)
      await fetch('/shot?name=V-dol'+(++n)+'.png',{method:'POST',body:g.renderer.domElement.toDataURL('image/png').split(',')[1]})
    }
  })
}
