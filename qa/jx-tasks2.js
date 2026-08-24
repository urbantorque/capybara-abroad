async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch(e){} })
  await page.reload(); await page.waitForTimeout(6500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const res = {}
    const down=c=>window.dispatchEvent(new KeyboardEvent('keydown',{code:c,bubbles:true}))
    const up=c=>window.dispatchEvent(new KeyboardEvent('keyup',{code:c,bubbles:true}))
    // ---- great wall: walk into the face and climb ----
    g.biome.switchTo('cave')
    for(let i=0;i<120;i++) g.tick(1/60,false)
    { const b=g.capy.body, ter=g.cave.terrainHeight
      b.position.set(2, ter(2,-96)+0.5, -96); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for(let i=0;i<60;i++) g.tick(1/60,false)
      let climbed=false, maxY=g.capy.position.y
      for(let i=0;i<60*45;i++){
        const p=g.capy.position
        const cy=g.input.camYaw
        const fx=-Math.sin(cy), fz=-Math.cos(cy)
        const vx=2-p.x, vz=-108-p.z
        const f=vx*fx+vz*fz
        up('KeyW');up('KeyS')
        if(f>0) down('KeyW'); else down('KeyS')
        if(i%40===0) down('Space'); if(i%40===6) up('Space')
        g.tick(1/60,false)
        if(g.capy.climbing) climbed=true
        if(g.capy.position.y>maxY) maxY=g.capy.position.y
        if(g.taskDone('great-wall')) break
      }
      up('KeyW');up('KeyS');up('Space')
      res.greatWall = { climbed, maxY:+maxY.toFixed(2), top:13.5, done:g.taskDone('great-wall') }
    }
    // ---- ANTARCTIC ----
    g.biome.switchTo('antarctic')
    for(let i=0;i<120;i++) g.tick(1/60,false)
    const A=g.antarctic
    const put=(x,z,dy)=>{ const b=g.capy.body
      b.position.set(x, A.terrainHeight(x,z)+(dy===undefined?0.5:dy), z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }
    const r2={}
    // colony-chorus
    put(A.colony.x, A.colony.z)
    for(let i=0;i<60;i++){ g.tick(1/60,false); put(A.colony.x,A.colony.z) }
    g.events.emit('capy:wheek'); for(let i=0;i<20;i++) g.tick(1/60,false)
    r2['colony-chorus']=g.taskDone('colony-chorus')
    // whale-bones: sit still in the zone
    put(A.bones.x, A.bones.z)
    for(let i=0;i<60*5;i++){ g.tick(1/60,false); put(A.bones.x,A.bones.z) }
    r2['whale-bones']=g.taskDone('whale-bones')
    // leopard-seal
    { const s=A.seal(), px=s.x+16, pz=s.z+16, b=g.capy.body
      b.position.set(px, A.waterLevel+0.2, pz); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for(let i=0;i<60*25 && !g.taskDone('leopard-seal');i++){
        g.tick(1/60,false)
        const p=b.position
        if(Math.hypot(p.x-px,p.z-pz)>6){ b.position.set(px,A.waterLevel+0.2,pz); b.velocity.set(0,0,0) }
      } }
    r2['leopard-seal']=g.taskDone('leopard-seal')
    // haul-out: stand on the nearest floe
    { const f=A.nearestFloe(), b=g.capy.body
      for(let i=0;i<60*30 && !g.taskDone('haul-out');i++){
        const ff=A.nearestFloe()
        b.position.set(ff.x, A.terrainHeight(ff.x,ff.z)+0.5, ff.z); b.velocity.set(0,0,0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
        g.tick(1/60,false)
      } }
    r2['haul-out']=g.taskDone('haul-out')
    r2['floe-drift']=g.taskDone('floe-drift')
    r2._err = g.state.lastError||null
    res.ant = r2
    return res
  })
  await page.evaluate(async (o)=>{await fetch('/shot?name=jx.json',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))})}, out)
}
