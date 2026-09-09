async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const res = {}
    // ---- bones ----
    g.biome.switchTo('antarctic')
    for(let i=0;i<120;i++) g.tick(1/60,false)
    const A=g.antarctic, B=A.bones
    const spots=[[0,0],[3,0],[0,3],[-3,2],[2,-3]]
    res.bones=[]
    for(const [ox,oz] of spots){
      const x=B.x+ox, z=B.z+oz
      const b=g.capy.body
      b.position.set(x, A.terrainHeight(x,z)+0.6, z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for(let i=0;i<60*6;i++) g.tick(1/60,false)
      const p=g.capy.position, v=b.velocity
      res.bones.push({ox,oz, inZone:A.inZone('bones',p.x,p.z),
        sp:+Math.hypot(v.x,v.z).toFixed(2), drift:+Math.hypot(p.x-x,p.z-z).toFixed(2),
        done:g.taskDone('whale-bones')})
      if(g.taskDone('whale-bones')) break
    }
    // ---- great wall ----
    g.biome.switchTo('cave')
    for(let i=0;i<120;i++) g.tick(1/60,false)
    const ter=g.cave.terrainHeight
    res.wallProbe=[]
    for(const z of [-92,-96,-98,-100,-102]){
      const b=g.capy.body
      b.position.set(2, ter(2,z)+0.6, z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for(let i=0;i<40;i++) g.tick(1/60,false)
      const p=g.capy.position
      const h = g.cave.climbHold ? g.cave.climbHold(p.x,p.y,p.z) : null
      res.wallProbe.push({z, y:+p.y.toFixed(2), gotZ:+p.z.toFixed(2), hold: h?{nz:h.nz,top:h.top}:null, climbing:g.capy.climbing})
    }
    // drive into the wall with W held and Space
    { const b=g.capy.body
      b.position.set(2, ter(2,-94)+0.6, -94); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for(let i=0;i<40;i++) g.tick(1/60,false)
      const down=c=>window.dispatchEvent(new KeyboardEvent('keydown',{code:c,bubbles:true}))
      const up=c=>window.dispatchEvent(new KeyboardEvent('keyup',{code:c,bubbles:true}))
      // pick the key that moves -z
      const cy=g.input.camYaw
      const fx=-Math.sin(cy), fz=-Math.cos(cy)
      const key = fz < -0.5 ? 'KeyW' : (fz > 0.5 ? 'KeyS' : (fx>0?'KeyA':'KeyD'))
      down(key)
      let climbed=false, maxY=g.capy.position.y
      for(let i=0;i<60*40;i++){ g.tick(1/60,false)
        if(g.capy.climbing) climbed=true
        if(g.capy.position.y>maxY) maxY=g.capy.position.y
        if(g.taskDone('great-wall')) break }
      up(key)
      const p=g.capy.position
      res.wallDrive={key, camYaw:+cy.toFixed(2), climbed, maxY:+maxY.toFixed(2),
        at:[+p.x.toFixed(1),+p.y.toFixed(2),+p.z.toFixed(1)], done:g.taskDone('great-wall')}
    }
    return res
  })
  await page.evaluate(async (o)=>{await fetch('/shot?name=jy.json',{method:'POST',body:btoa(JSON.stringify(o))})}, out)
}
