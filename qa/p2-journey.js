async page => {
  const out = { steps: [] }
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })

  await page.setViewportSize({ width: 1280, height: 720 })
  await page.addInitScript(() => {
    try { localStorage.clear() } catch (e) {}
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
      await new Promise(r => setTimeout(r, 150))
    }
    window.__hold = async (i, ms) => {
      window.__pad.buttons[i] = 1
      await new Promise(r => setTimeout(r, ms))
      window.__pad.buttons[i] = 0
      await new Promise(r => setTimeout(r, 200))
    }
  })

  const snap = (label) => page.evaluate((l) => {
    const g = window.__capy
    const q = s => document.querySelector(s)
    const shown = s => { const e = q(s); return !!(e && e.classList.contains('show')) }
    const a = document.activeElement
    const rngs = Array.from(document.querySelectorAll('.capyui-pause input[type=range]'))
    return {
      step: l,
      title: !!(q('.capyui-title') && !q('.capyui-title').classList.contains('gone')),
      started: g.state.started,
      biome: g.biome ? g.biome.current : null,
      paused: g.state.paused,
      board: shown('.capyui-jr'),
      pause: shown('.capyui-pause'),
      ledger: shown('.capyui-led'),
      album: shown('.capyui-alb'),
      askOpen: !!(q('.capyui-pauseask') && !q('.capyui-pauseask').hidden),
      focus: a ? (a.className || a.tagName) : null,
      focusText: a ? (a.textContent || '').trim().slice(0, 30) : null,
      faders: rngs.map(r => r.value),
      inCard: (() => {
        const cards = ['.capyui-alb', '.capyui-led', '.capyui-pause', '.capyui-jr']
        for (const c of cards) { const e = q(c); if (e && e.classList.contains('show') && a && e.contains(a)) return c }
        return null
      })()
    }
  }, label)

  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  out.steps.push(await snap('loaded'))

  // 1. START starts the game
  await page.evaluate(() => window.__tap(9, 160))
  await page.waitForTimeout(4500)
  out.steps.push(await snap('after START on title'))

  // 2. to the wharf, three wheeks on B -> the departures board
  await page.evaluate(() => {
    const g = window.__capy
    g.capy.body.position.set(-40, g.capy.position.y + 1.0, -20.6)
    g.capy.body.velocity.set(0, 0, 0)
  })
  await page.waitForTimeout(2600)
  for (let i = 0; i < 3; i++) await page.evaluate(() => window.__tap(1, 140))
  await page.waitForTimeout(1400)
  out.steps.push(await snap('board open (3 wheeks)'))

  // 3. d-pad down walks the rows
  const rowWalk = []
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.__tap(13, 140))
    await page.waitForTimeout(160)
    rowWalk.push(await page.evaluate(() => {
      const a = document.activeElement
      const jr = document.querySelector('.capyui-jr')
      return { cls: a ? (a.className || a.tagName) : null,
               txt: a ? (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 34) : null,
               inCard: !!(jr && a && jr.contains(a)) }
    }))
  }
  out.boardRowWalk = rowWalk

  // 4. B closes the board without travelling
  await page.evaluate(() => window.__tap(1, 140))
  await page.waitForTimeout(800)
  out.steps.push(await snap('board closed with B'))

  // 5. START opens the pause card
  await page.evaluate(() => window.__tap(9, 160))
  await page.waitForTimeout(900)
  out.steps.push(await snap('pause card open'))

  // 6. walk to settings and press A
  await page.evaluate(() => window.__tap(13, 140))
  await page.waitForTimeout(200)
  await page.evaluate(() => window.__tap(0, 140))
  await page.waitForTimeout(800)
  out.steps.push(await snap('settings opened with A'))

  // 7. walk onto a fader and move it left
  const before = await page.evaluate(() => Array.from(document.querySelectorAll('.capyui-pause input[type=range]')).map(r => r.value))
  let guard = 0
  while (guard++ < 12) {
    const onRange = await page.evaluate(() => {
      const a = document.activeElement
      return !!(a && a.tagName === 'INPUT' && a.type === 'range')
    })
    if (onRange) break
    await page.evaluate(() => window.__tap(13, 130))
    await page.waitForTimeout(150)
  }
  out.reachedFaderAfter = guard
  for (let i = 0; i < 5; i++) { await page.evaluate(() => window.__tap(14, 130)); await page.waitForTimeout(130) }
  const after = await page.evaluate(() => Array.from(document.querySelectorAll('.capyui-pause input[type=range]')).map(r => r.value))
  out.faderBefore = before
  out.faderAfter = after
  out.faderMoved = JSON.stringify(before) !== JSON.stringify(after)
  out.busGain = await page.evaluate(() => (window.__capy.hud.audioBuses ? window.__capy.hud.audioBuses() : null))
  out.steps.push(await snap('fader moved with d-pad'))

  // 8. B backs out of settings, B again closes the card
  await page.evaluate(() => window.__tap(1, 140))
  await page.waitForTimeout(700)
  out.steps.push(await snap('B once'))
  await page.evaluate(() => window.__tap(1, 140))
  await page.waitForTimeout(700)
  out.steps.push(await snap('B twice'))

  // 9. reopen, reach quit-to-title, A, then confirm with A
  await page.evaluate(() => window.__tap(9, 160))
  await page.waitForTimeout(900)
  let g2 = 0
  while (g2++ < 14) {
    const t = await page.evaluate(() => {
      const a = document.activeElement
      return a ? (a.textContent || '').trim() : ''
    })
    if (t === 'quit to the title') break
    await page.evaluate(() => window.__tap(13, 130))
    await page.waitForTimeout(150)
  }
  out.reachedQuitAfter = g2
  await page.evaluate(() => window.__tap(0, 140))
  await page.waitForTimeout(700)
  out.steps.push(await snap('quit pressed — confirm shown'))
  // the confirm focuses STAY; walk to the other one and press it
  let g3 = 0
  while (g3++ < 6) {
    const t = await page.evaluate(() => { const a = document.activeElement; return a ? (a.textContent || '').trim() : '' })
    if (t && t !== 'stay here') break
    await page.evaluate(() => window.__tap(13, 130))
    await page.waitForTimeout(150)
  }
  out.quitBtnText = await page.evaluate(() => { const a = document.activeElement; return a ? (a.textContent || '').trim() : '' })

  // 10. the stuck-rescue: hold BACK
  out.padStuck = await page.evaluate(async () => {
    const g = window.__capy
    const p0 = [g.capy.position.x, g.capy.position.z]
    return { before: p0 }
  })

  out.errs = errs
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p2-journey.json', { method: 'POST', body: s })
  }, out)
}
