async page => {
  await page.evaluate(() => {
    const g = window.__capy, api = g.palawan
    const b = g.capy.body
    b.position.set(api.reef.x, 0.3, api.reef.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    g.input.x = 0; g.input.z = 0; g.input.action = false
    let n = 0
    while (api.bloom() < 0.88 && n < 60 * 400) {
      b.position.x = api.reef.x; b.position.z = api.reef.z
      g.input.action = false; g.tick(1 / 60, false); n++
    }
    window.__b8 = { n, bloom: api.bloom(), stam: g.capy.stamina }
  })
  await page.keyboard.down('z')
  await page.waitForTimeout(2400)
  await page.keyboard.up('z')
  await page.keyboard.down('e')
  await page.waitForTimeout(1800)
  const out = await page.evaluate(() => {
    const g = window.__capy, api = g.palawan, c = g.camera, p = g.capy.position
    const dx = c.position.x - p.x, dz = c.position.z - p.z, dy = c.position.y - p.y
    return { warm: window.__b8, bloom: +api.bloom().toFixed(3), depth: +(g.capy.depth || 0).toFixed(2),
             sub: +api.submerged().toFixed(3), capY: +p.y.toFixed(2), camY: +c.position.y.toFixed(2),
             yaw: +Math.atan2(dx, dz).toFixed(3), dist: +Math.hypot(dx, dy, dz).toFixed(2),
             pitch: +Math.atan2(dy, Math.hypot(dx, dz)).toFixed(3) }
  })
  await page.evaluate(async d => {
    await fetch('/shot?name=b4pal-8.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(d)))) })
  }, out)
  await page.waitForTimeout(300)
}
