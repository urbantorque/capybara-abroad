async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE
    g.biome.switchTo('antarctic')
    const b=g.capy.body, ter=g.antarctic.terrainHeight
    const C=g.antarctic.colony
    const px=C.x, pz=C.z+22
    b.position.set(px, ter(px,pz)+0.5, pz); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for(let i=0;i<300;i++){ g.tick(1/60,false); b.position.set(px, ter(px,pz)+0.5, pz); b.velocity.set(0,0,0) }
    g.renderer.setSize(1280,760,false); g.camera.aspect=1280/760; g.camera.fov=55; g.camera.updateProjectionMatrix()
    const shot = async (n)=>{
      g.camera.position.set(C.x-4, ter(C.x,C.z)+26, C.z+46)
      g.camera.lookAt(new THREE.Vector3(C.x, ter(C.x,C.z)+1, C.z-4))
      g.camera.updateMatrixWorld(true); g.renderer.render(g.scene,g.camera)
      await fetch('/shot?name='+n, {method:'POST', body:g.renderer.domElement.toDataURL('image/png').split(',')[1]})
    }
    await shot('P-cho-0.png')
    g.events.emit('capy:wheek')
    for(let i=0;i<36;i++){ g.tick(1/60,false); b.position.set(px, ter(px,pz)+0.5, pz); b.velocity.set(0,0,0) }
    await shot('P-cho-1.png')
    for(let i=0;i<60;i++){ g.tick(1/60,false); b.position.set(px, ter(px,pz)+0.5, pz); b.velocity.set(0,0,0) }
    await shot('P-cho-2.png')
    for(let i=0;i<60;i++){ g.tick(1/60,false); b.position.set(px, ter(px,pz)+0.5, pz); b.velocity.set(0,0,0) }
    await shot('P-cho-3.png')
    return { err: g.state.lastError||null, done: g.taskDone('colony-chorus') }
  })
  await page.evaluate(async (o)=>{await fetch('/shot?name=jj.json',{method:'POST',body:btoa(JSON.stringify(o))})}, out)
}
