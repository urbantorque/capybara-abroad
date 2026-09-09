async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => window.__capy.biome.switchTo('cali'))
  await page.waitForTimeout(1200)
  const out = await page.evaluate(() => {
    const g = window.__capy, c = g.cali
    const F = c.floor
    const boxes = []
    for (const b of g.world.bodies) {
      if (b.mass > 0 && b.type !== 4) continue
      let skip=false
      for (const sh of b.shapes){const t=sh.constructor&&sh.constructor.name; if(t==='Heightfield'||t==='Plane')skip=true}
      if (skip) continue
      b.updateAABB(); const lo=b.aabb.lowerBound, hi=b.aabb.upperBound
      if(!(lo.x===lo.x))continue
      boxes.push([Math.round(lo.x*10)/10,Math.round(lo.y*10)/10,Math.round(lo.z*10)/10,
                  Math.round(hi.x*10)/10,Math.round(hi.y*10)/10,Math.round(hi.z*10)/10])
    }
    // which colliders overlap the dance-floor disc at chest height?
    const y = c.terrainHeight(F.x, F.z) + 0.9
    const hits = boxes.filter(q => {
      if (y < q[1] || y > q[4]) return false
      const cx = Math.max(q[0], Math.min(F.x, q[3]))
      const cz = Math.max(q[2], Math.min(F.z, q[5]))
      return Math.hypot(cx - F.x, cz - F.z) < F.r
    })
    // and how much of the floor is blocked, on a 1 m grid
    let free = 0, blocked = 0
    for (let dx = -F.r; dx <= F.r; dx += 1) {
      for (let dz = -F.r; dz <= F.r; dz += 1) {
        if (dx*dx + dz*dz > F.r*F.r) continue
        const px = F.x + dx, pz = F.z + dz
        let bad = false
        for (const q of boxes) {
          if (y < q[1] || y > q[4]) continue
          if (px > q[0] && px < q[3] && pz > q[2] && pz < q[5]) { bad = true; break }
        }
        if (bad) blocked++; else free++
      }
    }
    return { floor: F, chestY: Math.round(y*100)/100, overlapping: hits, free, blocked,
             pct: Math.round(blocked / (free+blocked) * 100) }
  })
  await page.evaluate((o) => fetch('/shot?name=s2cali.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
