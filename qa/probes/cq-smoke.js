async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.keyboard.press('Enter'); await page.waitForTimeout(1200)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2000)
  const out = {}
  for (const n of ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                   'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic']) {
    out[n] = await page.evaluate((name) => {
      const g = window.__capy
      g.state.lastError = null
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<180;i++) g.tick(1/60,false)
      g.tick(1/60,true)
      return { y: +g.capy.position.y.toFixed(2), err: g.state.lastError || null,
               bodies: g.world.bodies.length }
    }, n)
  }
  // and the map, which now carries a new mark
  out.map = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('quay')
    for (let i=0;i<30;i++) g.tick(1/60,false)
    return { err: g.state.lastError || null }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=cq-smoke.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
