async page => {
  // T3c, noTravArc: the traveller's cameo at each memory beat, real clock.
  // A fresh story file; the Sydney memory (steal-hat, opera-stage) and then the
  // Quay memory (ferry-salute, under-bridge), which also turns the fold. The
  // ticks go through game.completeTask, the door a real tick uses (as T2a's
  // own instrument does): this proves the answer to the bus, not the concert.
  // Rung pinned at 0 (the cameo parks at 1). Checks: placed or turned, 20-30 m,
  // facing the animal, gone after the hold, leaving on the act turn.
  const NAME = 'ten-t3c-cameo'
  const PORT = 5193
  const out = {}
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:' + PORT + '/'); await page.waitForTimeout(7000)
  await page.evaluate(() => [...document.querySelectorAll('.capyui-go')].find(b => !b.classList.contains('alt')).click())
  await page.waitForTimeout(9000)
  await page.evaluate(() => {
    const g = window.__capy
    window.__t3c = { mems: [], acts: [], pin: setInterval(() => { g.state.perfRung = 0 }, 50), samples: [] }
    g.state.perfRung = 0
    g.events.on('story:memory', e => window.__t3c.mems.push(e))
    g.events.on('story:act', e => window.__t3c.acts.push(e))
  })
  const sample = async tag => {
    const s = await page.evaluate(t => Object.assign({ tag: t, time: +window.__capy.state.time.toFixed(1) }, window.__capy.cameoAudit()), tag)
    out[tag] = s
    return s
  }
  // ---- Sydney -------------------------------------------------------------
  out.mode = await page.evaluate(() => window.__capy.state.journeyMode)
  await page.evaluate(() => window.__capy.completeTask('steal-hat'))
  await page.waitForTimeout(3500)
  await page.evaluate(() => window.__capy.completeTask('opera-stage'))
  await page.waitForFunction(() => window.__t3c.mems.length > 0, null, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1800)
  await sample('syd-memory')
  await page.screenshot({ path: 'qa/' + NAME + '-sydney.png' })
  await page.waitForTimeout(5000)
  await sample('syd-clear')
  await page.screenshot({ path: 'qa/' + NAME + '-sydney-clear.png' })
  await page.waitForTimeout(9000)
  await sample('syd-after')
  // ---- the Quay: a memory and the act turn ----------------------------------
  await page.evaluate(() => window.__capy.hud.cross('quay'))
  await page.waitForFunction(() => window.__capy.biome.current === 'quay', null, { timeout: 60000 })
  await page.waitForTimeout(9000)
  await page.evaluate(() => window.__capy.completeTask('ferry-salute'))
  await page.waitForTimeout(2500)
  await page.evaluate(() => window.__capy.completeTask('under-bridge'))
  await page.waitForFunction(() => window.__t3c.mems.length > 1, null, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1800)
  await sample('quay-memory')
  await page.screenshot({ path: 'qa/' + NAME + '-quay.png' })
  await page.waitForFunction(() => window.__t3c.acts.length > 0, null, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(600)
  await sample('quay-act')
  await page.waitForTimeout(5000)
  await sample('quay-after')
  out.mems = await page.evaluate(() => window.__t3c.mems)
  out.acts = await page.evaluate(() => window.__t3c.acts.map(a => ({ act: a.act, chapter: a.chapter })))
  out.rung = await page.evaluate(() => window.__capy.state.perfRung)
  out.err = await page.evaluate(() => { clearInterval(window.__t3c.pin); return window.__capy.state.lastError || null })
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME, out })
}
