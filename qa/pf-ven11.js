async page => {
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('venice')
    const V = g.venice, b = g.capy.body
    const sp = g.biome.spawnOf('venice')
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    const r = { terr: [], trace: [] }
    for (let z = 8; z <= 24; z += 1) r.terr.push([z, +V.terrainHeight(-4, z).toFixed(2),
      +V.slopeAt(-4, z).toFixed(3)])
    for (let i = 0; i < 80 * 60; i++) {
      g.tick(1 / 60, false)
      const t = i / 60
      if (i % 300 === 0) {
        const p = g.capy.position
        const tr = V.traghetto ? V.traghetto() : null
        const gd = V.gondola ? V.gondola() : null
        r.trace.push([+t.toFixed(0), +p.z.toFixed(2), +p.y.toFixed(2),
          +b.velocity.z.toFixed(3), +b.velocity.y.toFixed(3),
          V.onTraghetto && V.onTraghetto() ? 1 : 0,
          tr ? +Math.hypot(tr.x - p.x, tr.z - p.z).toFixed(1) : -1,
          gd ? +Math.hypot(gd.x - p.x, gd.z - p.z).toFixed(1) : -1,
          +V.terrainHeight(p.x, p.z).toFixed(2)])
      }
    }
    return r
  })
  await page.evaluate(async (d) => {
    const bb = btoa(unescape(encodeURIComponent(JSON.stringify(d))))
    await fetch('/shot?name=venI.json', { method: 'POST', body: bb })
  }, out)
}
