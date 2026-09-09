async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE
    g.biome.switchTo('antarctic')
    for(let i=0;i<120;i++) g.tick(1/60,false)
    const C=g.antarctic.colony
    let ground=null
    g.scene.traverse(o=>{ if(o.isMesh&&o.geometry&&o.geometry.attributes&&o.geometry.attributes.color&&o.geometry.attributes.position.count===16799) ground=o })
    const res={found:!!ground, samples:[]}
    if(ground){
      const pos=ground.geometry.attributes.position, col=ground.geometry.attributes.color
      const at=(X,Z)=>{let b=-1,bd=1e9;for(let i=0;i<pos.count;i++){const dx=pos.getX(i)-X,dz=pos.getZ(i)-Z;const d=dx*dx+dz*dz;if(d<bd){bd=d;b=i}}
        return [+col.getX(b).toFixed(3),+col.getY(b).toFixed(3),+col.getZ(b).toFixed(3)]}
      res.samples.push({p:'centre',    c:at(C.x,C.z)})
      res.samples.push({p:'off-track', c:at(C.x+9,C.z+9)})
      res.samples.push({p:'off-track2',c:at(C.x-10,C.z+6)})
      res.samples.push({p:'rim',       c:at(C.x+18,C.z)})
      res.samples.push({p:'clean snow',c:at(C.x+70,C.z-20)})
    }
    // and a real ground-level picture of the colony
    const b=g.capy.body, ter=g.antarctic.terrainHeight
    const px=C.x-6, pz=C.z+10
    b.position.set(px,ter(px,pz)+0.5,pz); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for(let i=0;i<200;i++){ g.tick(1/60,false); b.position.set(px,ter(px,pz)+0.5,pz); b.velocity.set(0,0,0) }
    g.renderer.setSize(1280,760,false); g.camera.aspect=1280/760; g.camera.fov=52; g.camera.updateProjectionMatrix()
    g.camera.position.set(C.x-2, ter(C.x,C.z)+13, C.z+30)
    g.camera.lookAt(new THREE.Vector3(C.x+2, ter(C.x,C.z)+1, C.z-6))
    g.camera.updateMatrixWorld(true); g.renderer.render(g.scene,g.camera)
    await fetch('/shot?name=Q-colony.png',{method:'POST',body:g.renderer.domElement.toDataURL('image/png').split(',')[1]})
    return res
  })
  await page.evaluate(async (o)=>{await fetch('/shot?name=jl.json',{method:'POST',body:btoa(JSON.stringify(o))})}, out)
}
