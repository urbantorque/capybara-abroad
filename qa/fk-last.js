async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2000)
  const out = {}
  for (const n of ['manly','pantanal']) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, n)
    await page.waitForTimeout(6000)
    out[n] = await page.evaluate(() => {
      const g = window.__capy
      // kinematic bodies with silly velocities or outside the world
      const bad = []
      for (const b of g.world.bodies) {
        if (b.type !== 4) continue
        const v = Math.hypot(b.velocity.x, b.velocity.y, b.velocity.z)
        if (v > 40 || Math.abs(b.position.x) > 300 || Math.abs(b.position.z) > 300 ||
            !(b.position.x === b.position.x)) {
          bad.push([+b.position.x.toFixed(1), +b.position.y.toFixed(1), +b.position.z.toFixed(1), +v.toFixed(1)])
        }
      }
      // props under the terrain or asleep in the air
      const api = g[g.biome.current]
      let sunk = 0
      for (const p of (g.props||[])) {
        if (!p.body) continue
        const t = api && api.terrainHeight ? api.terrainHeight(p.body.position.x, p.body.position.z) : 0
        if (p.body.position.y < t - 1.2) sunk++
      }
      const map = g.hud && g.hud.mapMarkAudit ? g.hud.mapMarkAudit() : null
      return { kineBad: bad, sunkProps: sunk, map: map && map.missing,
               mapOk: map && map.ok.length, err: g.state.lastError||null }
    })
  }
  await page.evaluate(async (o)=>{ await fetch('/shot?name=fklast.json',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
