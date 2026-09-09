async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('cave')
    const b = g.capy.body, ter = g.cave.terrainHeight
    const H = g.cave.hand, base = ter(H.x, H.z)
    const res = { base:+base.toFixed(2), steps:[] }
    const down=c=>window.dispatchEvent(new KeyboardEvent('keydown',{code:c,bubbles:true}))
    const up=c=>window.dispatchEvent(new KeyboardEvent('keyup',{code:c,bubbles:true}))
    const handR = dy => 7.5 + (1.8-7.5)*Math.min(1,Math.max(0,dy/25))
    // walk the spiral: place on ledge k, steer to ledge k+1, hop
    let ok = 0
    for (let k=0;k<26;k++){
      const dy=1.1+k*0.90, a=k*0.52, rr=handR(dy)*0.95
      const lx=H.x+Math.cos(a)*rr, lz=H.z+Math.sin(a)*rr
      const dy2=1.1+(k+1)*0.90, a2=(k+1)*0.52, rr2=handR(dy2)*0.95
      const tx=H.x+Math.cos(a2)*rr2, tz=H.z+Math.sin(a2)*rr2
      b.position.set(lx, base+dy+0.55, lz); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for(let i=0;i<45;i++) g.tick(1/60,false)
      const y0=g.capy.position.y
      // aim: camera-relative WASD toward the target
      let reached=false, best=y0
      for(let i=0;i<170;i++){
        const p=g.capy.position
        const vx=tx-p.x, vz=tz-p.z
        const cy=g.input.camYaw
        // forward (W) in world = (sin(cy+PI), cos(cy+PI)) ... use camera basis
        const fx=-Math.sin(cy), fz=-Math.cos(cy)
        const rx=Math.cos(cy), rz=-Math.sin(cy)
        const f=vx*fx+vz*fz, r=vx*rx+vz*rz
        up('KeyW');up('KeyS');up('KeyA');up('KeyD')
        if(f>0.25)down('KeyW'); else if(f<-0.25)down('KeyS')
        if(r>0.25)down('KeyD'); else if(r<-0.25)down('KeyA')
        if(i===26||i===70||i===114){ down('Space'); }
        if(i===30||i===74||i===118){ up('Space') }
        g.tick(1/60,false)
        if(g.capy.position.y>best) best=g.capy.position.y
        if(Math.hypot(p.x-tx,p.z-tz)<1.3 && p.y>base+dy2-0.5 && g.capy.grounded){ reached=true; break }
      }
      up('KeyW');up('KeyS');up('KeyA');up('KeyD');up('Space')
      if(reached) ok++
      else res.steps.push({k, need:+(base+dy2).toFixed(2), got:+best.toFixed(2), at:{x:+g.capy.position.x.toFixed(1),y:+g.capy.position.y.toFixed(2),z:+g.capy.position.z.toFixed(1)}})
    }
    res.ok = ok
    res.taskAt = +(base+24).toFixed(2)
    res.topLedge = +(base+1.1+26*0.9).toFixed(2)
    return res
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=jb.json',{method:'POST',body:btoa(JSON.stringify(o))}) }, out)
}
