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
    }, n)
    await page.waitForTimeout(1500)
    out[n] = await page.evaluate((name) => {
      const g = window.__capy
      const api = name === 'sydney' ? g.env : g[name]
      const inWorld = new Set(g.world.bodies.map(b => b.id))
      const rows = []
      const byBiome = {}
      for (const p of g.props) {
        byBiome[p.biome] = (byBiome[p.biome]||0)+1
        if (!inWorld.has(p.body.id)) continue
        let vis = !!p.mesh && p.mesh.visible
        rows.push({ t: p.type, b: p.biome, grab: !!p.grabbable, vis,
                    y: +p.body.position.y.toFixed(2),
                    x: +p.body.position.x.toFixed(1), z: +p.body.position.z.toFixed(1),
                    m: p.mass })
      }
      const terr = api && api.terrainHeight ? api.terrainHeight.bind(api) : null
      for (const r of rows) { const h = terr ? terr(r.x, r.z) : 0; r.dh = +(r.y - (h===h?h:0)).toFixed(2) }
      return { attached: rows.length, grabbable: rows.filter(r=>r.grab).length, byBiome, rows: rows.slice(0,80) }
    }, n)
  }
  await page.evaluate((o) => fetch('/shot?name=props17c.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
