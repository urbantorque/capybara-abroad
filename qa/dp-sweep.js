async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = { sweep: [], friction: null }
    g.biome.switchTo('manly')
    const s = g.biome.spawnOf('manly'), b = g.capy.body
    b.position.set(s.x, s.y, s.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false)

    const live = g.biome.current
    const picks = []
    for (const p of g.props) {
      if (p.removed || p.hidden || p.held || p.frozen || p.owner) continue
      if (p.biome && p.biome !== live) continue
      picks.push(p)
    }
    picks.sort((a, c) => a.mass - c.mass)
    const subjects = picks.slice(0, 4)

    // what IS the contact friction on a prop?
    const cm = g.mats && g.mats.prop
    if (cm && g.world.contactmaterials) {
      const cs = g.world.contactmaterials.map(c => ({
        f: c.friction, r: c.restitution,
        a: c.materials && c.materials[0] && c.materials[0].name,
        b2: c.materials && c.materials[1] && c.materials[1].name,
      }))
      R.friction = cs
    }

    const real = g.weather.gust
    for (const p of subjects) {
      const row = { type: p.type, mass: +p.mass.toFixed(3), aeroK: +(p.aeroK || 0).toFixed(5), moves: {} }
      const c = g.capy.position
      for (const W of [2, 4, 6, 8, 10, 14]) {
        g.weather.gust = () => ({ x: W, z: 0 })
        p.body.wakeUp()
        p.body.position.set(c.x + 1.0, c.y, c.z)
        p.body.velocity.set(0, 0, 0); p.body.angularVelocity.set(0, 0, 0)
        for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
        const a = p.body.position.clone()
        for (let i = 0; i < 300; i++) g.tick(1 / 60, false)
        row.moves['w' + W] = +a.distanceTo(p.body.position).toFixed(3)
      }
      R.sweep.push(row)
    }
    g.weather.gust = real
    return R
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=dpsweep.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
