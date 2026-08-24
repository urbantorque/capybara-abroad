async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE
    g.biome.switchTo('cave')
    const b = g.capy.body, ter = g.cave.terrainHeight
    const px=15, pz=-24
    b.position.set(px, ter(px,pz)+0.5, pz); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i=0;i<300;i++){ g.tick(1/60,false); b.position.set(px, ter(px,pz)+0.5, pz); b.velocity.set(0,0,0) }
    g.renderer.setSize(1280,760,false); g.camera.aspect=1280/760; g.camera.fov=52; g.camera.updateProjectionMatrix()
    // from the doline side, looking BACK up the passage: the green faces
    g.camera.position.set(11, ter(11,-40)+7, -42)
    g.camera.lookAt(new THREE.Vector3(15, ter(15,-26)+1.4, -26))
    g.camera.updateMatrixWorld(true); g.renderer.render(g.scene, g.camera)
    await fetch('/shot?name=M-phyto-lit.png', { method:'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
    g.camera.position.set(15, ter(15,-24)+8, -6)
    g.camera.lookAt(new THREE.Vector3(13, ter(13,-34)+1, -38))
    g.camera.updateMatrixWorld(true); g.renderer.render(g.scene, g.camera)
    await fetch('/shot?name=M-phyto-back.png', { method:'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
  })
}
