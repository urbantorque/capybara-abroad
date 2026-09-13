async page => {
  // Can the animal WALK onto the raised red podium (L6, E4)? From the deck
  // behind it and from the forecourt up the stairs, steered at its centre.
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(5000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(6000)
  const kb = page.keyboard
  const held = new Set()
  const setKeys = async (want) => {
    for (const k of [...held]) if (!want.has(k)) { await kb.up(k); held.delete(k) }
    for (const k of want) if (!held.has(k)) { await kb.down(k); held.add(k) }
  }
  const out = { runs: [] }
  for (const start of [[0, 1.3, -3.0], [0, 0.6, 9.5], [-9.5, 1.3, 2.4]]) {
    await page.evaluate((s) => {
      const g = window.__capy, b = g.capy.body
      b.position.set(s[0], s[1], s[2]); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, start)
    await page.waitForTimeout(1500)
    const run = { start, path: [] }
    const t0 = Date.now()
    while (Date.now() - t0 < 9000) {
      const s = await page.evaluate(() => { const g = window.__capy, p = g.capy.position; return { x: p.x, y: p.y, z: p.z, camYaw: g.input.camYaw, on: g.env.inZone('operaStage', p.x, p.z), grounded: g.capy.grounded } })
      const dx = 0 - s.x, dz = 2.475 - s.z, d = Math.hypot(dx, dz)
      if ((Date.now() - t0) % 1000 < 260) run.path.push([+s.x.toFixed(1), +s.y.toFixed(2), +s.z.toFixed(1), s.on])
      if (d < 0.6 && s.on) { run.reached = true; run.y = +s.y.toFixed(2); break }
      const cy = Math.cos(s.camYaw), sy = Math.sin(s.camYaw)
      const ix = dx * cy - dz * sy, iz = dx * sy + dz * cy
      const want = new Set()
      if (iz < -0.3 * d) want.add('KeyW'); if (iz > 0.3 * d) want.add('KeyS')
      if (ix < -0.3 * d) want.add('KeyA'); if (ix > 0.3 * d) want.add('KeyD')
      await setKeys(want)
      await page.waitForTimeout(150)
    }
    await setKeys(new Set())
    run.end = await page.evaluate(() => { const g = window.__capy, p = g.capy.position; return [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), g.env.inZone('operaStage', p.x, p.z)] })
    out.runs.push(run)
  }
  // ...and Q from the middle: a note, not a why
  await page.waitForTimeout(800)
  await kb.press('KeyQ')
  await page.waitForTimeout(600)
  out.concert = await page.evaluate(() => window.__capy.env.concertAudit())
  out.toasts = await page.evaluate(() => [...document.querySelectorAll('.capyui-toast')].map(e => e.textContent))
  out.why = await page.evaluate(() => window.__capy.hud.toastAudit().whyLast)
  await page.screenshot({ path: 'qa/l6-paper-podium.png' })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate((o) => fetch('/shot?name=l6-paper-podium.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
