async page => {
  const TAG = 'before'
  const out = { tag: TAG }
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })

  await page.setViewportSize({ width: 1280, height: 720 })
  await page.addInitScript(() => {
    window.__pad = { buttons: new Array(17).fill(0), axes: [0, 0, 0, 0] }
    const mk = () => ({
      index: 0, id: 'p2-fake-pad (STANDARD GAMEPAD)', connected: true,
      mapping: 'standard', timestamp: performance.now(),
      axes: window.__pad.axes.slice(),
      buttons: window.__pad.buttons.map(v => ({ pressed: v > 0.5, touched: v > 0.1, value: v }))
    })
    navigator.getGamepads = () => [mk(), null, null, null]
    window.__tap = async (i, ms) => {
      window.__pad.buttons[i] = 1
      await new Promise(r => setTimeout(r, ms || 130))
      window.__pad.buttons[i] = 0
      await new Promise(r => setTimeout(r, 130))
    }
  })

  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => window.dispatchEvent(new Event('gamepadconnected')))
  await page.waitForTimeout(400)

  // START on the title card
  await page.evaluate(() => window.__tap(9, 160))
  await page.waitForTimeout(4500)
  out.started = await page.evaluate(() => {
    const g = window.__capy
    return { started: g.state.started, biome: g.biome.current, padOn: !!(g.input && g.input.camYaw !== undefined) }
  })

  // to the wharf, then three wheeks on B to raise the departures board
  await page.evaluate(() => {
    const g = window.__capy
    g.capy.body.position.set(-40, g.capy.position.y + 1.0, -20.6)
    g.capy.body.velocity.set(0, 0, 0)
  })
  await page.waitForTimeout(2500)
  for (let i = 0; i < 3; i++) await page.evaluate(() => window.__tap(1, 140))
  await page.waitForTimeout(1500)

  const boardState = () => page.evaluate(() => {
    const jr = document.querySelector('.capyui-jr')
    const pz = document.querySelector('.capyui-pause')
    const g = window.__capy
    return {
      boardShown: !!(jr && jr.classList.contains('show')),
      pauseShown: !!(pz && pz.classList.contains('show')),
      paused: g.state.paused,
      active: document.activeElement ? (document.activeElement.className || document.activeElement.tagName) : null
    }
  })
  out.boardOpen = await boardState()

  // Now try EVERY button and both sticks to get out of it.
  const tried = []
  for (const b of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) {
    await page.evaluate((i) => window.__tap(i, 130), b)
    await page.waitForTimeout(160)
    const s = await boardState()
    tried.push({ btn: b, board: s.boardShown, pause: s.pauseShown, paused: s.paused })
    if (!s.boardShown) break
  }
  out.buttonsTried = tried
  out.afterAllButtons = await boardState()

  // the sticks, in case a direction closes it
  await page.evaluate(async () => {
    for (const ax of [[0, -1], [0, 1], [1, -1], [1, 1], [2, -1], [2, 1], [3, -1], [3, 1]]) {
      window.__pad.axes[ax[0]] = ax[1]
      await new Promise(r => setTimeout(r, 220))
      window.__pad.axes[ax[0]] = 0
      await new Promise(r => setTimeout(r, 120))
    }
  })
  await page.waitForTimeout(400)
  out.afterSticks = await boardState()

  // ---- the pause card, opened by Start, and whether a pad can work it ----
  await page.evaluate(() => {
    const g = window.__capy
    if (g.hud && g.hud.pause) { try { g.hud.pause(false) } catch (e) {} }
  })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => window.__tap(9, 160))
  await page.waitForTimeout(4500)
  await page.evaluate(() => window.__tap(9, 160))
  await page.waitForTimeout(900)

  const cardState = () => page.evaluate(() => {
    const pz = document.querySelector('.capyui-pause')
    const a = document.activeElement
    const rngs = Array.from(document.querySelectorAll('.capyui-pause input[type=range]'))
    return {
      shown: !!(pz && pz.classList.contains('show')),
      active: a ? (a.className || a.tagName) : null,
      activeText: a ? (a.textContent || '').trim().slice(0, 28) : null,
      ranges: rngs.map(r => r.value),
      paused: window.__capy.state.paused
    }
  })
  out.pauseOpen = await cardState()

  // d-pad down x3 — does focus move down the four buttons?
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__tap(13, 140)) ; await page.waitForTimeout(120) }
  out.afterDpadDown = await cardState()
  // A — does it press whatever is focused?
  await page.evaluate(() => window.__tap(0, 140))
  await page.waitForTimeout(700)
  out.afterA = await cardState()
  // d-pad right — does a focused fader move?
  for (let i = 0; i < 4; i++) { await page.evaluate(() => window.__tap(15, 130)); await page.waitForTimeout(110) }
  out.afterDpadRight = await cardState()
  // B — does it close?
  await page.evaluate(() => window.__tap(1, 140))
  await page.waitForTimeout(700)
  out.afterB = await cardState()

  // ---- Tab out of the pause card: does focus leave it? ----
  await page.evaluate(() => {
    const pz = document.querySelector('.capyui-pause')
    if (pz && !pz.classList.contains('show')) window.__capy.hud.pause(true)
  })
  await page.waitForTimeout(600)
  const walk = []
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab')
    await page.waitForTimeout(70)
    const w = await page.evaluate(() => {
      const a = document.activeElement
      const pz = document.querySelector('.capyui-pause')
      return { cls: a ? (a.className || a.tagName) : null,
               inCard: !!(pz && a && pz.contains(a)) }
    })
    walk.push(w)
  }
  out.tabWalk = walk
  out.tabEscaped = walk.filter(w => !w.inCard).length

  out.slideKey = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.capyui-title kbd')).map(k => k.textContent)
    return rows
  })
  out.errs = errs

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p2-pad-' + o.tag + '.json', { method: 'POST', body: s })
  }, out)
}
