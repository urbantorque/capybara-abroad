async page => {
  // L5 M1 — THE CONCERT: every note calls wider (the house count after each
  // of three notes), the house answers (cheerT on people in place a beat
  // after a note), the tick, then the encore: slow-mo, the shells over the
  // harbour (sparksLive), the sails held (stageGlow), the opera shot
  // (camInfo.shot). Fresh file in Sydney, Begin, the animal put on the
  // podium. qa/l5-concert.json; frame qa/l5-concert-encore.png.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  const begin = await page.$('text=Begin')
  if (begin) await begin.click(); else await page.mouse.click(430, 350)
  await page.waitForTimeout(6000)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started) }
  const tp = () => page.evaluate(() => {
    const g = window.__capy, b = g.capy.body
    b.position.set(0, 1.6, 2.5); b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    if (g.capy.position) g.capy.position.set(0, 1.6, 2.5)
  })
  const audit = () => page.evaluate(() => {
    const g = window.__capy, e = g.env
    const c = e.concertAudit(), en = e.encoreAudit()
    let cheering = 0
    try { const h = g.hud.npcAudit ? g.hud.npcAudit() : null; cheering = h && h.cheering !== undefined ? h.cheering : -1 } catch (x) { cheering = -1 }
    return { on: c.on, notes: c.notes, house: c.house, done: c.done, coming: g.concert.house(true), encore: en,
             ts: +(g.state.timeScale || 1).toFixed(2), sparks: g.sparksLive(), glow: +e.stageGlow().toFixed(2), shot: +g.camInfo.shot.toFixed(2),
             live: (document.querySelector('.capyui-marq .capyui-marqlive') || {}).textContent || '' }
  })
  await tp()
  await page.waitForTimeout(800)
  out.notes = []
  for (let n = 1; n <= 3; n++) {
    await page.evaluate(() => window.__capy.env.stageNote())
    await page.waitForTimeout(700)
    out.notes.push(await audit())
    await tp()
    await page.waitForTimeout(6000)
  }
  out.afterThree = await audit()
  out.taskDone = await page.evaluate(() => window.__capy.taskDone('opera-stage'))
  // the encore: one more note inside the window
  await page.evaluate(() => window.__capy.env.stageNote())
  await page.waitForTimeout(400)
  out.encore1 = await audit()
  await page.waitForTimeout(1300)
  out.encore2 = await audit()
  await page.screenshot({ path: 'qa/l5-concert-encore.png', timeout: 90000 })
  await page.waitForTimeout(2500)
  out.encore3 = await audit()
  out.record = await page.evaluate(() => window.__capy.hud.recordAudit().best['opera-stage'])
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=l5-concert.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
  return out
}
