async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE
    g.biome.switchTo('cave')
    const b=g.capy.body, ter=g.cave.terrainHeight
    const D=g.cave.doline
    b.position.set(D.x, ter(D.x,D.z)+0.5, D.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for(let i=0;i<600;i++){ g.tick(1/60,false); b.position.set(D.x, ter(D.x,D.z)+0.5, D.z); b.velocity.set(0,0,0) }
    g.renderer.setSize(1280,760,false); g.camera.aspect=1280/760; g.camera.fov=60; g.camera.updateProjectionMatrix()
    // look up the column from the glade
    g.camera.position.set(D.x+2, ter(D.x,D.z)+2.4, D.z+14)
    g.camera.lookAt(new THREE.Vector3(D.x, ter(D.x,D.z)+80, D.z))
    g.camera.updateMatrixWorld(true); g.renderer.render(g.scene,g.camera)
    await fetch('/shot?name=U-shaft.png',{method:'POST',body:g.renderer.domElement.toDataURL('image/png').split(',')[1]})
    // count the instanced populations
    let swirl=0, leaves=0
    g.scene.traverse(o=>{ if(o.isInstancedMesh){ if(o.count===16) swirl=o.count; if(o.count===34) leaves=o.count } })
    return { swirl, leaves, sky:g.cave.skyward() }
  })
  await page.evaluate(async (o)=>{await fetch('/shot?name=k5.json',{method:'POST',body:btoa(JSON.stringify(o))})}, out)
}
