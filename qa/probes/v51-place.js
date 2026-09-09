async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  const ALSO = {
    quay: [-20, 17], kyoto: [16, 178], cali: [-20, -19], rio: [-34, -4], iceland: [24, 132],
    sahara: [-6, -50], venice: [-14, -17], kowloon: [9, 3], palawan: [6, 21], goreme: [6, 4],
    manly: [39, 36], pantanal: [43, 13], cave: [12, 33], antarctic: [16, 83], monaco: [8, -73],
    hanoi: [-8, -7],
  }
  const out = []
  for (const name of Object.keys(ALSO)) {
    out.push(await page.evaluate(async arg => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
      const g = window.__capy
      const name = arg.name
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), cb = g.capy.body
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0)
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
      await sleep(3000)
      const api = g[name] || g.env
      const near = (g.props || []).filter(p => p && p.body && !p.removed && p.biome === name &&
        Math.hypot(p.body.position.x - arg.c[0], p.body.position.z - arg.c[1]) < 20)
      const rows = near.map(p => {
        const x = p.body.position.x, y = p.body.position.y, z = p.body.position.z
        let th = NaN
        try { th = api && api.terrainHeight ? api.terrainHeight(x, z) : NaN } catch (e) { th = NaN }
        let blocked = false
        try { blocked = !!(api && api.navBlocked && api.navBlocked(x, z, 0.9)) } catch (e) {}
        let water = false
        try { water = !!(api && api.isOverWater && api.isOverWater(x, z)) } catch (e) {}
        return { t: p.type, y: Math.round(y * 10) / 10, th: Math.round(th * 10) / 10,
                 dy: Math.round((y - th) * 10) / 10, blocked, water,
                 own: !!p.owner, home: Math.round(Math.hypot(x - arg.c[0], z - arg.c[1])) }
      })
      // the nearest local's own y, as the honest "what height do people stand at here"
      let ly = NaN, ld = Infinity
      for (const q of (g.locals || [])) {
        if (!q || q.biome !== name) continue
        const d = Math.hypot(q.x - arg.c[0], q.z - arg.c[1])
        if (d < ld) { ld = d; ly = q.y }
      }
      return { name, n: rows.length, localY: Math.round(ly * 10) / 10, localD: Math.round(ld),
               spawnY: Math.round(sp.y * 10) / 10, rows }
    }, { name, c: ALSO[name] }))
  }
  await page.evaluate(o => fetch('/shot?name=v51place.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
