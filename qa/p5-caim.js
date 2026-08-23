async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    g.biome.switchTo('pantanal')
    await sleep(1500)
    const b = g.capy.body
    // 1. resting offset on flat ground
    b.position.set(30, 6, 40); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    await sleep(2500)
    const t = g.pantanal.terrainHeight(b.position.x, b.position.z)
    const rest = +(b.position.y - t).toFixed(3)
    // 2. drop onto the first sandbar caiman
    const c = g.pantanal.caiman()
    const res = []
    for (let k = 0; k < 3; k++) {
      b.position.set(c.x, c.y + 2.2, c.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      await sleep(2200)
      res.push([+b.position.y.toFixed(3), +(b.position.y - c.y).toFixed(3),
                +Math.hypot(b.position.x - c.x, b.position.z - c.z).toFixed(2)])
    }
    return { rest, caimanY: +c.y.toFixed(3), drops: res, capyR: g.capy.body.shapes[0].radius || null }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=p5caim.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
