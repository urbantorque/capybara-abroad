async page => {
  // ---------------------------------------------------------------------------
  // qa/b10-shot.js — LOOK AT THE AIM MARK
  //
  // The ring is drawn geometry on the ground and this repository judges drawn
  // geometry from a rendered PNG. Two frames: a fresh press (the ring is wide
  // and near) and a full charge (the ring is far and its inner disc has closed
  // to a dot). The key is held across both.
  // ---------------------------------------------------------------------------
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(11000)

  const s = await page.evaluate(() => {
    const g = window.__capy
    const cp = g.capy.position
    const pr = g.physics.spawnProp('hat', cp.x + 0.5, cp.z + 0.5, cp.y + 0.4)
    if (!pr) return { err: 'no prop' }
    pr.owner = null
    if (!g.physics.grab(pr)) return { err: 'grab refused' }
    return { vessel: !!g.physics.vesselNear(cp, undefined, pr) }
  })
  await page.waitForTimeout(900)
  await page.keyboard.down('KeyE')
  await page.waitForTimeout(280)
  const a = await page.evaluate(() => {
    const g = window.__capy
    return { charge: +(g.capy.charge || 0).toFixed(2),
             d: g.capy.aim ? +g.capy.aim.d.toFixed(2) : null }
  })
  await page.screenshot({ path: 'qa/B10-aim-low.png' })
  await page.waitForTimeout(1200)
  const b = await page.evaluate(() => {
    const g = window.__capy
    return { charge: +(g.capy.charge || 0).toFixed(2),
             d: g.capy.aim ? +g.capy.aim.d.toFixed(2) : null }
  })
  await page.screenshot({ path: 'qa/B10-aim-full.png' })
  await page.keyboard.up('KeyE')
  await page.waitForTimeout(700)
  const gone = await page.evaluate(() => !window.__capy.capy.aim)
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=b10-shot.json', { method: 'POST', body: s })
  }, { setup: s, low: a, full: b, markGoneAfterThrow: gone, errs: errs })
}
