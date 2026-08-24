async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('cave')
    const b=g.capy.body, ter=g.cave.terrainHeight
    const H=g.cave.hand, base=ter(H.x,H.z)
    const handR = dy => 7.5 + (1.8-7.5)*Math.min(1,Math.max(0,dy/25))
    const N=120,RISE=0.20,CH=0.95
    const path=[]; let ra=0
    for(let k=0;k<N;k++){ const dy=0.5+k*RISE, rr=handR(dy)+1.15
      path.push({x:H.x+Math.cos(ra)*rr,y:base+dy,z:H.z+Math.sin(ra)*rr}); ra+=CH/rr }
    const t0=path[1]
    b.position.set(t0.x, t0.y+0.55, t0.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for(let i=0;i<60;i++) g.tick(1/60,false)
    // drive by writing horizontal velocity toward the next segment: the SOLVER
    // still has to carry the animal up the shelf, only the steering is faked
    let maxY=g.capy.position.y, off=0
    for(let i=0;i<60*170;i++){
      const p=g.capy.position
      let cur=Math.round((p.y-base-1.2)/RISE); if(cur<0)cur=0; if(cur>N-2)cur=N-2
      const t=cur>=N-4?{x:H.x,z:H.z}:path[Math.min(N-1,cur+2)]
      const vx=t.x-p.x, vz=t.z-p.z, d=Math.hypot(vx,vz)||1
      b.velocity.x=(vx/d)*3.2; b.velocity.z=(vz/d)*3.2
      g.tick(1/60,false)
      if(g.capy.position.y>maxY) maxY=g.capy.position.y
      const rr=Math.hypot(g.capy.position.x-H.x, g.capy.position.z-H.z)
      if(g.taskDone('hand-of-dog')) break
    }
    return { base:+base.toFixed(2), maxY:+maxY.toFixed(2), taskAt:+(base+24).toFixed(2),
             done:g.taskDone('hand-of-dog'), finalY:+g.capy.position.y.toFixed(2) }
  })
  await page.evaluate(async (o)=>{await fetch('/shot?name=ji.json',{method:'POST',body:btoa(JSON.stringify(o))})}, out)
}
