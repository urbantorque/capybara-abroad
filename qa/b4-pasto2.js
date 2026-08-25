async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(1800)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = {}
    g.biome.switchTo('pasto')
    const b = g.capy.body
    b.position.set(9, 1.4, 35); b.velocity.set(0, 0, 0)
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
    R.apiKeys = Object.keys((g.biome.api && g.biome.api()) || {})
    // every body within 14 m of the animal, and whether it moves
    const near = []
    for (const bd of g.world.bodies) {
      const d = Math.hypot(bd.position.x - 9, bd.position.z - 35)
      if (d > 16) continue
      near.push({ d: +d.toFixed(1), type: bd.type, mass: bd.mass,
                  y: +bd.position.y.toFixed(2),
                  v: +Math.hypot(bd.velocity.x, bd.velocity.z).toFixed(2),
                  tag: (bd.userData && (bd.userData.tag || bd.userData.kind)) || null,
                  shapes: bd.shapes.map(s => s.type).join(',') })
    }
    near.sort((a, c) => a.d - c.d)
    R.near = near.slice(0, 12)
    // ride the carrier: what is the animal standing on and does it move
    R.frameBefore = g.capy.frame ? JSON.parse(JSON.stringify(g.capy.frame)) : null
    const trail = []
    for (let s = 0; s < 12; s++) {
      for (let i = 0; i < 30; i++) g.tick(1 / 60, false)
      trail.push([+(s * 0.5 + 0.5).toFixed(1), +b.position.x.toFixed(2), +b.position.y.toFixed(2),
                  +b.position.z.toFixed(2), +Math.hypot(b.velocity.x, b.velocity.z).toFixed(2),
                  g.capy.grounded])
    }
    R.trail = trail
    R.err = g.state.lastError || null
    return R
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=b4-pasto2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
