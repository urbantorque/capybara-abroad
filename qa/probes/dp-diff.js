async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = { wheek: {}, gust: {} }

    const settle = (p, c) => {
      p.body.wakeUp()
      p.body.position.set(c.x + 1.0, c.y, c.z)
      p.body.velocity.set(0, 0, 0); p.body.angularVelocity.set(0, 0, 0)
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false)   // let it land and sleep
    }
    const lightest = () => {
      const live = g.biome.current
      let L = null
      for (const p of g.props) {
        if (p.removed || p.hidden || p.held || p.frozen || p.owner) continue
        if (p.biome && p.biome !== live) continue
        if (!L || p.mass < L.mass) L = p
      }
      return L
    }
    const go = n => {
      g.biome.switchTo(n)
      const s = g.biome.spawnOf(n), b = g.capy.body
      b.position.set(s.x, s.y, s.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
    }

    // ---------- WHEEK differential: settled prop, 60 ticks, with vs without ----------
    for (const n of ['sydney', 'kyoto', 'venice', 'goreme']) {
      go(n)
      const p = lightest(); if (!p) { R.wheek[n] = null; continue }
      const c = g.capy.position

      settle(p, c)
      let a = p.body.position.clone()
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
      const control = a.distanceTo(p.body.position)

      settle(p, c)
      a = p.body.position.clone()
      g.events.emit('capy:wheek', { position: g.capy.position, soft: false })
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
      const loud = a.distanceTo(p.body.position)

      settle(p, c)
      a = p.body.position.clone()
      g.events.emit('capy:wheek', { position: g.capy.position, soft: true })
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
      const soft = a.distanceTo(p.body.position)

      R.wheek[n] = { mass: +p.mass.toFixed(3), control: +control.toFixed(4),
                     loud: +loud.toFixed(4), soft: +soft.toFixed(4) }
    }

    // ---------- GUST differential: 10 s of drift, real weather vs forced calm ----------
    for (const n of ['manly', 'sahara', 'kyoto']) {
      go(n)
      const p = lightest(); if (!p) { R.gust[n] = null; continue }
      const c = g.capy.position

      settle(p, c)
      let a = p.body.position.clone()
      for (let i = 0; i < 600; i++) g.tick(1 / 60, false)
      const live = a.distanceTo(p.body.position)

      // force the sky calm and repeat
      const realGust = g.weather.gust
      g.weather.gust = () => ({ x: 0, z: 0 })
      settle(p, c)
      a = p.body.position.clone()
      for (let i = 0; i < 600; i++) g.tick(1 / 60, false)
      const calm = a.distanceTo(p.body.position)
      g.weather.gust = realGust

      R.gust[n] = { mass: +p.mass.toFixed(3), windy: +live.toFixed(3), calm: +calm.toFixed(3) }
    }
    R.err = g.state.lastError ? String(g.state.lastError) : null
    return R
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=dpdiff.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
