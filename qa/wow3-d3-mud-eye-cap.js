async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(9000)
  await page.evaluate(() => window.__capy.hud.cross('pantanal'))
  await page.waitForTimeout(9500)
  const out = { errs }
  out.info = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    const api = g.pantanal, p0 = g.capy.position
    let best = null, bd = 1e9
    for (let dx = -70; dx <= 70; dx += 2) for (let dz = -70; dz <= 70; dz += 2) {
      const x = p0.x + dx, z = p0.z + dz
      if (api.isOverWater && api.isOverWater(x, z)) continue
      const y = api.terrainHeight ? api.terrainHeight(x, z) : 0
      const pitch = api.surfacePitch(x, z, y + 0.34)
      if (api.surfaceMat() !== 'grass' || !(pitch <= 0.70)) continue
      const d = dx * dx + dz * dz
      if (d < bd) { bd = d; best = { x, z, y, pitch } }
    }
    if (!best) return { found: false }
    const b = g.capy.body
    b.position.set(best.x, best.y + 1.0, best.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    g.capy.wake(300)
    const inp = g.input
    inp.x = 0; inp.z = 0; inp.run = false
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
    const from = { x: g.capy.position.x, z: g.capy.position.z }
    // The simplest possible walk: one heading, held, same as V6's own sand
    // and snow proof. It may run into the bank's own slope and not get far
    // (measured elsewhere on this bank: 0.3 m net in 25 s against a bad
    // heading) — that is fine here, since what this needs is footfalls
    // inside the wet gate, not distance, and the trail's own centre
    // (tracksAudit) is what the camera frames below, not the animal's
    // start/end point.
    for (let i = 0; i < 60 * 20; i++) {
      const p = g.capy.position
      const dx = (from.x + 8) - p.x, dz = from.z - p.z, m = Math.hypot(dx, dz) || 1
      const cy = inp.camYaw || 0
      inp.x = Math.cos(cy) * (dx / m) - Math.sin(cy) * (dz / m)
      inp.z = Math.sin(cy) * (dx / m) + Math.cos(cy) * (dz / m)
      g.tick(1 / 60, false)
    }
    inp.x = 0; inp.z = 0
    const aud = g.capy.animAudit()
    const ctr = aud.tracks.centre
    const cx0 = (ctr && ctr[0]) || best.x, cz0 = (ctr && ctr[1]) || best.z
    const my = api.terrainHeight ? api.terrainHeight(cx0, cz0) : best.y
    const cam = new T.PerspectiveCamera(45, 1280 / 760, 0.05, 400)
    cam.position.set(cx0 + 2.4, my + 3.4, cz0 + 2.4)
    cam.lookAt(cx0, my, cz0); cam.updateMatrixWorld()
    g.renderer.setRenderTarget(null)
    // The animal is standing right on top of its own print cluster (it
    // barely moved net, see `walked`) — hide it for the eye-read the same
    // way a hide-and-diff mask does, so the ground under it is not guessed
    // at from memory.
    const capyGroup = g.capy.group
    const wasVis = capyGroup.visible
    capyGroup.visible = false
    g.renderer.render(g.scene, cam); g.renderer.render(g.scene, cam)
    window.__mudEye = g.renderer.domElement.toDataURL('image/png')
    capyGroup.visible = wasVis
    return { found: true, ctr: [cx0, cz0], live: aud.tracks.live, born: aud.tracks.born, patch: best,
             walked: +Math.hypot(g.capy.position.x - from.x, g.capy.position.z - from.z).toFixed(2) };
  })
  const url = await page.evaluate(() => window.__mudEye)
  if (url) await page.evaluate(async (u) => { await fetch('/shot?name=wow3-d3-mud-eye', { method: 'POST', body: u }) }, url)
  await page.evaluate(async (o) => { await fetch('/shot?name=wow3-d3-mud-eye.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
