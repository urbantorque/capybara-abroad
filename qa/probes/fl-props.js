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
    await page.waitForTimeout(7000)
    out[n] = await page.evaluate(() => {
      const g = window.__capy
      const api = g[g.biome.current]
      const rows = []
      for (const p of (g.props||[])) {
        if (!p.body) continue
        const q = p.body.position
        const t = api && api.terrainHeight ? api.terrainHeight(q.x, q.z) : 0
        const w = api && api.waterHeightAt ? api.waterHeightAt(q.x, q.z) : (api ? api.waterLevel : 0)
        rows.push({ k: p.kind || p.type || '?', x: +q.x.toFixed(1), y: +q.y.toFixed(2), z: +q.z.toFixed(1),
                    t: +t.toFixed(2), w: +w.toFixed(2), sleep: p.body.sleepState })
      }
      rows.sort((a,b) => (a.y - a.t) - (b.y - b.t))
      return { n: rows.length, worst: rows.slice(0, 8) }
    })
  }
  await page.evaluate(async (o)=>{ await fetch('/shot?name=flprops.json',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
