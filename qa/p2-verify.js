async page => {
  const out = {}
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
      await new Promise(r => setTimeout(r, 250))
    }
  })

  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => window.__tap(9, 160))
  await page.waitForTimeout(4500)

  // ---- 1. the pad TRAVELS from the departures board ----
  await page.evaluate(() => {
    const g = window.__capy
    g.capy.body.position.set(-40, g.capy.position.y + 1.0, -20.6)
    g.capy.body.velocity.set(0, 0, 0)
  })
  await page.waitForTimeout(2600)
  for (let i = 0; i < 3; i++) await page.evaluate(() => window.__tap(1, 140))
  await page.waitForTimeout(1400)
  // walk down to Pasto's row and press A
  // The focused element must BE a destination row. Matching the text alone
  // matched on the first press, because the card itself takes focus when the
  // board opens and its textContent contains every chapter name in the game.
  let g1 = 0, rowTxt = ''
  while (g1++ < 10) {
    const st = await page.evaluate(() => {
      const a = document.activeElement
      return { cls: a ? (a.className || '') : '',
               txt: a ? (a.textContent || '').trim().replace(/\s+/g, ' ') : '' }
    })
    rowTxt = st.txt
    if (/jrrow/.test(st.cls) && /Pasto/.test(st.txt)) break
    await page.evaluate(() => window.__tap(13, 140))
    await page.waitForTimeout(170)
  }
  out.foundPastoRowAfter = g1
  out.pastoRowText = rowTxt.slice(0, 46)
  await page.evaluate(() => window.__tap(0, 150))
  await page.waitForTimeout(7000)
  out.travelled = await page.evaluate(() => {
    const g = window.__capy
    const jr = document.querySelector('.capyui-jr')
    return { biome: g.biome.current, board: !!(jr && jr.classList.contains('show')), paused: g.state.paused }
  })

  // Everything below needs the world RUNNING: the rescue is gated on no board
  // being up, and a paused game writes no timeScale at all.
  await page.evaluate(() => {
    const g = window.__capy
    for (let i = 0; i < 4; i++) { try { document.dispatchEvent(new Event('x')) } catch (e) {} }
  })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(800)
  out.clearedCards = await page.evaluate(() => {
    const s = c => { const e = document.querySelector(c); return !!(e && e.classList.contains('show')) }
    return { board: s('.capyui-jr'), pause: s('.capyui-pause'), paused: window.__capy.state.paused }
  })

  // ---- 2. the pad stuck-rescue: hold BACK ----
  // WALK FIRST. The rescue returns the animal to the OLDEST of three crumbs,
  // and a crumb is only dropped above sysBACK_SPEED — so a capybara that has
  // just arrived and not moved has nowhere to be put back to, and the rescue
  // correctly does nothing. See backCrumb.
  await page.evaluate(async () => {
    window.__pad.axes[1] = -1
    await new Promise(r => setTimeout(r, 5200))
    window.__pad.axes[1] = 0
    await new Promise(r => setTimeout(r, 600))
  })
  const p0 = await page.evaluate(() => {
    const g = window.__capy
    return [g.capy.position.x, g.capy.position.y, g.capy.position.z]
  })
  await page.evaluate(() => window.__hold(8, 2200))
  await page.waitForTimeout(900)
  const p1 = await page.evaluate(() => {
    const g = window.__capy
    return [g.capy.position.x, g.capy.position.y, g.capy.position.z]
  })
  out.stuck = { before: p0, after: p1,
                moved: Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) }
  // ...and a TAP of BACK still just hides the paper
  const bare0 = await page.evaluate(() => document.getElementById('hud').classList.contains('bare'))
  await page.evaluate(() => window.__tap(8, 120))
  await page.waitForTimeout(400)
  const bare1 = await page.evaluate(() => document.getElementById('hud').classList.contains('bare'))
  out.backTap = { before: bare0, after: bare1, toggled: bare0 !== bare1 }

  // ---- 3. the slide is G, and Ctrl is not a slide any more ----
  out.slide = await page.evaluate(async () => {
    const g = window.__capy
    const kd = (c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, key: c, bubbles: true }))
    const ku = (c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, key: c, bubbles: true }))
    kd('KeyG'); await new Promise(r => setTimeout(r, 260))
    const withG = g.input.slide
    ku('KeyG'); await new Promise(r => setTimeout(r, 200))
    kd('ControlLeft'); await new Promise(r => setTimeout(r, 260))
    const withCtrl = g.input.slide
    ku('ControlLeft'); await new Promise(r => setTimeout(r, 150))
    return { withG: withG, withCtrl: withCtrl }
  })
  out.legend = await page.evaluate(() => {
    const g = window.__capy
    const kbds = Array.from(document.querySelectorAll('.capyui-jrkeys kbd, .capyui-title kbd')).map(k => k.textContent)
    return kbds.filter(t => /G|Ctrl/.test(t))
  })

  // ---- 4. the pad vocabulary reaches the clues ----
  out.words = await page.evaluate(() => {
    const g = window.__capy
    const el = document.querySelector('.capyui-clue')
    const rows = Array.from(document.querySelectorAll('.capyui-todo li')).map(li => li.textContent.trim().replace(/\s+/g, ' '))
    return { clue: el ? el.textContent : null, rows: rows.slice(0, 6) }
  })

  // ---- 5. Tab stays inside the pause card ----
  // Opened with the KEY, not the pad: the pad's Start closes whatever is up,
  // and the previous section may have left something open.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(700)
  out.pauseUpForTab = await page.evaluate(() => {
    const e = document.querySelector('.capyui-pause')
    return !!(e && e.classList.contains('show'))
  })
  const walk = []
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    await page.waitForTimeout(70)
    walk.push(await page.evaluate(() => {
      const a = document.activeElement
      const pz = document.querySelector('.capyui-pause')
      return { txt: a ? (a.textContent || a.className || '').trim().slice(0, 22) : null,
               inCard: !!(pz && a && pz.contains(a)) }
    }))
  }
  out.tabWalk = walk
  out.tabEscaped = walk.filter(w => !w.inCard).length

  // ---- 6. calm reaches the freeze ----
  // The switch is the pause card's own checkbox — it is the only writer, and
  // driving it is what proves the wire runs from the control to the freeze.
  out.calm = await page.evaluate(async () => {
    const g = window.__capy
    const box = document.querySelector('.capyui-pause input[type=checkbox]')
    if (!box) return { noBox: true }
    // THE FREEZE CANNOT BE READ WHILE THE CARD IS OPEN, because the card
    // pauses the world and a paused world runs no time step at all — the first
    // cut of this measurement read `scale` 120 ms into a 350 ms hitstop with
    // the settings still up and got 1.0 both ways, which reads exactly like a
    // freeze that never fires. Set the switch, CLOSE the card, then measure.
    const setAndClose = async (v) => {
      if (!document.querySelector('.capyui-pause').classList.contains('show')) g.hud.pause()
      await new Promise(r => setTimeout(r, 300))
      const b = document.querySelector('.capyui-pause input[type=checkbox]')
      if (b.checked !== v) b.click()
      await new Promise(r => setTimeout(r, 250))
      g.hud.pause()
      await new Promise(r => setTimeout(r, 450))
    }
    const probe = async () => {
      g.time.hitstop(0.35, 0.08)
      await new Promise(r => setTimeout(r, 120))
      const s = g.time.scale
      await new Promise(r => setTimeout(r, 500))
      return s
    }
    await setAndClose(false)
    const flagOff = g.time.calm
    const loud = await probe()
    await setAndClose(true)
    const flagOn = g.time.calm
    const quiet = await probe()
    await setAndClose(false)
    return { withoutCalm: loud, withCalm: quiet, flagOff: flagOff, flagOn: flagOn }
  })

  out.errs = errs
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p2-verify.json', { method: 'POST', body: s })
  }, out)
}
