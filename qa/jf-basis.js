async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('cave')
    const b=g.capy.body, ter=g.cave.terrainHeight
    const res={}
    const test = (key)=>{
      b.position.set(0, ter(0,0)+0.5, 0); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for(let i=0;i<40;i++) g.tick(1/60,false)
      const cy=g.input.camYaw
      const p0={x:g.capy.position.x,z:g.capy.position.z}
      window.dispatchEvent(new KeyboardEvent('keydown',{code:key,bubbles:true}))
      for(let i=0;i<70;i++) g.tick(1/60,false)
      window.dispatchEvent(new KeyboardEvent('keyup',{code:key,bubbles:true}))
      const dx=g.capy.position.x-p0.x, dz=g.capy.position.z-p0.z
      return { key, camYaw:+cy.toFixed(3), dx:+dx.toFixed(2), dz:+dz.toFixed(2),
               dir:+Math.atan2(dx,dz).toFixed(3) }
    }
    res.W=test('KeyW'); res.D=test('KeyD'); res.A=test('KeyA'); res.S=test('KeyS')
    return res
  })
  await page.evaluate(async (o)=>{await fetch('/shot?name=jf.json',{method:'POST',body:btoa(JSON.stringify(o))})}, out)
}
