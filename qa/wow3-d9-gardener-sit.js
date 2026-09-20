async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  const CHAPTER = 'sydney'
  const out = { errs, chapter: CHAPTER }
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__capy && document.querySelector('.capyui-go'), null, { timeout: 120000, polling: 500 })
  await page.waitForTimeout(1500)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForFunction(() => window.__capy.state && window.__capy.state.started, null, { timeout: 60000, polling: 500 })
  await page.waitForTimeout(4000)

  out.before = await page.evaluate(() => {
    const g = window.__capy
    const gs = g.npcs.filter(r => r.kind === 'gardener')
    return gs.map(r => ({ state: r.state, x: +r.group.position.x.toFixed(2), z: +r.group.position.z.toFixed(2) }))
  })

  out.forced = await page.evaluate(() => {
    const g = window.__capy
    g.state.finaleOn = true
    g.events.emit('finale:staged', { x: 30, z: 26, r: 2.6, mouth: Math.PI })
    return { finaleOn: g.state.finaleOn }
  })

  // drive real time forward so thinkHuman (staggered) and steerTo settle
  await page.waitForTimeout(32000)

  out.after = await page.evaluate(() => {
    const g = window.__capy
    const gs = g.npcs.filter(r => r.kind === 'gardener')
    return gs.map(r => ({ state: r.state, x: +r.group.position.x.toFixed(2), z: +r.group.position.z.toFixed(2),
                           yaw: +r.yaw.toFixed(2), seatYaw: r.seatYaw !== undefined ? +r.seatYaw.toFixed(2) : null,
                           crouch: r.tgtCrouch !== undefined ? +r.tgtCrouch.toFixed(2) : null }))
  })
  out.travFin = await page.evaluate(() => {
    const g = window.__capy
    const t = g.npcs.find(r => r.trav && r.group && r.group.visible)
    return t ? { x: +t.group.position.x.toFixed(2), z: +t.group.position.z.toFixed(2) } : null
  })

  await page.screenshot({ path: 'qa/wow3-d9-gardener-sit-wide.png' })

  // A close-up, camera pointed at the seat.
  await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    const gs = g.npcs.find(r => r.kind === 'gardener' && r.state === 'gardenerSit')
    if (!gs) return
    const p = gs.group.position
    const cam = g.camera
    cam.position.set(p.x + 4, p.y + 2.2, p.z + 4)
    cam.lookAt(new T.Vector3(p.x, p.y + 0.8, p.z))
    cam.updateMatrixWorld(true)
    g.renderer.setRenderTarget(null)
    g.renderer.render(g.scene, cam)
  })
  await page.screenshot({ path: 'qa/wow3-d9-gardener-sit-close.png' })

  await page.evaluate(async (o) => { await fetch('/shot?name=w1-gardener-sit.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
