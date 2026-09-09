async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('antarctic')
    for(let i=0;i<120;i++) g.tick(1/60,false)
    const A=g.antarctic, B=A.bones, b=g.capy.body
    const res=[]
    for (const off of [[0,0],[1,0],[2,0],[3,0],[0,2],[-2,-2],[4,2]]) {
      // reset the latch by leaving and coming back
      g.biome.switchTo('cave'); for(let i=0;i<40;i++) g.tick(1/60,false)
      g.biome.switchTo('antarctic'); for(let i=0;i<40;i++) g.tick(1/60,false)
      const x=B.x+off[0], z=B.z+off[1]
      b.position.set(x, A.terrainHeight(x,z)+0.6, z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      let allIn=true, maxSp=0
      for(let i=0;i<60*8;i++){
        g.tick(1/60,false)
        if(i>60){
          const p=g.capy.position
          if(!A.inZone('bones',p.x,p.z)) allIn=false
          const v=b.velocity; const s=Math.hypot(v.x,v.z); if(s>maxSp) maxSp=s
        }
        if(g.taskDone('whale-bones')) break
      }
      const p=g.capy.position
      res.push({off, done:g.taskDone('whale-bones'), allIn, maxSp:+maxSp.toFixed(2),
                d:+Math.hypot(p.x-B.x,p.z-B.z).toFixed(2), y:+p.y.toFixed(2)})
      if(g.taskDone('whale-bones')) break
    }
    return res
  })
  await page.evaluate(async (o)=>{await fetch('/shot?name=k2.json',{method:'POST',body:btoa(JSON.stringify(o))})}, out)
}
