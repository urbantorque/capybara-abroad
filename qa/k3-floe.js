async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('antarctic')
    for(let i=0;i<120;i++) g.tick(1/60,false)
    const A=g.antarctic, b=g.capy.body
    const f=A.nearestFloe()
    b.position.set(f.x, A.terrainHeight(f.x,f.z)+0.6, f.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    let t=0
    for(let i=0;i<60*140;i++){ g.tick(1/60,false); t=i/60; if(g.taskDone('floe-drift')) break }
    const p=g.capy.position
    return { haulOut:g.taskDone('haul-out'), floeDrift:g.taskDone('floe-drift'),
             secs:+t.toFixed(1), at:[+p.x.toFixed(1),+p.y.toFixed(2),+p.z.toFixed(1)],
             err:g.state.lastError||null }
  })
  await page.evaluate(async (o)=>{await fetch('/shot?name=k3.json',{method:'POST',body:btoa(JSON.stringify(o))})}, out)
}
