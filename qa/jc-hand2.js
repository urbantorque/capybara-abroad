async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('cave')
    const b = g.capy.body, ter = g.cave.terrainHeight
    const H = g.cave.hand, base = ter(H.x, H.z)
    const RISE=0.78, N=32, TURN=0.46
    const handR = dy => 7.5 + (1.8-7.5)*Math.min(1,Math.max(0,dy/25))
    const down=c=>window.dispatchEvent(new KeyboardEvent('keydown',{code:c,bubbles:true}))
    const up=c=>window.dispatchEvent(new KeyboardEvent('keyup',{code:c,bubbles:true}))
    // put the animal at the FOOT and climb the whole thing in one go
    const a0=0, r0=handR(0.55)*0.95
    b.position.set(H.x+Math.cos(a0)*r0+2.2, base+0.55+0.6, H.z+Math.sin(a0)*r0)
    b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for(let i=0;i<60;i++) g.tick(1/60,false)
    const res={ base:+base.toFixed(2), trace:[] }
    let k=0, stuck=0, lastY=g.capy.position.y, spaceDown=false
    for(let i=0;i<60*140 && k<N-1;i++){
      const dy2=0.55+(k+1)*RISE, a2=(k+1)*TURN, rr2=handR(dy2)*0.95
      const tx=H.x+Math.cos(a2)*rr2, tz=H.z+Math.sin(a2)*rr2, ty=base+dy2
      const p=g.capy.position
      const vx=tx-p.x, vz=tz-p.z
      const cy=g.input.camYaw
      const fx=-Math.sin(cy), fz=-Math.cos(cy)
      const rx=Math.cos(cy), rz=-Math.sin(cy)
      const f=vx*fx+vz*fz, r=vx*rx+vz*rz
      up('KeyW');up('KeyS');up('KeyA');up('KeyD')
      const d=Math.hypot(vx,vz)
      if(d>0.6){ if(f>0.2)down('KeyW'); else if(f<-0.2)down('KeyS'); if(r>0.2)down('KeyD'); else if(r<-0.2)down('KeyA') }
      // hop whenever grounded, below the target, and pointed roughly at it
      if(g.capy.grounded && p.y < ty-0.2 && d < 3.4 && !spaceDown){ down('Space'); spaceDown=true }
      else if(spaceDown && i%4===0){ up('Space'); spaceDown=false }
      g.tick(1/60,false)
      if(g.capy.position.y > ty-0.35 && g.capy.grounded && Math.hypot(g.capy.position.x-tx,g.capy.position.z-tz)<2.2){ k++; stuck=0; continue }
      if(++stuck>60*9){ res.trace.push({k, need:+ty.toFixed(2), at:+g.capy.position.y.toFixed(2)}); break }
    }
    up('KeyW');up('KeyS');up('KeyA');up('KeyD');up('Space')
    res.reached=k; res.N=N
    res.finalY=+g.capy.position.y.toFixed(2)
    res.taskAt=+(base+24).toFixed(2)
    res.topLedge=+(base+0.55+(N-1)*RISE).toFixed(2)
    // now put it on the top ledge and hop for the tip
    const tipY = base + 0.55 + (N-1)*RISE + 0.78
    res.tipY=+tipY.toFixed(2)
    res.done = g.taskDone('hand-of-dog')
    return res
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=jc.json',{method:'POST',body:btoa(JSON.stringify(o))}) }, out)
}
