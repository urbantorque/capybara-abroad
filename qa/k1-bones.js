async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('antarctic')
    for(let i=0;i<120;i++) g.tick(1/60,false)
    const A=g.antarctic, B=A.bones, b=g.capy.body
    b.position.set(B.x, A.terrainHeight(B.x,B.z)+0.6, B.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    const sps=[]
    for(let i=0;i<60*10;i++){
      g.tick(1/60,false)
      const v=b.velocity
      if(i>90) sps.push(+Math.hypot(v.x,v.z).toFixed(2))
    }
    sps.sort((a,c)=>a-c)
    const p=g.capy.position
    return { done:g.taskDone('whale-bones'), inZone:A.inZone('bones',p.x,p.z),
      spMin:sps[0], spMed:sps[(sps.length/2)|0], spMax:sps[sps.length-1],
      over06: sps.filter(s=>s>=0.6).length, n:sps.length,
      y:+p.y.toFixed(2), water:A.waterLevel }
  })
  await page.evaluate(async (o)=>{await fetch('/shot?name=k1.json',{method:'POST',body:btoa(JSON.stringify(o))})}, out)
}
