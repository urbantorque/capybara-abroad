async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE
    g.biome.switchTo('cave')
    const b = g.capy.body, ter = g.cave.terrainHeight
    const px=15, pz=-24
    b.position.set(px, ter(px,pz)+0.5, pz); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i=0;i<300;i++){ g.tick(1/60,false); b.position.set(px, ter(px,pz)+0.5, pz); b.velocity.set(0,0,0) }
    const r = { doneBefore: g.taskDone('phytokarst') }
    g.events.emit('capy:wheek')
    for (let i=0;i<20;i++){ g.tick(1/60,false); b.position.set(px, ter(px,pz)+0.5, pz); b.velocity.set(0,0,0) }
    r.doneAfter = g.taskDone('phytokarst')
    g.renderer.setSize(1280,760,false); g.camera.aspect=1280/760; g.camera.updateProjectionMatrix()
    g.tick(1/60,true)
    await fetch('/shot?name=M-phyto.png', { method:'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
    // and a wide look at the garden
    g.camera.position.set(15, ter(15,-24)+8, -6)
    g.camera.lookAt(new THREE.Vector3(13, ter(13,-34)+1, -38))
    g.camera.updateMatrixWorld(true); g.renderer.render(g.scene, g.camera)
    await fetch('/shot?name=M-phyto-wide.png', { method:'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
    r.err = g.state.lastError || null
    return r
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=j8.json', { method:'POST', body: btoa(JSON.stringify(o)) }) }, out)
}
