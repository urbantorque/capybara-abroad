async page => {
  // ROADMAP-WOW2 V1.4 — WET FUR. Into Sydney's harbour and out again: the
  // coat's look (wetVis, and the fur twin's red channel) against the level
  // over 30 s ashore, the drips counted off the burst pool for the first six
  // seconds, a frame at 3 s ashore read by eye, and the same walk with
  // `noAlive` (the old switch: dark at 0.42, dry at 0.28, 5.8 s).
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(9000)
  const out = { errs, arms: {} }
  for (const arm of ['live', 'cut']) {
    const r = await page.evaluate((arm) => {
      const g = window.__capy, inp = g.input, T = g.THREE
      g.state.noAlive = arm === 'cut'
      const steer = (tx, tz, run) => {
        const p = g.capy.position, dx = tx - p.x, dz = tz - p.z, m = Math.hypot(dx, dz) || 1
        const cy = inp.camYaw || 0
        inp.x = Math.cos(cy) * (dx / m) - Math.sin(cy) * (dz / m)
        inp.z = Math.sin(cy) * (dx / m) + Math.cos(cy) * (dz / m)
        inp.run = !!run
        return m
      }
      // awake (a direct write to input.x does not go through the keyboard's
      // wake(), and thirty seconds of rest between the arms is a nap)
      g.capy.wake(120)
      // back to the lawn first, so both arms start from the same place; then
      // to the water off the podium's east flank, swim 3 s, back to the lawn
      let k = 0, swam = 0, home = 0
      for (; home < 60 * 20; home++) { if (steer(2, 20, true) < 1.5) break; g.tick(1 / 60, false) }
      for (; k < 60 * 40; k++) {
        const p = g.capy.position
        if (p.z > -2 && swam === 0 && p.x < 22) steer(26, 0, true)
        else if (swam < 180) { steer(26, -30, true); if (g.capy.animAudit().swimBobW > 0.5 || g.capy.animAudit().wetLevel > 0.99) swam++ }
        else break
        g.tick(1 / 60, false)
      }
      // ashore: the point the animal is on its feet with water under it no more
      let ashoreAt = -1, rows = [], drips0 = g.weather.burstAudit().born, dripsAt6 = null, shotUrl = null
      const b0 = drips0
      for (let i = 0; i < 60 * 45; i++) {
        const p = g.capy.position
        if (p.z < 2) steer(26, 12, false); else { inp.x = 0; inp.z = 0; inp.run = false }
        g.tick(1 / 60, false)
        const a = g.capy.animAudit()
        if (ashoreAt < 0 && g.capy.grounded && a.swimAgo > 0.3) { ashoreAt = i; drips0 = g.weather.burstAudit().born }
        if (ashoreAt >= 0) {
          const t = (i - ashoreAt) / 60
          if (dripsAt6 === null && t >= 6.5) dripsAt6 = g.weather.burstAudit().born - drips0
          if (Math.abs(t - Math.round(t)) < 0.009) rows.push({ t: Math.round(t), level: +a.wetLevel.toFixed(2), vis: +a.wetVis.toFixed(2), dark: a.wetDark ? 1 : 0, furR: +a.furR.toFixed(3) })
          if (!shotUrl && t >= 3.0) {
            const yaw = g.capy.group ? g.capy.group.rotation.y : 0
            const c = new T.PerspectiveCamera(34, 1280 / 760, 0.05, 400)
            c.position.set(p.x + Math.sin(yaw + 2.2) * 2.4, p.y + 0.35, p.z + Math.cos(yaw + 2.2) * 2.4)
            c.lookAt(p.x, p.y - 0.1, p.z); c.updateMatrixWorld()
            g.renderer.setRenderTarget(null); g.renderer.render(g.scene, c); g.renderer.render(g.scene, c)
            shotUrl = g.renderer.domElement.toDataURL('image/png')
          }
          if (t > 32) break
        }
      }
      inp.x = 0; inp.z = 0; inp.run = false
      window.__wetShot = shotUrl
      const dryAt = rows.find(r => r.dark === 0 && r.t > 0)
      return { swamTicks: swam, homeTicks: home, toWaterTicks: k, ashoreAt, drips: dripsAt6, dryAtS: dryAt ? dryAt.t : null, rows, pos: [+g.capy.position.x.toFixed(1), +g.capy.position.z.toFixed(1)] }
    }, arm)
    out.arms[arm] = r
    const url = await page.evaluate(() => window.__wetShot)
    if (url) await page.evaluate(async (o) => { await fetch('/shot?name=' + o.n, { method: 'POST', body: o.u }) }, { n: 'wow2-wet-' + arm, u: url })
    await page.evaluate(() => { const g = window.__capy; g.state.noAlive = false; for (let k = 0; k < 60 * 30; k++) g.tick(1 / 60, false) })
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-wet.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
