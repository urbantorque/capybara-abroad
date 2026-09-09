async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch(e){} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(6500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(async () => { window.__capy.biome.switchTo('manly'); await new Promise(r=>setTimeout(r,1000)) })
  const spots = { beachMid:[0,30], beachUpper:[0,33], beachLower:[0,27], dune:[-30,34] }
  const out = { rows: [] }
  for (const k of Object.keys(spots)) {
    // 60 s split into two 30 s evaluates so neither exceeds the context limit
    await page.evaluate(q => {
      const g = window.__capy, m = g.manly, b = g.capy.body
      b.position.set(q.s[0], m.terrainHeight(q.s[0], q.s[1]) + 0.4, q.s[1])
      b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.input.x = 0; g.input.z = 0; g.input.action = false; g.input.run = false
      for (let i = 0; i < 150; i++) g.tick(1/60, false)
      window.__a = { x: g.capy.position.x, z: g.capy.position.z }
    }, { s: spots[k] })
    for (let half = 0; half < 2; half++) {
      await page.evaluate(() => { const g = window.__capy
        for (let i = 0; i < 1800; i++) { g.input.x = 0; g.input.z = 0; g.tick(1/60, false) } })
    }
    out.rows.push(await page.evaluate(q => {
      const g = window.__capy, m = g.manly, c = g.capy.position, a = window.__a
      return { at: q.k, secs: 60,
        moved: +Math.hypot(c.x-a.x, c.z-a.z).toFixed(2),
        slope: +m.slopeAt(c.x, c.z).toFixed(3),
        vel: +Math.hypot(g.capy.body.velocity.x, g.capy.body.velocity.z).toFixed(3),
        swim: !!g.capy.swimming, wet: +(g.capy.wet||0).toFixed(2),
        loaf: +(g.capy.loaf||0).toFixed(2),
        z: +c.z.toFixed(1), publishesGroundSlip: typeof m.groundSlip === 'function' }
    }, { k: k }))
  }
  await page.evaluate(async o => { await fetch('/shot?name=b4man-10.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
