async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE
    // 1. the Hand of Dog, lit by an echo
    g.biome.switchTo('cave')
    const b=g.capy.body, ter=g.cave.terrainHeight, H=g.cave.hand
    b.position.set(H.x+11, ter(H.x+11,H.z+6)+0.5, H.z+6); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for(let i=0;i<300;i++){ g.tick(1/60,false); b.position.set(H.x+11, ter(H.x+11,H.z+6)+0.5, H.z+6); b.velocity.set(0,0,0) }
    g.events.emit('capy:wheek')
    for(let i=0;i<14;i++){ g.tick(1/60,false); b.position.set(H.x+11, ter(H.x+11,H.z+6)+0.5, H.z+6); b.velocity.set(0,0,0) }
    g.renderer.setSize(1280,760,false); g.camera.aspect=1280/760; g.camera.fov=54; g.camera.updateProjectionMatrix()
    g.camera.position.set(H.x+22, ter(H.x,H.z)+11, H.z+21)
    g.camera.lookAt(new THREE.Vector3(H.x, ter(H.x,H.z)+11, H.z))
    g.camera.updateMatrixWorld(true); g.renderer.render(g.scene,g.camera)
    await fetch('/shot?name=W-hand.png',{method:'POST',body:g.renderer.domElement.toDataURL('image/png').split(',')[1]})
    // 2. the colony from the water, which is the guano test
    g.biome.switchTo('antarctic')
    const A=g.antarctic, C=A.colony
    for(let i=0;i<200;i++) g.tick(1/60,false)
    g.camera.position.set(C.x+6, A.waterLevel+16, C.z-92)
    g.camera.lookAt(new THREE.Vector3(C.x, A.terrainHeight(C.x,C.z)+2, C.z))
    g.camera.fov=42; g.camera.updateProjectionMatrix(); g.camera.updateMatrixWorld(true)
    g.renderer.render(g.scene,g.camera)
    await fetch('/shot?name=W-colony.png',{method:'POST',body:g.renderer.domElement.toDataURL('image/png').split(',')[1]})
  })
}
