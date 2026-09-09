async page => {
  await page.reload()
  await page.waitForTimeout(4500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const jobs = [['venice',1.7,25.7],['cali',1.5,25.5],['kowloon',0,-62],['antarctic',0,36],['drift',3.5,43.5]]
  const out = {}
  for (const [n, x, z] of jobs) {
    await page.evaluate((o) => {
      const g = window.__capy
      g.biome.switchTo(o.name)
      const sp = g.biome.spawnOf(o.name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, { name: n })
    await page.waitForTimeout(700)
    out[n] = await page.evaluate((o) => {
      const g = window.__capy, CANNON = g.CANNON
      const api = o.name === 'sydney' ? g.env : g[o.name]
      const t = api.terrainHeight ? api.terrainHeight(o.x, o.z) : 0
      const w = api.waterHeightAt ? api.waterHeightAt(o.x, o.z) : null
      const over = api.isOverWater ? api.isOverWater(o.x, o.z) : null
      const res = new CANNON.RaycastResult()
      const hits = []
      let fromY = (t===t?t:0) + 12
      for (let k = 0; k < 6; k++) {
        res.reset()
        g.world.raycastClosest(new CANNON.Vec3(o.x, fromY, o.z), new CANNON.Vec3(o.x, (t===t?t:0) - 15, o.z), { skipBackfaces: false }, res)
        if (!res.hasHit) break
        const b = res.body
        hits.push({ y: +res.hitPointWorld.y.toFixed(2), shapes: b.shapes.map(s=>s.constructor.name).join('+'),
                    mass: b.mass, kine: b.type === 4,
                    bpos: [+b.position.x.toFixed(1), +b.position.y.toFixed(1), +b.position.z.toFixed(1)] })
        fromY = res.hitPointWorld.y - 0.05
        if (fromY < (t===t?t:0) - 14) break
      }
      return { terrain: t===t?+t.toFixed(2):null, water: w!=null?+w.toFixed(2):null, overWater: over, stack: hits }
    }, { name: n, x, z })
  }
  await page.evaluate((o) => fetch('/shot?name=spot.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
