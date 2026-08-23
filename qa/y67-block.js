async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('rio')
    for (let i=0;i<30;i++) g.tick(1/60,false)
    const api = g.rio
    const res = { blockedRows: [], gaps: [], stands: [] }
    // sweep x, find the northmost z reachable from z=10 by a straight march
    for (let x = -110; x <= 110; x += 2) {
      let firstBlock = null
      for (let z = 10; z <= 60; z += 0.5) {
        if (api.navBlocked(x, z, 0.6)) { firstBlock = z; break }
      }
      res.blockedRows.push([x, firstBlock])
    }
    res.gaps = res.blockedRows.filter(r => r[1] === null).map(r => r[0])
    // list every static body whose AABB straddles z in [20,60]
    for (const b of g.world.bodies) {
      if (b.mass > 0) continue
      let hf = false
      for (const s of b.shapes) if (s.constructor && s.constructor.name === 'Heightfield') hf = true
      if (hf) continue
      b.updateAABB()
      const lo = b.aabb.lowerBound, hi = b.aabb.upperBound
      if (hi.z < 20 || lo.z > 60) continue
      res.stands.push([Math.round(lo.x), Math.round(lo.z), Math.round(hi.x), Math.round(hi.z), Math.round(hi.y*10)/10])
    }
    return res
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=y67block.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
