async page => {
  const out = {}
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload({ timeout: 90000 })
  await page.waitForTimeout(6500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(3000)
  await page.evaluate(() => { const g = window.__capy; if (!g.biome.isActive('venice')) g.biome.switchTo('venice') })
  await page.waitForTimeout(4200)
  out.r = await page.evaluate(() => {
    const g = window.__capy, CANNON = g.CANNON
    const api = g.venice
    const near = []
    for (const b of g.world.bodies) {
      if (b.mass !== 0) continue
      const d = Math.hypot(b.position.x - (-86), b.position.z - 46)
      if (d > 40) continue
      const shapes = b.shapes.map(s => {
        if (s instanceof CANNON.Box) return 'Box ' + [s.halfExtents.x, s.halfExtents.y, s.halfExtents.z].map(v => +v.toFixed(1)).join('x')
        return s.constructor && s.constructor.name
      })
      near.push({ at: [+b.position.x.toFixed(1), +b.position.y.toFixed(1), +b.position.z.toFixed(1)], d: +d.toFixed(1), shapes })
    }
    return {
      bodiesWithin40m: near,
      terrainAtSalute: api && api.terrainHeight ? +api.terrainHeight(-86, 46).toFixed(2) : null,
      overWater: api && api.isOverWater ? !!api.isOverWater(-86, 46) : null,
      waterLevel: api && typeof api.waterLevel === 'number' ? +api.waterLevel.toFixed(2) : null
    }
  })
  await page.evaluate(o => fetch('/shot?name=px-x5-salute.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))
  }), out)
}
