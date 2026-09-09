async page => {
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const r = {}
    for (const n of ['sydney', 'kyoto', 'venice', 'sahara', 'quay']) {
      g.biome.switchTo(n)
      const sp = g.biome.spawnOf(n), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
      const p0 = { x: g.capy.position.x, y: g.capy.position.y, z: g.capy.position.z }
      for (let i = 0; i < 60 * 60; i++) g.tick(1 / 60, false)
      const p1 = g.capy.position
      r[n] = { dx: +(p1.x - p0.x).toFixed(3), dy: +(p1.y - p0.y).toFixed(3),
        dz: +(p1.z - p0.z).toFixed(3),
        drift: +Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(3),
        velZ: +b.velocity.z.toFixed(4) }
    }
    return r
  })
  await page.evaluate(async (d) => {
    const bb = btoa(unescape(encodeURIComponent(JSON.stringify(d))))
    await fetch('/shot?name=venJ.json', { method: 'POST', body: bb })
  }, out)
}
