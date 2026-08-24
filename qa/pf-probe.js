async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    const R = {}
    // ---- palawan: where can you actually swim? --------------------------
    g.biome.switchTo('palawan')
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
    const sp = g.biome.spawnOf('palawan')
    R.spawn = [+sp.x.toFixed(1), +sp.y.toFixed(1), +sp.z.toFixed(1)]
    R.probes = []
    for (const d of [10, 25, 40, 60, 80]) {
      for (const s of [1, -1]) {
        const b = g.capy.body
        b.position.set(sp.x, sp.y + 2, sp.z + d * s)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
        b.velocity.set(0, 0, 0)
        for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
        const sw = !!g.capy.swimming
        let dep = 0
        if (sw) {
          for (let i = 0; i < 150; i++) { g.input.action = true; g.tick(1 / 60, false) }
          g.input.action = false
          dep = +(g.capy.depth || 0).toFixed(2)
        }
        R.probes.push({ dz: d * s, swim: sw, depth: dep, y: +g.capy.position.y.toFixed(2) })
      }
    }
    // ---- pasto: the condor, properly -------------------------------------
    g.biome.switchTo('pasto')
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
    g.condor.summon()
    for (let i = 0; i < 1200 && g.condor.state !== 'circling'; i++) g.tick(1 / 60, false)
    R.afterFirst = g.condor.state
    g.condor.summon()                              // ...and again, to bring it low
    for (let i = 0; i < 2400 && !g.condor.talonInReach(); i++) g.tick(1 / 60, false)
    R.inReach = g.condor.talonInReach()
    // the grab is a rising edge, not a hold: pulse it
    for (let i = 0; i < 900 && !g.capy.carriedBy; i++) {
      const p = (i % 6 === 0) && g.condor.talonInReach()
      g.input.action = p; g.input.actionPressed = p
      g.tick(1 / 60, false)
    }
    g.input.action = false
    R.carried = !!g.capy.carriedBy
    R.mounted = !!g.condor.mounted
    R.condorState = g.condor.state
    R.y = +g.capy.position.y.toFixed(1)
    await sleep(50)
    return R
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=pfprobe.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
