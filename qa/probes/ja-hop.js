async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('cave')
    const b = g.capy.body, ter = g.cave.terrainHeight
    const res = {}
    // 1. plain hop height on flat ground in the cave
    const px=0, pz=0
    b.position.set(px, ter(px,pz)+0.4, pz); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for(let i=0;i<120;i++) g.tick(1/60,false)
    const y0 = g.capy.position.y
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}))
    for(let i=0;i<6;i++) g.tick(1/60,false)
    window.dispatchEvent(new KeyboardEvent('keyup',{code:'Space',bubbles:true}))
    let top=y0
    for(let i=0;i<120;i++){ g.tick(1/60,false); if(g.capy.position.y>top) top=g.capy.position.y }
    res.hop = +(top-y0).toFixed(2)
    // 2. the Hand of Dog: ledge geometry
    const H = g.cave.hand
    res.hand = H
    res.handBase = +ter(H.x,H.z).toFixed(2)
    // 3. try to climb it: nudge onto each ledge in turn and see if a hop reaches the next
    const reach = []
    for (let k=0;k<10;k++){
      const a=k*1.05, rr=8.4+(3.0-8.4)*(k/9)
      const lx=H.x+Math.cos(a)*rr, lz=H.z+Math.sin(a)*rr
      const ly=res.handBase+1.0+k*2.45
      reach.push({k, r:+rr.toFixed(1), y:+ly.toFixed(2)})
    }
    res.ledges = reach
    // 4. drop the animal on ledge 0 and try to hop to ledge 1
    const l0=reach[0], l1=reach[1]
    b.position.set(l0.r*Math.cos(0)+H.x, l0.y+0.9, l0.r*Math.sin(0)+H.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for(let i=0;i<90;i++) g.tick(1/60,false)
    res.onL0 = { x:+g.capy.position.x.toFixed(2), y:+g.capy.position.y.toFixed(2), z:+g.capy.position.z.toFixed(2), grounded:g.capy.grounded }
    res.needed = +(l1.y - l0.y).toFixed(2)
    return res
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=ja.json',{method:'POST',body:btoa(JSON.stringify(o))}) }, out)
}
