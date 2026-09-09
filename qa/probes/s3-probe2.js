async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('kowloon')
    const b = g.capy.body
    b.position.set(0, 1.4, -52); b.velocity.set(0,0,0)
    const rows = []
    for (let s = 0; s < 24; s++) {
      for (let i = 0; i < 300; i++) { g.tick(1/60, false); b.position.set(0,1.4,-52); b.velocity.set(0,0,0) }
      rows.push([(s+1)*5, +g.kowloon.show().toFixed(3), g.kowloon.litTowers(), g.kowloon.showing()])
    }
    return { rows, t: g.state.time }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=s3probe2.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
