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
      path.push({x:H.x+Math.cos(ra)*rr,y:base+dy,z:H.z+Math.sin(ra)*rr,r:rr}); ra+=CH/rr }
    const res={base:+base.toFixed(2), rest:[]}
    // DROP TEST: place the animal 0.5 m over each of 12 sample segments, settle,
    // and see where it ends up.
    for (const k of [0,5,10,15,20,30,45,60,80,100,115,119]) {
      const t=path[k]
      b.position.set(t.x, t.y+0.55, t.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for(let i=0;i<70;i++) g.tick(1/60,false)
      const p=g.capy.position
      res.rest.push({k, wantY:+t.y.toFixed(2), gotY:+p.y.toFixed(2),
        drift:+Math.hypot(p.x-t.x,p.z-t.z).toFixed(2), grounded:g.capy.grounded,
        r:+Math.hypot(p.x-H.x,p.z-H.z).toFixed(2), wantR:+t.r.toFixed(2)})
    }
    return res
  })
  await page.evaluate(async (o)=>{await fetch('/shot?name=jh.json',{method:'POST',body:btoa(JSON.stringify(o))})}, out)
}
