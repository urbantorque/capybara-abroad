async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(7000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy, o = {}
    g.biome.switchTo('iceland')
    for (let i = 0; i < 180; i++) g.tick(1 / 60, false)
    const ice = g.iceland
    o.keys = Object.keys(ice).slice(0, 40)
    const th = ice.terrainHeight
    // the moraine line is x 34; the runout is x ~ -20. What is between them?
    const rows = []
    for (const z of [-86, -110, -140, -170, -186]) {
      const prof = []
      for (let x = -34; x <= 44; x += 4) prof.push(+th(x, z).toFixed(1))
      rows.push({ z, x0: -34, step: 4, y: prof })
    }
    o.profile = rows
    // slip: where is the glacier (slippery) and where is the moraine (not)?
    const slip = []
    for (const z of [-110, -160]) {
      const s = []
      for (let x = -34; x <= 44; x += 4) s.push(+(ice.groundSlip ? ice.groundSlip(x, z) : 0).toFixed(2))
      slip.push({ z, s })
    }
    o.slip = slip
    // and the actual walk: run the glacier and see where the animal stops
    const b = g.capy.body
    o.catAt = ice.snowcat ? (typeof ice.snowcat === 'function' ? ice.snowcat() : ice.snowcat) : null
    if (o.catAt) o.catAt = { x: +o.catAt.x.toFixed(1), z: +o.catAt.z.toFixed(1) }
    o.err = g.state.lastError || null
    return o
  })
  await page.evaluate(async (d) => {
    await fetch('/shot?name=b8-ice.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(d, null, 1)))) })
  }, out)
}
