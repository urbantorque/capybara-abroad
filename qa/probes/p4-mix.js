async page => {
  const out = {}
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })

  await page.setViewportSize({ width: 1280, height: 720 })
  // Count every AudioContext node creation, which is the only thing about a
  // Web Audio figure observable from outside without hearing it — the idiom
  // R9 used to catch a voice name that never reached sfxTable.
  await page.addInitScript(() => {
    window.__nodes = 0
    const P = ['createOscillator', 'createGain', 'createBiquadFilter', 'createBufferSource',
               'createStereoPanner', 'createConvolver', 'createDynamicsCompressor',
               'createWaveShaper', 'createDelay']
    const wrap = (C) => {
      if (!C || !C.prototype) return
      for (const m of P) {
        const f = C.prototype[m]
        if (typeof f !== 'function') continue
        C.prototype[m] = function () { window.__nodes++; return f.apply(this, arguments) }
      }
    }
    wrap(window.AudioContext); wrap(window.webkitAudioContext)
  })

  await page.goto('http://localhost:5188/')
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit5')            // Cali: a real band, loudest palette
  await page.waitForTimeout(6000)

  // ---- 1. the three stingers each build a real node graph ----
  out.stings = await page.evaluate(async () => {
    const g = window.__capy
    const r = {}
    const kinds = ['record', 'act', 'done', 'keep', 'wear']
    for (const k of kinds) {
      const before = window.__nodes
      const notes = g.hud.stingAudit ? g.hud.stingAudit(k) : -1
      await new Promise(res => setTimeout(res, 420))
      r[k] = { notes: notes, nodes: window.__nodes - before }
    }
    return r
  })

  // ---- 2. the pause card ducks the band ----
  out.duck = await page.evaluate(async () => {
    const g = window.__capy
    const a = g.hud.mixAudit ? g.hud.mixAudit() : null
    g.hud.pause()
    await new Promise(r => setTimeout(r, 900))
    const b = g.hud.mixAudit ? g.hud.mixAudit() : null
    g.hud.pause()
    await new Promise(r => setTimeout(r, 900))
    const c = g.hud.mixAudit ? g.hud.mixAudit() : null
    return { before: a, paused: b, after: c }
  })

  // ---- 3. a dive closes the world down ----
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Equal')             // Palawan
  await page.waitForTimeout(6000)
  out.dive = await page.evaluate(async () => {
    const g = window.__capy
    const dry = g.hud.mixAudit ? g.hud.mixAudit() : null
    // into the sea, and hold the dive key
    const sp = g.palawan && g.palawan.SPAWN ? g.palawan.SPAWN : null
    g.capy.body.position.set(sp ? sp.x : 0, (g.capy.position.y + 1), (sp ? sp.z : 0) - 40)
    await new Promise(r => setTimeout(r, 2500))
    const kd = (c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, key: c, bubbles: true }))
    const ku = (c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, key: c, bubbles: true }))
    kd('KeyE')
    await new Promise(r => setTimeout(r, 3500))
    const wet = g.hud.mixAudit ? g.hud.mixAudit() : null
    const diving = !!g.capy.diving
    ku('KeyE')
    await new Promise(r => setTimeout(r, 2500))
    const back = g.hud.mixAudit ? g.hud.mixAudit() : null
    return { dry: dry, wet: wet, back: back, diving: diving, depth: g.capy.depth }
  })

  // ---- 4. the three interiors ----
  out.rooms = {}
  for (const [name, key, at] of [['venice', 'Digit0', [-4, -66]],
                                 ['monaco', 'Comma', null],
                                 ['cave', 'Period', [0, -130]]]) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(5500)
    out.rooms[name] = await page.evaluate(async (a) => {
      const g = window.__capy
      const before = g.hud.roomAudit ? g.hud.roomAudit() : null
      if (a) {
        g.capy.body.position.set(a[0], g.capy.position.y + 1, a[1])
        await new Promise(r => setTimeout(r, 6000))
      }
      const after = g.hud.roomAudit ? g.hud.roomAudit() : null
      return { before: before, after: after,
               pos: [g.capy.position.x, g.capy.position.z] }
    }, at)
  }

  out.errs = errs
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p4-mix.json', { method: 'POST', body: s })
  }, out)
}
