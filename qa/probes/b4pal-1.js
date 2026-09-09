async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(7000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const o = { steps: [] }
    const settle = n => { for (let i = 0; i < n; i++) g.tick(1 / 60, false) }
    g.biome.switchTo('palawan')
    const api = g.palawan
    o.hasApi = !!api
    o.reef = api ? { x: api.reef.x, z: api.reef.z } : null
    o.fire = api ? { x: api.fire.x, z: api.fire.z } : null
    o.jetty = api ? api.jetty : null
    o.beach = api ? api.beach : null
    // park the animal over the reef, in the water
    const b = g.capy.body
    const rx = api.reef.x, rz = api.reef.z
    o.reefTerrain = api.terrainHeight(rx, rz)
    b.position.set(rx, 0.4, rz); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    g.input.x = 0; g.input.z = 0; g.input.action = false
    settle(120)
    o.afterPark = { y: +g.capy.position.y.toFixed(2), depth: +(g.capy.depth || 0).toFixed(2), swim: !!g.capy.swimming }
    // dive: hold action
    g.input.action = true; g.input.actionPressed = false
    for (let i = 0; i < 60 * 12; i++) { g.input.action = true; g.tick(1 / 60, false) }
    o.afterDive = { y: +g.capy.position.y.toFixed(2), depth: +(g.capy.depth || 0).toFixed(2),
                    bloom: +api.bloom().toFixed(3), sub: +api.submerged().toFixed(3) }
    // now run to the bloom, keeping the dive held
    let ticks = 0
    while (api.bloom() < 0.56 && ticks < 60 * 200) { g.input.action = true; g.tick(1 / 60, false); ticks++ }
    o.ticksToBloom = ticks
    o.atBloom = { y: +g.capy.position.y.toFixed(2), depth: +(g.capy.depth || 0).toFixed(2),
                  bloom: +api.bloom().toFixed(3), sub: +api.submerged().toFixed(3),
                  x: +g.capy.position.x.toFixed(2), z: +g.capy.position.z.toFixed(2) }
    o.done = !!(g.state && g.state.tasks && g.state.tasks['the-bloom'])
    try { o.tasksDone = Object.keys(g.state.tasks || {}).filter(k => g.state.tasks[k]) } catch (e) { o.tasksDone = String(e) }
    o.lastError = g.state.lastError ? String(g.state.lastError).slice(0, 200) : null
    return o
  })
  out.pageErrors = errs.slice(0, 6)
  await page.evaluate(async d => {
    await fetch('/shot?name=b4pal-1.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(d)))) })
  }, out)
}
