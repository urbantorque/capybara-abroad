async page => {
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(2500)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForTimeout(1500)
  await page.evaluate(() => window.__capy.hud.cross('manly'))
  await page.waitForTimeout(9500)
  await page.evaluate(() => {
    const g = window.__capy
    const capy = g.capy
    if (capy.body) {
      capy.body.position.set(0, 3, -200)
      capy.body.velocity.set(0, 0, 0)
      if (capy.body.previousPosition) capy.body.previousPosition.copy(capy.body.position)
      if (capy.body.interpolatedPosition) capy.body.interpolatedPosition.copy(capy.body.position)
    }
    if (typeof capy.face === 'function') capy.face(Math.PI)   // nose toward -z, toward the ferry path
  })
  const poll = []
  let fired = false
  for (let i = 0; i < 24 && !fired; i++) {
    await page.waitForTimeout(1000)
    const r = await page.evaluate(() => {
      const g = window.__capy
      const fa = g.far && typeof g.far.audit === 'function' ? g.far.audit() : null
      const ga = typeof g.farGlanceAudit === 'function' ? g.farGlanceAudit() : null
      return { mover: fa && fa.mover, glanced: ga && ga.glanced, shotW: ga && ga.shotW, yaw: ga && ga.yaw, capy: g.capy.position, grounded: g.capy.grounded }
    })
    poll.push(r)
    if (r.glanced && r.shotW > 0.05) fired = true
  }
  let abort = null
  if (fired) {
    await page.keyboard.down('KeyZ')
    await page.waitForTimeout(380)
    await page.keyboard.up('KeyZ')
    const after = await page.evaluate(() => window.__capy.farGlanceAudit())
    await page.waitForTimeout(300)
    const after2 = await page.evaluate(() => window.__capy.farGlanceAudit())
    abort = { after, after2 }
  }
  await page.screenshot({ path: 'qa/wow3-lens-manly-shot.png' })
  await page.evaluate(async (obj) => {
    const b64 = btoa(JSON.stringify(obj, null, 1))
    await fetch('/shot?name=wow3-lens', { method: 'POST', body: b64 })
  }, { poll, fired, abort })
}
