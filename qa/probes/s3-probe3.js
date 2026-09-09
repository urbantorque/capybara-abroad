async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy, CANNON = g.CANNON
    g.biome.switchTo('venice')
    const rows = []
    for (const b of g.world.bodies) {
      if (b.mass > 0 && b.type !== 4) continue
      let skip = false
      for (const sh of b.shapes) { const t = sh.constructor && sh.constructor.name; if (t==='Heightfield'||t==='Plane') skip = true }
      if (skip) continue
      b.updateAABB()
      const lo = b.aabb.lowerBound, hi = b.aabb.upperBound
      if (!(lo.x === lo.x)) continue
      // does it overlap the corridor x -20..-15, z -27..-23, y 0.4..2.2 ?
      if (hi.x < -20 || lo.x > -15 || hi.z < -27 || lo.z > -23 || hi.y < 0.4 || lo.y > 2.2) continue
      const shapes = []
      for (let i = 0; i < b.shapes.length; i++) {
        const sh = b.shapes[i], off = b.shapeOffsets[i]
        if (!sh.halfExtents) continue
        const cx = b.position.x + off.x, cy = b.position.y + off.y, cz = b.position.z + off.z
        if (cx + sh.halfExtents.x < -20 || cx - sh.halfExtents.x > -15) continue
        if (cz + sh.halfExtents.z < -27 || cz - sh.halfExtents.z > -23) continue
        shapes.push([+cx.toFixed(2), +cy.toFixed(2), +cz.toFixed(2),
                     +sh.halfExtents.x.toFixed(2), +sh.halfExtents.y.toFixed(2), +sh.halfExtents.z.toFixed(2)])
      }
      rows.push({ n: b.shapes.length, aabb: [+lo.x.toFixed(1),+lo.y.toFixed(1),+lo.z.toFixed(1),+hi.x.toFixed(1),+hi.y.toFixed(1),+hi.z.toFixed(1)], shapes })
    }
    return { rows, terr: [-15,-16,-17,-18,-19,-20].map(x => +g.venice.terrainHeight(x, -25.4).toFixed(2)) }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=s3probe3.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1)))) }) }, out)
}
