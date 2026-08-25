async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const o = { started: !!g.state.started }
    g.biome.switchTo('palawan')
    const api = g.palawan
    function park(tag, x, z, dive) {
      const b = g.capy.body
      b.position.set(x, api.terrainHeight(x, z) + 0.6, z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.input.x = 0; g.input.z = 0; g.input.action = !!dive
      for (let i = 0; i < 300; i++) { g.input.action = !!dive; g.tick(1 / 60, false) }
      const a = { x: g.capy.position.x, z: g.capy.position.z, y: g.capy.position.y }
      let maxLoaf = 0
      for (let i = 0; i < 60 * 60; i++) {
        g.input.action = !!dive; g.tick(1 / 60, false)
        if ((g.capy.loaf || 0) > maxLoaf) maxLoaf = g.capy.loaf
      }
      const c = g.capy.position
      g.input.action = false
      return { tag, moved: +Math.hypot(c.x - a.x, c.z - a.z).toFixed(2),
               slope: +api.slopeAt(c.x, c.z).toFixed(3),
               fell: +(c.y - a.y).toFixed(2), loaf: +(g.capy.loaf || 0).toFixed(2),
               maxLoaf: +maxLoaf.toFixed(2), restT: +(g.capy.restT || 0).toFixed(1),
               swim: !!g.capy.swimming, depth: +(g.capy.depth || 0).toFixed(2),
               vel: +Math.hypot(g.capy.body.velocity.x, g.capy.body.velocity.z).toFixed(3) }
    }
    o.rows = []
    o.rows.push(park('beach 0,46', 0, 46, false))
    o.rows.push(park('sand -13,40', -13, 40, false))
    o.rows.push(park('beach 20,48', 20, 48, false))
    o.rows.push(park('seabed reef', api.reef.x, api.reef.z, true))
    o.lastError = g.state.lastError ? String(g.state.lastError).slice(0, 200) : null
    return o
  })
  out.pageErrors = errs.slice(0, 6)
  await page.evaluate(async d => {
    await fetch('/shot?name=b4pal-5.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(d)))) })
  }, out)
}
