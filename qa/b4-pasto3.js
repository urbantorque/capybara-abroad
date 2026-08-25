async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(1800)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = { events: [] }
    g.biome.switchTo('pasto')
    const b = g.capy.body
    b.position.set(9, 1.4, 35); b.velocity.set(0, 0, 0)
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
    let lastX = b.position.x, lastZ = b.position.z
    for (let s = 0; s < 60 * 60; s++) {
      g.tick(1 / 60, false)
      const dx = b.position.x - lastX, dz = b.position.z - lastZ
      if (Math.hypot(dx, dz) > 0.04) {
        // who is touching us right now?
        let closest = null, cd = 99
        for (const bd of g.world.bodies) {
          if (bd === b) continue
          const d = Math.hypot(bd.position.x - b.position.x, bd.position.z - b.position.z)
          if (d < cd) { cd = d; closest = bd }
        }
        if (R.events.length < 14) R.events.push({
          t: +(s / 60).toFixed(2), step: +Math.hypot(dx, dz).toFixed(3),
          x: +b.position.x.toFixed(2), z: +b.position.z.toFixed(2),
          vel: +Math.hypot(b.velocity.x, b.velocity.z).toFixed(3),
          nearest: { d: +cd.toFixed(2), type: closest.type, mass: closest.mass,
                     v: +Math.hypot(closest.velocity.x, closest.velocity.z).toFixed(2) },
          frame: g.capy.frame ? +Math.hypot(g.capy.frame.vx || 0, g.capy.frame.vz || 0).toFixed(2) : null
        })
      }
      lastX = b.position.x; lastZ = b.position.z
    }
    R.end = [+b.position.x.toFixed(2), +b.position.z.toFixed(2)]
    R.moved = +Math.hypot(b.position.x - 9, b.position.z - 35).toFixed(2)
    R.err = g.state.lastError || null
    return R
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=b4-pasto3.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
