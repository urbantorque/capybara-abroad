async page => {
  const o = await page.evaluate(() => {
    const g = window.__capy, A = g.goreme
    const t = A.truck()
    const b = g.capy.body
    b.position.set(t.x - 9, A.terrainHeight(t.x-9, t.z) + 1.0, t.z)
    b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 60; i++) g.tick(1/60, false)
    const inp = g.input
    let minD = 999
    for (let i = 0; i < 480; i++) {
      inp.x = 1; inp.z = 0; inp.run = true
      g.tick(1/60, false)
      const d = Math.hypot(b.position.x - t.x, b.position.z - t.z)
      if (d < minD) minD = d
    }
    inp.x = 0; inp.run = false
    return { truck: [ +t.x.toFixed(1), +t.z.toFixed(1) ],
             endX: +b.position.x.toFixed(2), endZ: +b.position.z.toFixed(2),
             minDistToTruckCentre: +minD.toFixed(2), passedThrough: b.position.x > t.x + 1.5 }
  })
  await page.evaluate(async q => { await fetch('/shot?name=b4gor-9.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(q))))}) }, o)
}
