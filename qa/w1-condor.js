async page => {
  // w1-condor: the ride ticks after twelve seconds in the talons, not on the
  // grab. Whistle, whistle again, grab when in reach, and read the signpost.
  await page.setViewportSize({ width: 1400, height: 800 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(4500)
  await page.keyboard.press('Digit1'); await page.waitForTimeout(5000)
  await page.evaluate(() => window.__capy.biome.switchTo('pasto')); await page.waitForTimeout(3000)
  const out = { log: [] }
  const card = () => page.evaluate(() => {
    const q = s => { const e = document.querySelector(s); return e ? e.textContent : null }
    const g = window.__capy
    return { t: +g.state.time.toFixed(1), state: g.condor.state, mounted: g.condor.mounted, reach: g.condor.talonInReach(),
             head: q('.capyui-marqhead'), live: q('.capyui-marqlive'), done: g.taskDone('condor-ride'),
             y: +g.capy.position.y.toFixed(1), err: g.state.lastError || null }
  })
  const hold = async (code, ms) => { await page.keyboard.down(code); await page.waitForTimeout(ms); await page.keyboard.up(code) }
  await hold('KeyQ', 160); await page.waitForTimeout(5500)
  out.log.push(await card())
  await hold('KeyQ', 160); await page.waitForTimeout(1000)
  let grabbed = false
  for (let i = 0; i < 60 && !grabbed; i++) {
    const c = await card()
    if (c.reach) { await hold('KeyE', 700); await page.waitForTimeout(300); const c2 = await card(); out.log.push(c2); grabbed = c2.mounted }
    else await page.waitForTimeout(500)
    if (i % 10 === 0) out.log.push(c)
  }
  out.grabbed = grabbed
  for (let i = 0; i < 16 && grabbed; i++) {
    await page.waitForTimeout(1000)
    const c = await card(); out.log.push(c)
    if (i === 6) await page.screenshot({ path: 'qa/w1-condor-live.png' })
    if (c.done && !out.doneAt) { out.doneAt = c.t; await page.waitForTimeout(600); await page.screenshot({ path: 'qa/w1-condor-banner.png' }) }
  }
  out.final = await card()
  await page.evaluate(async (o) => {
    await fetch('/shot?name=w1condor.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
