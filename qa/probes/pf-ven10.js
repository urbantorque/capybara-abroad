async page => {
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('venice')
    const V = g.venice, b = g.capy.body
    const sp = g.biome.spawnOf('venice')
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    const r = { trace: [], knot0: null }
    const P = V.boardPath(); r.knot0 = [P[0], P[1]]
    r.dToKnot0 = +Math.hypot(sp.x - P[0], sp.z - P[1]).toFixed(2)
    for (let i = 0; i < 110 * 60; i++) {
      g.tick(1 / 60, false)
      const t = i / 60
      if (t > 40 && i % 30 === 0) {
        const p = g.capy.position, v = g.capy.velocity
        r.trace.push([+t.toFixed(1), +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2),
          +Math.hypot(v.x, v.z).toFixed(2), +(g.capy.loaf || 0).toFixed(2),
          +V.boardsOut().toFixed(3), V.onBoards() ? 1 : 0])
      }
      if (i / 60 > 75) break
    }
    return r
  })
  await page.evaluate(async (d) => {
    const bb = btoa(unescape(encodeURIComponent(JSON.stringify(d))))
    await fetch('/shot?name=venH.json', { method: 'POST', body: bb })
  }, out)
}
