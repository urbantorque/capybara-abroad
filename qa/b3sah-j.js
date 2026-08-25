async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy
    const o = {}
    g.biome.switchTo('sahara')
    const b = g.capy.body, sa = g.sahara
    const L = g.locals.filter(r => r.biome === 'sahara')
    const park = (x, z) => { const y = sa.terrainHeight(x, z) + 1.0
      b.position.set(x, y, z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 60; i++) { g.input.x = 0; g.input.z = 0; g.input.run = false; g.tick(1 / 60, false) } }
    // stand between the juice cart (7,2) and the water seller (16,-4) and say nothing
    park(11.5, -1)
    const seen = {}
    let loafAt = -1, t = 0
    for (let i = 0; i < 60 * 55; i++) {
      g.input.x = 0; g.input.z = 0; g.input.run = false
      g.tick(1 / 60, false); t += 1 / 60
      for (const r of L) if (r.cd > 0 && !seen[r.x + ',' + r.z]) seen[r.x + ',' + r.z] = +t.toFixed(1)
      if (loafAt < 0 && g.capy.loaf > 0.5) loafAt = +t.toFixed(1)
    }
    o.linesHeardBy = seen
    o.loafAt = loafAt
    o.loaf = g.capy.loaf !== undefined ? +g.capy.loaf.toFixed(2) : 'no such field'
    o.camDistAtLoaf = +Math.hypot(g.camera.position.x - g.capy.position.x, g.camera.position.z - g.capy.position.z).toFixed(1)
    return o
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=b3sah-j.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
