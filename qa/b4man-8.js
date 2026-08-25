async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch(e){} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
    const g = window.__capy
    g.biome.switchTo('manly'); await sleep(1000)
    const m = g.manly, capy = g.capy, b = capy.body
    const o = { spots: [] }
    const SP = { spawn:[0,46], drySand:[0,30], swash:[0,25.2], dune:[-30,33], prom:[30,40], corso:[0,58], poolDeck:[63,24] }
    for (const k in SP) {
      const s = SP[k]
      b.position.set(s[0], m.terrainHeight(s[0], s[1]) + 0.5, s[1])
      b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 120; i++) g.tick(1/60, false)
      const x0 = capy.position.x, z0 = capy.position.z
      let loafMax = 0, wetMax = 0, depthMax = 0
      for (let i = 0; i < 3600; i++) {      // 60 s, no input
        g.tick(1/60, false)
        if ((capy.loaf||0) > loafMax) loafMax = capy.loaf
        if ((capy.wet||0) > wetMax) wetMax = capy.wet
        if ((capy.depth||0) > depthMax) depthMax = capy.depth
      }
      o.spots.push({ at: k, drift: +Math.hypot(capy.position.x-x0, capy.position.z-z0).toFixed(3),
        loaf: +loafMax.toFixed(2), wet: +wetMax.toFixed(2), depth: +depthMax.toFixed(2),
        y: +capy.position.y.toFixed(2), swim: !!capy.swimming })
      await sleep(0)
    }
    // WALK THE SWASH: does going through the shorebreak on foot wet the coat?
    b.position.set(0, m.terrainHeight(0, 34) + 0.5, 34); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 60; i++) g.tick(1/60, false)
    let wetWalk = 0, deepWalk = 0, swamWalk = false
    for (let i = 0; i < 1200; i++) {
      b.position.z -= 0.012                        // 0.72 m/s shoreward-to-seaward
      g.tick(1/60, false)
      const d = capy.depth || 0
      if (d > deepWalk) deepWalk = d
      if (d > 0.05 && d < 0.55) { if ((capy.wet||0) > wetWalk) wetWalk = capy.wet }
      if (capy.swimming) { swamWalk = true; break }
    }
    o.swashWalk = { wetWhileWadingOnly: +wetWalk.toFixed(2), maxDepth: +deepWalk.toFixed(2),
                    reachedSwim: swamWalk, z: +capy.position.z.toFixed(1),
                    publishesSoaking: typeof m.soaking === 'function' }
    return o
  })
  await page.evaluate(async o => { await fetch('/shot?name=b4man-8.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
