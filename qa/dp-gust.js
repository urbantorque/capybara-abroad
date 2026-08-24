async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = {}
    const go = n => {
      g.biome.switchTo(n)
      const s = g.biome.spawnOf(n), b = g.capy.body
      b.position.set(s.x, s.y, s.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
    }

    go('manly')
    const live = g.biome.current
    // catalogue the free props and their masses
    const free = []
    for (const p of g.props) {
      if (p.removed || p.hidden || p.held || p.frozen || p.owner) continue
      if (p.biome && p.biome !== live) continue
      free.push({ type: p.type, mass: p.mass })
    }
    R.freeProps = free.sort((a, b) => a.mass - b.mass).slice(0, 8)

    // sample the gust over 20 s of ticks — what does the solver actually see?
    const samp = []
    for (let i = 0; i < 1200; i++) {
      g.tick(1 / 60, false)
      if (i % 100 === 0) {
        const gu = g.weather.gust()
        samp.push(+Math.sqrt(gu.x * gu.x + gu.z * gu.z).toFixed(2))
      }
    }
    R.gustOver20s = samp
    R.gustMax = Math.max(...samp)

    // now take the lightest prop, keep it AWAKE, and watch it for 20 s
    let L = null
    for (const p of g.props) {
      if (p.removed || p.hidden || p.held || p.frozen || p.owner) continue
      if (p.biome && p.biome !== live) continue
      if (!L || p.mass < L.mass) L = p
    }
    if (L) {
      const c = g.capy.position
      L.body.wakeUp()
      L.body.position.set(c.x + 1.0, c.y, c.z)
      L.body.velocity.set(0, 0, 0); L.body.angularVelocity.set(0, 0, 0)
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
      const start = L.body.position.clone()
      R.sleepingAfterSettle = L.body.sleepState
      let maxV = 0
      for (let i = 0; i < 1200; i++) {
        g.tick(1 / 60, false)
        const v = L.body.velocity
        const sp = Math.sqrt(v.x * v.x + v.z * v.z)
        if (sp > maxV) maxV = sp
      }
      R.drift20s = +start.distanceTo(L.body.position).toFixed(3)
      R.maxHorizSpeed = +maxV.toFixed(4)
      R.sleepStateEnd = L.body.sleepState
      R.mass = L.mass
      R.type = L.type
      R.allowSleep = L.body.allowSleep
    }
    return R
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=dpgust.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
