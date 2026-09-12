async page => {
  // L5 M1 — THE PHO RUN: the cold ends a run, the stall starts another, the
  // three drops (the Cub moved to each ring, stopped), the third drop's
  // moment (timeScale < 1, sparks alive), and a second run after the tick.
  // qa/l5-pho.json; frame qa/l5-pho-drop3.png.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  const begin = await page.$('text=Begin')
  if (begin) await begin.click(); else await page.mouse.click(430, 350)
  await page.waitForTimeout(6000)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started) }
  await page.evaluate(() => { window.__capy.hud.cross('hanoi') })
  await page.waitForTimeout(9000)
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  const cub = () => page.evaluate(() => window.__capy.hanoi.cub())
  // stand by the Cub and take it
  await page.evaluate(() => {
    const g = window.__capy, b = g.capy.body, at = g.hanoi.cubAt()
    b.position.set(at.x + 1.2, at.y + 0.9, at.z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    g.hanoi.cubDebug({ take: true })
  })
  await page.waitForTimeout(800)
  out.taken = await cub()
  // the cold: wind the clock past 150 s
  await page.evaluate(() => window.__capy.hanoi.cubSet({ t: 151 }))
  await page.waitForTimeout(600)
  out.cold = await cub()
  // E at the stall: another run
  await page.keyboard.press('KeyE')
  await page.waitForTimeout(700)
  out.again = await cub()
  // the three drops: move the Cub into each ring, stopped
  const drops = [[60, 22.5], [-52, 83.5], [40, -24.5]]
  out.drops = []
  for (let i = 0; i < 3; i++) {
    await page.evaluate(d => window.__capy.hanoi.cubDebug({ x: d[0] + 1, z: d[1] + 1 }), drops[i])
    await page.waitForTimeout(i === 2 ? 350 : 900)
    if (i === 2) {
      out.moment = await page.evaluate(() => ({ ts: +(window.__capy.state.timeScale || 1).toFixed(2), sparks: window.__capy.sparksLive() }))
      await page.screenshot({ path: 'qa/l5-pho-drop3.png', timeout: 90000 })
      await page.waitForTimeout(1200)
      out.moment2 = await page.evaluate(() => ({ ts: +(window.__capy.state.timeScale || 1).toFixed(2), sparks: window.__capy.sparksLive() }))
    }
    out.drops.push(await cub())
  }
  out.record = await page.evaluate(() => { const a = window.__capy.hud.recordAudit(); return a.best['pho-run'] })
  out.taskDone = await page.evaluate(() => window.__capy.taskDone('pho-run'))
  // a second run: back to the stall, E
  await page.evaluate(() => { window.__capy.hanoi.cubDebug({ x: 6, z: 15.5 }) })
  await page.waitForTimeout(600)
  await page.keyboard.press('KeyE')
  await page.waitForTimeout(700)
  out.second = await cub()
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=l5-pho.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
  return out
}
