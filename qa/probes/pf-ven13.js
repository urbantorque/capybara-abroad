async page => {
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('venice')
    const sp = g.biome.spawnOf('venice'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const w = g.world || (g.physics && g.physics.world)
    const r = { nBodies: w ? w.bodies.length : -1, hits: [] }
    const P = g.capy.position
    if (w) for (const bd of w.bodies) {
      if (bd === b) continue
      if (bd.mass !== 0) continue
      for (const s of bd.shapes) {
        if (!s.halfExtents) continue
        const c = bd.position
        const he = s.halfExtents
        const rad = Math.hypot(he.x, he.y, he.z)
        const d = Math.hypot(c.x - P.x, c.y - P.y, c.z - P.z)
        if (d < rad + 1.2) r.hits.push({ c: [+c.x.toFixed(1), +c.y.toFixed(1), +c.z.toFixed(1)],
          he: [+he.x.toFixed(1), +he.y.toFixed(1), +he.z.toFixed(1)], d: +d.toFixed(2) })
      }
    }
    // contacts on the capy this frame
    r.contacts = []
    if (w && w.contacts) for (const c of w.contacts) {
      if (c.bi === b || c.bj === b) {
        const o = c.bi === b ? c.bj : c.bi
        r.contacts.push({ mass: o.mass, p: [+o.position.x.toFixed(1), +o.position.y.toFixed(1), +o.position.z.toFixed(1)] })
      }
    }
    return r
  })
  await page.evaluate(async (d) => {
    const bb = btoa(unescape(encodeURIComponent(JSON.stringify(d))))
    await fetch('/shot?name=venK.json', { method: 'POST', body: bb })
  }, out)
}
