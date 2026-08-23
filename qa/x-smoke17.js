async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const names = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                   'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic']
    const R = {}
    for (const n of names) {
      g.state.lastError = null
      g.biome.switchTo(n)
      const s = g.biome.spawnOf(n), b = g.capy.body
      b.position.set(s.x, s.y, s.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<400;i++) { g.input.x = Math.sin(i*0.07); g.input.z = Math.cos(i*0.05); g.tick(1/60,false) }
      g.input.x = 0; g.input.z = 0
      const p = g.capy.position
      R[n] = { err: g.state.lastError, bodies: g.world.bodies.length,
               y: +p.y.toFixed(1), nan: !(p.x === p.x && p.y === p.y && p.z === p.z) }
    }
    return R
  })
  await page.evaluate(async (o)=>{ await fetch('/shot?name=xsmoke17.json',{method:'POST',body:btoa(JSON.stringify(o))}) }, out)
}
