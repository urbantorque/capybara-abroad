async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Minus')
  await page.waitForTimeout(9000)
  const out = { rows: [] }
  for (const [tag, y, yaw, dist, pitch] of [['a', 9.0, 1.75, 4.2, -0.02],
                                            ['b', 9.0, 2.60, 5.0, 0.04],
                                            ['c', 14.0, 1.20, 4.6, 0.02]]) {
    await page.evaluate(o => {
      const g = window.__capy
      const s = g.kowloon.scaffold
      g.capy.body.position.set(s.x - 1.1, o.y, s.z)
      g.capy.body.velocity.set(0, 0, 0)
    }, { y: y })
    await page.waitForTimeout(900)
    await page.keyboard.down('KeyE')
    await page.waitForTimeout(2200)
    await page.evaluate(o => {
      window.__capy.frameShot({ yaw: o.yaw, dist: o.dist, pitch: o.pitch, raise: 1.2, hold: 6 })
    }, { yaw: yaw, dist: dist, pitch: pitch })
    await page.waitForTimeout(1500)
    await page.screenshot({ path: 'qa/d8s-climb-' + tag + '.png' })
    out.rows.push(await page.evaluate(() => {
      const a = window.__capy.capy.animAudit()
      return { pose: +a.climbPose.toFixed(2), pitch: +a.pitch.toFixed(2),
               y: +window.__capy.capy.position.y.toFixed(2),
               legX: a.legX.map(v => +v.toFixed(2)) }
    }))
    await page.keyboard.up('KeyE')
    await page.waitForTimeout(600)
  }
  await page.evaluate(o => fetch('/shot?name=d8-climbshot.json',
      { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
