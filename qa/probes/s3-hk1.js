async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('kowloon')
    const b = g.capy.body
    b.position.set(0,1.4,-52); b.velocity.set(0,0,0)
    const rows = []
    for (let s = 0; s < 22; s++) {
      for (let i = 0; i < 300; i++) { g.tick(1/60,false); b.position.set(0,1.4,-52); b.velocity.set(0,0,0) }
      rows.push([(s+1)*5, +g.kowloon.show().toFixed(2), g.kowloon.litTowers()])
    }
    return { rows, err: g.state.lastError?String(g.state.lastError):'none', bodies: g.world.bodies.length }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=hk1.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
