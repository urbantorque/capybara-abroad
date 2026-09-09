async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy, api = g.palawan
    const o = {}
    // wind the bay past the bloom, back to dark, with the animal parked
    const b = g.capy.body
    let n = 0
    while ((api.bloom() > 0.02 || n < 60) && n < 60 * 300) {
      b.position.set(api.reef.x, b.position.y, api.reef.z)
      g.input.action = true; g.tick(1 / 60, false); n++
    }
    o.ticks = n
    o.bloom = +api.bloom().toFixed(3)
    o.depth = +(g.capy.depth || 0).toFixed(2)
    return o
  })
  await page.waitForTimeout(50)
  await page.evaluate(async d => {
    await fetch('/shot?name=b4pal-3.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(d)))) })
  }, out)
  await page.waitForTimeout(1200)
}
