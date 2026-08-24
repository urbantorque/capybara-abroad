async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = { pools: {}, gust: {}, wheek: {}, errs: {} }

    R.api = {
      jumpBuf: typeof g.input.jumpBuf,
      actionBuf: typeof g.input.actionBuf,
      clearJumpBuf: typeof g.input.clearJumpBuf,
      clearActionBuf: typeof g.input.clearActionBuf,
      jumpPressedKept: 'jumpPressed' in g.input,
    }

    const names = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                   'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic']

    const findPools = () => {
      const r = {}
      for (const o of g.scene.children) {
        if (!o.isInstancedMesh) continue
        if (o.count === 30) r.dust = o.visible
        else if (o.count === 8) r.foam = o.visible
        else if (o.count === 24) r.puff = o.visible
      }
      return r
    }

    for (const n of names) {
      g.state.lastError = null
      g.biome.switchTo(n)
      const s = g.biome.spawnOf(n), b = g.capy.body
      b.position.set(s.x, s.y, s.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 120; i++) g.tick(1/60, false)

      R.pools[n] = findPools()

      // gust reaching the solver: sample the weather's own gust speed
      const gu = g.weather.gust()
      R.gust[n] = +Math.sqrt(gu.x*gu.x + gu.z*gu.z).toFixed(2)

      // wheek: park the lightest free prop beside the animal, wheek, measure
      const live = g.biome.current
      let light = null
      for (const p of g.props) {
        if (p.removed || p.hidden || p.held || p.frozen || p.owner) continue
        if (p.biome && p.biome !== live) continue
        if (!light || p.mass < light.mass) light = p
      }
      if (light) {
        const c = g.capy.position
        light.body.wakeUp()
        light.body.position.set(c.x + 1.0, c.y + 0.25, c.z)
        light.body.velocity.set(0,0,0); light.body.angularVelocity.set(0,0,0)
        for (let i = 0; i < 20; i++) g.tick(1/60, false)
        const bx = light.body.position.x, by = light.body.position.y, bz = light.body.position.z
        g.events.emit('capy:wheek', { position: g.capy.position, soft: false })
        for (let i = 0; i < 45; i++) g.tick(1/60, false)
        const dx = light.body.position.x - bx, dy = light.body.position.y - by, dz = light.body.position.z - bz
        R.wheek[n] = { m: +light.mass.toFixed(3), d: +Math.sqrt(dx*dx+dy*dy+dz*dz).toFixed(3) }
      } else {
        R.wheek[n] = null
      }
      R.errs[n] = g.state.lastError ? String(g.state.lastError) : null
    }
    return R
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=dpw12a.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
