async page => {
  // THE NINETEEN HUNG THINGS: a photograph of each, and how far it actually
  // swung while it was being photographed.
  //
  // The camera trick is D6b's and it is here for the same reason: a board
  // photographed along board->animal is ALWAYS edge on, because the board
  // stands at right angles to that line by construction. The animal is put at
  // board + facing * 4.2 and the shot is taken along the board's own normal.
  //
  // `amax` is the largest total swing seen over an eight-second sample. It is
  // the number that separates the three states a still photograph cannot tell
  // apart: hanging dead still because there is no air (correct, in a cave),
  // hanging dead still because it was never registered, and hanging dead still
  // because it is beyond physHANG_FAR and was parked.
  const KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7',
                'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'BracketLeft',
                'BracketRight', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash']
  const out = { rows: [] }
  await page.setViewportSize({ width: 1280, height: 760 })
  for (let i = 0; i < KEYS.length; i++) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(KEYS[i])
    await page.waitForTimeout(8000)
    // Stand the animal in front of its own exit board so the thing is in shot
    // and, more to the point, so it is inside physHANG_FAR and integrating.
    const r = await page.evaluate(() => {
      const g = window.__capy
      const b = g.exitBoard()
      if (!b) return { biome: g.biome.current, board: false }
      const s = Math.sin(b.yaw), c = Math.cos(b.yaw)
      g.capy.body.position.set(b.x + s * 4.2, b.y + 0.6, b.z + c * 4.2)
      g.capy.body.velocity.set(0, 0, 0)
      return { biome: g.biome.current, board: true, yaw: +b.yaw.toFixed(3) }
    })
    await page.waitForTimeout(2200)
    // Eight seconds of watching it, sampled at 10 Hz for the peak.
    const amax = await page.evaluate(() => new Promise(res => {
      const g = window.__capy
      let m = 0, n = 0
      const t = setInterval(() => {
        const h = g.hangAudit()
        const row = h.rows[0]
        if (row && row.a > m) m = row.a
        if (++n > 80) { clearInterval(t); res({ amax: +m.toFixed(4), air: h.air,
                                                asleep: row ? row.asleep : null,
                                                here: h.here }) }
      }, 100)
    }))
    Object.assign(r, amax)
    await page.evaluate(() => {
      const g = window.__capy
      const b = g.exitBoard()
      if (b) g.frameShot({ yaw: b.yaw, dist: 6.4, pitch: 0.10, raise: 1.5, hold: 3.2 })
    })
    await page.waitForTimeout(1600)
    // page.screenshot, NOT canvas.toDataURL: harness trap 12. The canvas has
    // no preserveDrawingBuffer, so toDataURL comes back blank white — six
    // different chapters wrote six byte-identical 21 956-byte PNGs of nothing.
    await page.screenshot({ path: 'qa/' + 'd7h-' + (i + 1) + '-' + r.biome + '.png' })
    // ...and then shout at it. physHangWheek is the one channel that reaches a
    // hung thing in every chapter including the four with no air in them, and
    // it is invisible in a photograph: `wmax` is the peak swing in the two
    // seconds after one wheek, from a standing start.
    await page.evaluate(() => { const g = window.__capy; g.hangAudit(); })
    await page.keyboard.press('KeyQ')
    const w = await page.evaluate(() => new Promise(res => {
      const g = window.__capy
      let m = 0, n = 0
      const t = setInterval(() => {
        const row = g.hangAudit().rows[0]
        if (row && row.a > m) m = row.a
        if (++n > 24) { clearInterval(t); res(+m.toFixed(4)) }
      }, 90)
    }))
    r.wmax = w
    r.err = await page.evaluate(() => window.__capy.state.lastError || '')
    out.rows.push(r)
  }
  await page.evaluate(o => fetch('/shot?name=d7-hang.json',
      { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
