async page => {
  // D4: DOES THE GAME ANSWER ITS OWN BIGGEST MOMENTS?
  //
  // Four questions, each one number:
  //
  //   THE FREEZE. `game.time.slow` sampled at 120 Hz through a marquee and a
  //   chapter close. A sub-1.0 sample must exist in both; before this batch
  //   neither had one, because sysPUNCH_MIN is a FRACTION of sysSHAKE_MAX and
  //   the two ceremonial callers pass 0.14 and 0.18 against a floor of 0.187.
  //
  //   DISTANCE. A synthetic `prop:impact` at 5, 20 and 45 m from the animal,
  //   reading `shakeNow()` after each. Monotonic, and zero at the far one.
  //   Emitting the event rather than dropping a real crate is deliberate: the
  //   thing under test is the handler, and a real crate lands where physics
  //   puts it rather than where the probe asked.
  //
  //   THE LANDING DIP. `camDip()` at 120 Hz through a fall, and `camInfo.pitch`
  //   with it.
  //
  //   THE CEREMONY. `camInfo.dist` through a chapter close, and how many people
  //   are holding a look at the animal while the card is up.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1100, height: 660 })
  const out = { errs: [] }
  async function fresh(key) {
    await page.goto('http://localhost:5188/')
    await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key || 'Digit1')
    await page.waitForTimeout(9000)
  }

  // ---- 1. the distance term ----------------------------------------------
  await fresh('Digit1')
  out.distance = await page.evaluate(async () => {
    const g = window.__capy
    const cp = g.capy.position
    const rows = []
    for (const d of [5, 12, 20, 30, 45]) {
      // let whatever is live decay first, so each reading is its own
      await new Promise(r => setTimeout(r, 1400))
      const before = g.shakeNow()
      g.events.emit('prop:impact', { speed: 9, position: { x: cp.x + d, y: cp.y, z: cp.z } })
      await new Promise(r => setTimeout(r, 40))
      rows.push({ m: d, before: Math.round(before * 1000) / 1000,
                  shake: Math.round(g.shakeNow() * 1000) / 1000 })
    }
    return rows
  })

  // ---- 2. the landing dip -------------------------------------------------
  await fresh('Digit1')
  out.hop = await page.evaluate(async () => {
    const g = window.__capy
    const s = []
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }))
    await new Promise(r => setTimeout(r, 40))
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }))
    for (let i = 0; i < 120; i++) {
      s.push([Math.round(g.camDip() * 1000) / 1000, Math.round(g.camInfo.pitch * 10000) / 10000])
      await new Promise(r => setTimeout(r, 8))
    }
    return { peakDip: Math.min.apply(null, s.map(x => x[0])),
             pitchRange: Math.round((Math.max.apply(null, s.map(x => x[1])) -
                                     Math.min.apply(null, s.map(x => x[1]))) * 10000) / 10000 }
  })
  // ...and a real fall, off the top of something. The Drift is the only chapter
  // where a long drop is one key away; here the animal is simply dropped by
  // asking the world for one — an emitted capy:land with a known descent speed,
  // which is the same shape the fall itself sends and is the only way to sample
  // a fixed height without a chapter that has one.
  out.fall = await page.evaluate(async () => {
    const g = window.__capy
    const rows = []
    for (const v of [4.0, 6.0, 8.0, 10.8, 16.0]) {
      await new Promise(r => setTimeout(r, 900))
      g.events.emit('capy:land', { position: g.capy.position, fall: v, dust: false })
      let peak = 0, back = -1
      for (let i = 0; i < 90; i++) {
        const d = g.camDip()
        if (d < peak) peak = d
        if (peak < -0.01 && back < 0 && d > peak * 0.1) back = i * 8
        await new Promise(r => setTimeout(r, 8))
      }
      rows.push({ vDown: v, peakDrop: Math.round(peak * 1000) / 1000,
                  degrees: Math.round(Math.atan2(-peak, 9.5) * 1800 / Math.PI) / 10,
                  settledMs: back })
    }
    return rows
  })

  // ---- 3. the freeze, on a marquee and on a chapter close ------------------
  // Both are driven through the game's own paths: a task tick for the marquee,
  // and completing every remaining task in a chapter for the close.
  await fresh('Digit1')
  out.freeze = await page.evaluate(async () => {
    const g = window.__capy
    // Complete chapter one a task at a time with a gap after each, sampling
    // `time.slow` throughout. Any sub-1.0 sample is a freeze, and which event
    // it belongs to comes out of WHICH CARD is up when it happens — the place
    // card is the marquee's, the done card is the ceremony's. Attributing that
    // way is what keeps this one run instead of twenty, and the gap after each
    // tick is ten times the longest freeze in the file.
    const ids = g.hud.taskIds(1)
    const rows = []
    for (let i = 0; i < ids.length; i++) {
      const seen = []
      g.completeTask(ids[i])
      for (let k = 0; k < 200; k++) {
        // timeScale, NOT time.slow. `slow` is the SLOW-MOTION component only —
        // the lens leans in on it and a hitstop must NOT narrow the lens, so
        // the freeze this batch adds does not appear in it at all. The first
        // run of this probe read the marquee's existing slow motion, reported
        // min 0.55, and would have called a missing feature present.
        seen.push(g.state.timeScale)
        await new Promise(r => setTimeout(r, 8))
      }
      rows.push({ id: ids[i], min: Math.round(Math.min.apply(null, seen) * 1000) / 1000,
                  below1: seen.filter(v => v < 0.999).length,
                  place: !!document.querySelector('.capyui-place'),
                  done: !!document.querySelector('.capyui-done'),
                  dist: Math.round(g.camInfo.dist * 10) / 10,
                  look: g.state.doneLook || 0 })
    }
    return { rows: rows, doneLook: g.state.doneLook,
             dist: Math.round(g.camInfo.dist * 10) / 10,
             framing: typeof g.framing === 'function' ? +g.framing().toFixed(2) : null }
  })

  out.errs = errs
  await page.evaluate((o) => fetch('/shot?name=d4-payoff.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
