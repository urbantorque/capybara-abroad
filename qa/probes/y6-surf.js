async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('rio')
    const api = g.rio, b = g.capy.body
    const res = { rides: [], flowMax: 0, liftMax: 0 }
    // sit the animal in the pocket at three different x across the break and
    // let three sets go past
    for (const px of [-70, -36, -6]) {
      b.position.set(px, 0, -50); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      let best = 0, on = 0
      for (let i = 0; i < 4200; i++) {
        g.tick(1/60, false)
        const p = g.capy.body.position
        const f = api.flow(p.x, p.z)
        if (f.z > res.flowMax) res.flowMax = Math.round(f.z*100)/100
        const h = api.waterHeightAt(p.x, p.z) - api.waterLevel
        if (h > res.liftMax) res.liftMax = Math.round(h*100)/100
        if (api.surfing()) on++
        if (p.z > -14) { b.position.set(px, 0, -50); b.velocity.set(0,0,0) }
      }
      res.rides.push([px, on])
    }
    // and how far apart the crest and the pocket are, per x, now the bow is in
    const reg = []
    for (let x = -70; x <= 0; x += 10) {
      // sweep z to find where flow peaks and where the lift peaks
      let fz = -999, fzp = 0, ly = -999, lyp = 0
      for (let z = -70; z < -10; z += 0.25) {
        const f = api.flow(x, z)
        if (f.z > fz) { fz = f.z; fzp = z }
        const h = api.waterHeightAt(x, z) - api.waterLevel
        if (h > ly) { ly = h; lyp = z }
      }
      reg.push([x, Math.round((fzp - lyp)*10)/10])
    }
    res.registration = reg
    return res
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=y6surf.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
