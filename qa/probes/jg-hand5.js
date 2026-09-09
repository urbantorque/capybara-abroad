async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE
    g.biome.switchTo('cave')
    const b = g.capy.body, ter = g.cave.terrainHeight
    const H = g.cave.hand, base = ter(H.x, H.z)
    const handR = dy => 7.5 + (1.8-7.5)*Math.min(1,Math.max(0,dy/25))
    const N=120, RISE=0.20, CH=0.95
    const path=[]; let ra=0
    for(let k=0;k<N;k++){ const dy=0.5+k*RISE, rr=handR(dy)+0.90
      path.push({x:H.x+Math.cos(ra)*rr, y:base+dy, z:H.z+Math.sin(ra)*rr}); ra+=CH/rr }
    const down=c=>window.dispatchEvent(new KeyboardEvent('keydown',{code:c,bubbles:true}))
    const up=c=>window.dispatchEvent(new KeyboardEvent('keyup',{code:c,bubbles:true}))
    const res={base:+base.toFixed(2), turns:+(ra/Math.PI/2).toFixed(2)}
    b.position.set(path[1].x, path[1].y+0.6, path[1].z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for(let i=0;i<60;i++) g.tick(1/60,false)
    let maxY=g.capy.position.y, stall=0, lastMax=maxY, trace=[]
    for(let i=0;i<60*260;i++){
      const p=g.capy.position
      // target = 4 segments ahead of whichever segment we are level with
      let cur = Math.round((p.y - base - 0.5)/RISE)
      if(cur<0) cur=0; if(cur>N-2) cur=N-2
      const t = path[Math.min(N-1, cur+4)]
      const vx=t.x-p.x, vz=t.z-p.z
      const cy=g.input.camYaw
      const fx=-Math.sin(cy), fz=-Math.cos(cy), rx=Math.cos(cy), rz=-Math.sin(cy)
      const f=vx*fx+vz*fz, r=vx*rx+vz*rz
      up('KeyW');up('KeyS');up('KeyA');up('KeyD')
      if(f>0.12)down('KeyW'); else if(f<-0.12)down('KeyS')
      if(r>0.12)down('KeyD'); else if(r<-0.12)down('KeyA')
      g.tick(1/60,false)
      if(g.capy.position.y>maxY) maxY=g.capy.position.y
      if(i%120===0) trace.push(+g.capy.position.y.toFixed(2))
      if(i%180===0){ if(maxY-lastMax < 0.35){ stall++ } else stall=0; lastMax=maxY; if(stall>=6) break }
      if(g.taskDone('hand-of-dog')) break
    }
    up('KeyW');up('KeyS');up('KeyA');up('KeyD')
    res.maxY=+maxY.toFixed(2); res.taskAt=+(base+24).toFixed(2)
    res.done=g.taskDone('hand-of-dog'); res.trace=trace.slice(0,60)
    res.finalY=+g.capy.position.y.toFixed(2)
    return res
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=jg.json',{method:'POST',body:btoa(JSON.stringify(o))}) }, out)
}
