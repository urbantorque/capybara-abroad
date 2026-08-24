async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('cave')
    for(let i=0;i<120;i++) g.tick(1/60,false)
    const ter=g.cave.terrainHeight, b=g.capy.body
    b.position.set(2, ter(2,-98)+0.6, -98); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for(let i=0;i<40;i++) g.tick(1/60,false)
    const down=c=>window.dispatchEvent(new KeyboardEvent('keydown',{code:c,bubbles:true}))
    const up=c=>window.dispatchEvent(new KeyboardEvent('keyup',{code:c,bubbles:true}))
    const cy=g.input.camYaw
    const fz=-Math.cos(cy)
    const key = fz < 0 ? 'KeyW' : 'KeyS'
    down('KeyE'); down(key)
    let climbed=false, maxY=g.capy.position.y
    for(let i=0;i<60*45;i++){
      g.tick(1/60,false)
      if(g.capy.climbing) climbed=true
      if(g.capy.position.y>maxY) maxY=g.capy.position.y
      if(g.taskDone('great-wall')) break
      if(maxY > 14.5 && g.capy.climbing===false) break
    }
    up('KeyE'); up(key)
    // once over the crest, let go and step forward
    down(key)
    for(let i=0;i<60*8;i++){ g.tick(1/60,false); if(g.taskDone('great-wall')) break }
    up(key)
    const p=g.capy.position
    return { climbed, maxY:+maxY.toFixed(2), wallTop:13.5,
             at:[+p.x.toFixed(1),+p.y.toFixed(2),+p.z.toFixed(1)], done:g.taskDone('great-wall'),
             err:g.state.lastError||null }
  })
  await page.evaluate(async (o)=>{await fetch('/shot?name=jz.json',{method:'POST',body:btoa(JSON.stringify(o))})}, out)
}
