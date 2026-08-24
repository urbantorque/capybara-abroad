async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE
    g.biome.switchTo('antarctic')
    for(let i=0;i<180;i++) g.tick(1/60,false)
    const S0 = g.antarctic.seal()
    const b=g.capy.body
    const px=S0.x+16, pz=S0.z+16
    b.position.set(px, g.antarctic.waterLevel+0.2, pz); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    g.renderer.setSize(1280,760,false); g.camera.aspect=1280/760; g.camera.fov=48; g.camera.updateProjectionMatrix()
    let shots=0
    for(let i=0;i<60*40;i++){
      g.tick(1/60,false)
      const p=b.position
      if (Math.hypot(p.x-px,p.z-pz) > 6) { b.position.set(px, g.antarctic.waterLevel+0.2, pz); b.velocity.set(0,0,0) }
      // shoot whenever the seal is high in the water and close
      const s=g.antarctic.seal()
      if (i>60*10 && i%37===0 && shots<3) {
        // find the seal group's real y
        let sy=null
        g.scene.traverse(o=>{ if(o.isGroup && o.children.length===2 && Math.abs(o.position.x-s.x)<0.01) sy=o.position.y })
        if (sy!==null && sy > g.antarctic.waterLevel-0.35) {
          shots++
          g.camera.position.set(px+7, g.antarctic.waterLevel+3.4, pz+8)
          g.camera.lookAt(new THREE.Vector3((px+s.x)/2, g.antarctic.waterLevel+0.3, (pz+s.z)/2))
          g.camera.updateMatrixWorld(true); g.renderer.render(g.scene,g.camera)
          await fetch('/shot?name=S-seal'+shots+'.png',{method:'POST',body:g.renderer.domElement.toDataURL('image/png').split(',')[1]})
        }
      }
    }
  })
}
