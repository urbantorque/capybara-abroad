async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const out = {}
  // gravity has to be put back: switch drift -> sydney -> drift -> iceland and
  // assert -24 / -8.6 / -24 (capy3-drift-air-and-gravity)
  out.gravity = await page.evaluate(() => {
    const g = window.__capy, r = []
    for (const n of ['drift', 'sydney', 'drift', 'iceland', 'sahara', 'drift']) {
      g.biome.switchTo(n)
      for (let i = 0; i < 20; i++) g.tick(1/60, false)
      r.push([n, +g.world.gravity.y.toFixed(2)])
    }
    return r
  })
  // and a real-clock soak with the audio path live, per biome
  for (const n of ['sahara', 'drift']) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, n)
    // real keys, real clock, rAF running: this is the only thing that exercises
    // the ambience and score paths (headless-qa-harness)
    for (const k of ['w', 'd']) await page.keyboard.down(k)
    await page.waitForTimeout(9000)
    for (const k of ['w', 'd']) await page.keyboard.up(k)
    await page.keyboard.press('q')
    await page.waitForTimeout(800)
    await page.keyboard.press('e')
    await page.waitForTimeout(800)
    await page.keyboard.press('Space')
    await page.waitForTimeout(1200)
    // and the storm / the lantern, whichever this chapter has
    await page.waitForTimeout(9000)
    out[n] = await page.evaluate((name) => {
      const g = window.__capy
      const api = g[name]
      return { err: g.state.lastError || null, t: +g.state.time.toFixed(1),
               pos: [Math.round(g.capy.position.x), Math.round(g.capy.position.y), Math.round(g.capy.position.z)],
               bodies: g.world.bodies.length,
               extra: name === 'sahara'
                 ? { storm: +api.storm().toFixed(2), dusk: +api.dusk().toFixed(2) }
                 : { flies: api.lampflies(), wind: +api.windSpeed().toFixed(2), lit: api.lit() } }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=zsoak.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
