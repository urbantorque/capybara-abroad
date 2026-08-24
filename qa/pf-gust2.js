// PAYOFF batch 1, job 2: THE GUST, CONTROLLED.
//
// qa/pf-gust.js measures every light prop in a chapter and is too noisy to
// prove anything: a prop that drifts into the surf is carried by physFlowAt
// (Manly's dry props moved 1.8 m and its whole population "moved" 29 m), and
// prop spawn positions are randomised per load. This picks ONE prop, puts it
// on the ground beside the spawn where there is no water and nothing to hit,
// and measures it — so the number is the wind and only the wind.
async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  const out = {}
  const names = ['manly', 'sahara', 'iceland', 'antarctic',
                 'kyoto', 'venice', 'palawan', 'goreme']
  for (const n of names) {
    out[n] = await page.evaluate(async (name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
      const live = g.biome.current
      const cand = g.props.filter(p => !p.removed && !p.hidden && !p.held && !p.keep &&
        !p.planted && !p.frozen && (!p.biome || p.biome === live) && p.mass > 0 && p.mass <= 0.6)
      if (!cand.length) return { note: 'no light prop' }
      cand.sort((a, c) => a.mass - c.mass)
      const p = cand[0]
      // beside the spawn, clear of the animal, on whatever the ground is
      const px = sp.x + 3, pz = sp.z + 3
      p.homeX = px; p.homeZ = pz
      p.body.wakeUp()
      p.body.position.set(px, sp.y + 0.6, pz)
      p.body.previousPosition.copy(p.body.position)
      p.body.interpolatedPosition.copy(p.body.position)
      p.body.velocity.set(0, 0, 0); p.body.angularVelocity.set(0, 0, 0)
      for (let i = 0; i < 120; i++) g.tick(1 / 60, false)     // let it settle
      const x0 = p.body.position.x, z0 = p.body.position.z
      let effMax = 0, effSum = 0, k = 0, awake = 0, path = 0
      let lx = x0, lz = z0
      for (let i = 0; i < 60 * 40; i++) {
        g.tick(1 / 60, false)
        if (p.inWater) return { note: 'it went in the water', type: p.type }
        const nx = p.body.position.x, nz = p.body.position.z
        path += Math.hypot(nx - lx, nz - lz); lx = nx; lz = nz
        if (p.body.sleepState !== 2) awake++
        if (i % 6 === 0) {
          const wg = g.weather && g.weather.gust ? g.weather.gust() : { x: 0, z: 0 }
          const raw = Math.hypot(wg.x || 0, wg.z || 0)
          const s = raw > 2.8 ? (raw - 2.8) * 1.2 : 0
          effMax = Math.max(effMax, s); effSum += s; k++
        }
      }
      return { type: p.type, mass: +p.mass.toFixed(2),
               net: +Math.hypot(p.body.position.x - x0, p.body.position.z - z0).toFixed(2),
               path: +path.toFixed(2),
               awakeFrac: +(awake / (60 * 40)).toFixed(2),
               effMax: +effMax.toFixed(2), effMean: +(effSum / Math.max(1, k)).toFixed(2) }
    }, n)
  }
  await page.evaluate(async o => {
    await fetch('/shot?name=pfgust2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
