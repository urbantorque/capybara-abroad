async page => {
  // A PICTURE OF SOMEBODY IN THE CROWD GESTURING. Same difficulty as D7's beat
  // and solved the same way: the gesture is about half a second long, so the
  // probe waits for `gestAudit` to report one IN PROGRESS and takes the shot
  // from the position it reports rather than trying to find the person.
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)
  const out = { rows: [] }
  for (let k = 0; k < 5; k++) {
    const hit = await page.evaluate(() => new Promise(res => {
      const g = window.__capy
      let n = 0
      const t = setInterval(() => {
        const a = g.gestAudit()
        if (a.at && a.armMax > 0.45) {
          clearInterval(t)
          const c = g.capy
          // Stand the animal 2.6 m past them and put the lens on the far side.
          const dx = a.at.x - c.position.x, dz = a.at.z - c.position.z
          const d = Math.hypot(dx, dz) || 1
          c.body.position.set(a.at.x + dx / d * 2.6, a.at.y + 0.4, a.at.z + dz / d * 2.6)
          c.body.velocity.set(0, 0, 0)
          g.frameShot({ yaw: Math.atan2(-dx / d, -dz / d), dist: 4.6,
                        pitch: -0.04, raise: 1.4, hold: 4 })
          res(a)
          return
        }
        if (++n > 120) { clearInterval(t); res(null) }
      }, 60)
    }))
    if (!hit) { out.rows.push(null); continue }
    await page.waitForTimeout(700)
    await page.screenshot({ path: 'qa/d8s-gest-' + (k + 1) + '.png' })
    out.rows.push(Object.assign(hit, await page.evaluate(() => window.__capy.gestAudit())))
    await page.waitForTimeout(1500)
  }
  await page.evaluate(o => fetch('/shot?name=d8-gestshot.json',
      { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
