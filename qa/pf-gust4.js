// How far does ONE impulse actually carry a light prop on this ground?
// If a 2 m/s shove travels 3 mm then the puff is not the problem, the contact
// is, and physGUST_KICK_V is being tuned against the wrong number.
async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const R = { rows: [], friction: [] }
    g.biome.switchTo('manly')
    const sp = g.biome.spawnOf('manly'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const live = g.biome.current
    const cand = g.props.filter(p => !p.removed && !p.hidden && !p.held && !p.keep &&
      !p.planted && !p.frozen && (!p.biome || p.biome === live) && p.mass > 0 && p.mass <= 0.6)
    cand.sort((a, c) => a.mass - c.mass)
    const p = cand[0]
    R.type = p.type; R.mass = +p.mass.toFixed(2)
    R.aeroK = +(p.aeroK || 0).toFixed(4)
    R.dampL = p.dampL; R.dampA = p.dampA
    for (const cm of (g.world.contactmaterials || [])) {
      R.friction.push({ f: cm.friction, r: cm.restitution,
        a: cm.materials && cm.materials[0] && cm.materials[0].name,
        b: cm.materials && cm.materials[1] && cm.materials[1].name })
    }
    const px = sp.x + 3, pz = sp.z + 3
    for (const V of [0.6, 1.2, 2.0, 3.5, 6.0]) {
      for (const UP of [0, 0.55, 1.4]) {
        p.body.wakeUp()
        p.body.position.set(px, sp.y + 0.6, pz)
        p.body.previousPosition.copy(p.body.position)
        p.body.interpolatedPosition.copy(p.body.position)
        p.body.velocity.set(0, 0, 0); p.body.angularVelocity.set(0, 0, 0)
        p.body.quaternion.set(0, 0, 0, 1)
        for (let i = 0; i < 150; i++) g.tick(1 / 60, false)   // settle
        const x0 = p.body.position.x, z0 = p.body.position.z
        p.body.wakeUp()
        p.body.velocity.set(V, UP, 0)
        for (let i = 0; i < 180; i++) g.tick(1 / 60, false)
        R.rows.push({ v: V, up: UP,
          d: +Math.hypot(p.body.position.x - x0, p.body.position.z - z0).toFixed(3) })
      }
    }
    return R
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=pfgust4.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
