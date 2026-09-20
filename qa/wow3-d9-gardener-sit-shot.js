async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  const out = { errs }
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__capy && document.querySelector('.capyui-go'), null, { timeout: 120000, polling: 500 })
  await page.waitForTimeout(1500)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForFunction(() => window.__capy.state && window.__capy.state.started, null, { timeout: 60000, polling: 500 })
  await page.waitForTimeout(4000)

  await page.evaluate(() => {
    const g = window.__capy
    g.state.finaleOn = true
    g.events.emit('finale:staged', { x: 30, z: 26, r: 2.6, mouth: Math.PI })
  })
  await page.waitForTimeout(32000)

  out.info = await page.evaluate(() => {
    const g = window.__capy
    const gs = g.npcs.filter(r => r.kind === 'gardener' && r.state === 'gardenerSit')
    if (!gs.length) return { skipped: 'no seated gardener' }
    let cx = 0, cz = 0
    for (const r of gs) { cx += r.group.position.x; cz += r.group.position.z }
    cx /= gs.length; cz /= gs.length
    // stand the capybara a few metres off, facing them, and let the
    // game's OWN follow camera settle there rather than hand-driving it
    const b = g.capy.body
    const dx = cx - (g.capy.position ? g.capy.position.x : cx), dz = cz - (g.capy.position ? g.capy.position.z : cz)
    const ang = Math.atan2(dx, dz)
    const sx = cx - Math.sin(ang) * 5, sz = cz - Math.cos(ang) * 5
    b.position.set(sx, 0.6, sz); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    b.aabbNeedsUpdate = true
    return { n: gs.length, states: gs.map(r => ({ x: +r.group.position.x.toFixed(2), z: +r.group.position.z.toFixed(2) })) }
  })
  await page.waitForTimeout(3500)
  await page.screenshot({ path: 'qa/wow3-d9-gardener-sit-close.png' })
  await page.evaluate(async (o) => { await fetch('/shot?name=w1-gardener-sit-shot.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
