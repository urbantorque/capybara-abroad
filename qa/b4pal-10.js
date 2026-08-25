async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const o = { rows: [] }
    function park(name, x, z) {
      g.biome.switchTo(name)
      const api = g[name]
      const b = g.capy.body
      b.position.set(x, api.terrainHeight(x, z) + 0.6, z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.input.x = 0; g.input.z = 0; g.input.action = false
      for (let i = 0; i < 300; i++) g.tick(1 / 60, false)
      const a = { x: g.capy.position.x, z: g.capy.position.z }
      for (let i = 0; i < 60 * 60; i++) g.tick(1 / 60, false)
      const c = g.capy.position
      o.rows.push({ name, at: [x, z], moved: +Math.hypot(c.x - a.x, c.z - a.z).toFixed(2),
                    slope: +api.slopeAt(c.x, c.z).toFixed(3), loaf: +(g.capy.loaf || 0).toFixed(2) })
    }
    try {
      park('palawan', 0, 46)
      park('manly', 0, 10)
      park('rio', 0, 0)
    } catch (e) { o.err = String(e).slice(0, 200) }
    return o
  })
  await page.evaluate(async d => {
    await fetch('/shot?name=b4pal-10.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(d)))) })
  }, out)
}
