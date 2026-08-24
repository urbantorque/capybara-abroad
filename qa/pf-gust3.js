// PAYOFF batch 1, job 2: THE LONG SQUALL.
//
// Three minutes of Manly's own weather on one sunglasses (0.10 kg), to answer
// the two questions the forty-second run cannot: does it actually get ACROSS a
// square, and does physGUST_ROAM stop it before it gets out of the chapter?
async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  const out = await page.evaluate(async () => {
    const g = window.__capy
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
    const px = sp.x + 3, pz = sp.z + 3
    p.homeX = px; p.homeZ = pz
    p.body.wakeUp()
    p.body.position.set(px, sp.y + 0.6, pz)
    p.body.previousPosition.copy(p.body.position)
    p.body.interpolatedPosition.copy(p.body.position)
    p.body.velocity.set(0, 0, 0); p.body.angularVelocity.set(0, 0, 0)
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const x0 = p.body.position.x, z0 = p.body.position.z
    const at = []
    let vMax = 0
    for (let i = 0; i < 60 * 180; i++) {
      g.tick(1 / 60, false)
      if (p.inWater) { at.push({ s: +(i / 60).toFixed(0), note: 'in the water' }); break }
      vMax = Math.max(vMax, Math.hypot(p.body.velocity.x, p.body.velocity.z))
      if (i % (60 * 20) === 0) {
        at.push({ s: Math.round(i / 60),
                  d: +Math.hypot(p.body.position.x - x0, p.body.position.z - z0).toFixed(2),
                  roam: +Math.hypot(p.body.position.x - p.homeX, p.body.position.z - p.homeZ).toFixed(2) })
      }
    }
    return { type: p.type, mass: +p.mass.toFixed(2), at,
             vMax: +vMax.toFixed(2),
             net: +Math.hypot(p.body.position.x - x0, p.body.position.z - z0).toFixed(2),
             roam: +Math.hypot(p.body.position.x - p.homeX, p.body.position.z - p.homeZ).toFixed(2) }
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=pfgust3.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
