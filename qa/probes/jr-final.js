async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const cam = async (o) => {
    await page.evaluate(async (q) => {
      const g = window.__capy, THREE = g.THREE
      if (g.biome.current !== q.biome) g.biome.switchTo(q.biome)
      const b=g.capy.body, ter=g[q.api].terrainHeight
      b.position.set(q.px, ter(q.px,q.pz)+0.5, q.pz); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      if (q.yaw !== undefined) g.input.camYaw = q.yaw
      for(let i=0;i<(q.warm||400);i++){ g.tick(1/60,false)
        b.position.set(q.px, ter(q.px,q.pz)+0.5, q.pz); b.velocity.set(0,0,0)
        if (q.yaw !== undefined) g.input.camYaw = q.yaw }
      g.renderer.setSize(1280,760,false); g.camera.aspect=1280/760; g.camera.updateProjectionMatrix()
      g.tick(1/60,true)
      await fetch('/shot?name='+q.name,{method:'POST',body:g.renderer.domElement.toDataURL('image/png').split(',')[1]})
    }, o)
  }
  await cam({biome:'cave',api:'cave',px:4,pz:-48,yaw:1.2,name:'T-cav-doline.png'})
  await cam({biome:'cave',api:'cave',px:15,pz:-24,yaw:3.6,name:'T-cav-phyto.png'})
  await cam({biome:'cave',api:'cave',px:8,pz:2,yaw:0.6,name:'T-cav-hand.png'})
  await cam({biome:'cave',api:'cave',px:0,pz:-162,yaw:3.14,name:'T-cav-slot.png'})
  await cam({biome:'antarctic',api:'antarctic',px:24,pz:100,yaw:0.2,name:'T-ant-colony.png'})
  await cam({biome:'antarctic',api:'antarctic',px:0,pz:52,yaw:3.14,name:'T-ant-spawn.png'})
}
