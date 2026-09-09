async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2500)
  await page.evaluate(() => { window.__capy.biome.switchTo('rio') })
  await page.waitForTimeout(1500)
  const out = {}
  out.step1 = await page.evaluate(() => {
    const g = window.__capy
    const cb = g.capy.body
    const dyn = g.world.bodies.filter(b => b.mass > 0 && b !== cb)
    return dyn.map(b => [+b.position.x.toFixed(1), +b.position.y.toFixed(1), +b.position.z.toFixed(1), b.mass])
  })
  // throw whatever the ball is into the Atlantic
  out.moved = await page.evaluate(() => {
    const g = window.__capy
    const cb = g.capy.body
    const dyn = g.world.bodies.filter(b => b.mass > 0 && b !== cb)
    if (!dyn.length) return false
    const b = dyn[0]
    b.position.set(6, -1.5, -60)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    b.velocity.set(0,0,0); b.sleep()
    return true
  })
  await page.waitForTimeout(1500)
  out.inSea = await page.evaluate(() => {
    const g = window.__capy, cb = g.capy.body
    const dyn = g.world.bodies.filter(b => b.mass > 0 && b !== cb)
    return dyn.map(b => [+b.position.x.toFixed(1), +b.position.y.toFixed(1), +b.position.z.toFixed(1)])
  })
  // leave and come back
  await page.evaluate(() => { window.__capy.biome.switchTo('kyoto') })
  await page.waitForTimeout(1200)
  await page.evaluate(() => { window.__capy.biome.switchTo('rio') })
  await page.waitForTimeout(2500)
  out.after = await page.evaluate(() => {
    const g = window.__capy, cb = g.capy.body
    const dyn = g.world.bodies.filter(b => b.mass > 0 && b !== cb)
    return { ball: dyn.map(b => [+b.position.x.toFixed(1), +b.position.y.toFixed(1), +b.position.z.toFixed(1)]),
             err: g.state.lastError || null }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=p4fn3.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
