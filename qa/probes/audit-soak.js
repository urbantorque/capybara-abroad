async page => {
  await page.reload()
  await page.waitForTimeout(4500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const names = ['sydney','quay','pasto','kyoto','cali','rio','iceland','sahara','drift','venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic']
  const out = {}
  for (const n of names) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      if (g.state) g.state.lastError = null
    }, n)
    await page.waitForTimeout(400)
    out[n] = await page.evaluate((name) => {
      const g = window.__capy
      const keys = ['KeyW','KeyA','KeyS','KeyD','Space','KeyE','KeyQ']
      let nan = 0
      for (let i = 0; i < 1500; i++) {
        if (i % 40 === 0) {
          const k = keys[(i / 40 | 0) % keys.length]
          window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }))
          setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true })), 0)
        }
        g.tick(1/60, false)
        const p = g.capy.body.position
        if (!(p.x === p.x && p.y === p.y && p.z === p.z)) { nan++; break }
      }
      const inWorld = new Set(g.world.bodies.map(b => b.id))
      let lost = 0, under = 0
      const api = name === 'sydney' ? g.env : g[name]
      for (const pr of g.props) {
        if (pr.biome !== name || !inWorld.has(pr.body.id)) continue
        const b = pr.body.position
        if (!(b.x === b.x && b.y === b.y && b.z === b.z)) { lost++; continue }
        let t = api && api.terrainHeight ? api.terrainHeight(b.x, b.z) : 0
        if (!(t === t)) t = 0
        if (b.y - pr.originY < t - 2.5 && !pr.inWater && !pr.hidden) under++
      }
      return { nan, lost, under, err: g.state && g.state.lastError ? String(g.state.lastError).slice(0, 160) : null,
               bodies: g.world.bodies.length }
    }, n)
  }
  await page.evaluate((o) => fetch('/shot?name=soak2.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
