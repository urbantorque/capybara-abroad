// PAYOFF batch 1, job 3: THE HOT SPRING, which is the loaf's marquee.
// The task must still complete on its own terms, the animal must be visibly
// sitting while it does, the score must lean and the aurora must still arm.
async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 160)))
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(800)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const R = { issues: [] }
    g.biome.switchTo('iceland')
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
    // into the pool: iceSPRING is (-40, -10, r 8.5)
    const b = g.capy.body
    b.position.set(-40, 1.2, -10)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    b.velocity.set(0, 0, 0)
    g.input.x = 0; g.input.z = 0
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
    R.swimming = !!g.capy.swimming
    R.depth = +(g.capy.depth || 0).toFixed(2)
    let loafAt = -1, doneAt = -1
    for (let i = 0; i < 60 * 22; i++) {
      g.tick(1 / 60, false)
      if (loafAt < 0 && g.capy.loaf > 0.5) loafAt = +(i / 60).toFixed(2)
      if (doneAt < 0 && g.hud.isTaskDone('hot-spring')) doneAt = +(i / 60).toFixed(2)
    }
    R.loafAtS = loafAt
    R.taskAtS = doneAt
    R.loaf = +g.capy.loaf.toFixed(2)
    const a = g.hud.calmAudit()
    R.calm = +a.calm.toFixed(2)
    R.sheep = a.critters.filter(c => c.live).map(c => ({ near: +c.near.toFixed(2), appr: +c.appr.toFixed(2), bold: c.bold }))
    // ...and getting out stands it up again. Teleported rather than walked:
    // the pool is 8.5 m across and a swimming capybara does not clear it in
    // four seconds, so the first cut of this failed on its own geometry.
    b.position.set(-40 + 26, 3, -10)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    b.velocity.set(0, 0, 0)
    for (let i = 0; i < 150; i++) g.tick(1 / 60, false)
    R.loafAfterLeaving = +g.capy.loaf.toFixed(2)
    R.err = g.state.lastError ? String(g.state.lastError).slice(0, 160) : null
    if (loafAt < 0) R.issues.push('the animal never sat down in the hot spring')
    if (doneAt < 0) R.issues.push('the hot-spring task never completed')
    if (R.loafAfterLeaving > 0.15) R.issues.push('it was still sitting after walking out: ' + R.loafAfterLeaving)
    if (R.err) R.issues.push('lastError ' + R.err)
    return R
  })
  out.errs = errs.slice(0, 10)
  await page.evaluate(async o => {
    await fetch('/shot?name=pfsoakice.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
