async page => {
  // WALKING THROUGH ONE — the third of the three pushes, and the only one a
  // probe cannot fake: `hang` reads the animal's own velocity, and writing
  // capy.body.velocity is deleted by capybara.js (EXTERNAL FORCES).
  //
  // AIM WITH THE CAMERA, NOT WITH A CLOSED LOOP. Movement is camera-relative,
  // so the honest way to walk an animal at a target is to put it on the line
  // the camera is already looking down and hold W — a four-key closed loop
  // oscillates (measured: it left the animal 19.7 m away in Cappadocia after
  // five seconds of steering) and `input.camYaw` is an output that cannot be
  // written. So: read camYaw, place the animal 3.4 m back along it, hold W.
  //
  // Three of the five walk-through chapters. Not Hanoi: its exit board stands
  // on the Long Biên bridge and the first attempt at this spent fourteen
  // seconds pressed against a steel truss four metres short of the thing. A
  // walk finds routes; a teleport does not.
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  const out = { rows: [] }
  for (const [key, tag] of [['BracketLeft', 'goreme'], ['Digit5', 'cali'], ['Digit2', 'pasto']]) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(9000)
    // TWO teleports, and the second one is the whole trick. camYaw is a damped
    // OUTPUT: read it, teleport, wait for the animal to settle, and by the time
    // W is pressed the rig has swung somewhere else and the animal walks off at
    // a tangent — measured, it never got closer than the 3.4 m it started at in
    // two of three chapters. So: drop it near the board, let everything settle,
    // and only THEN read the yaw and put it on that line.
    await page.evaluate(() => {
      const g = window.__capy
      const h = g.hangAudit().rows[0]
      const b = g.exitBoard()
      if (h && b) {
        g.capy.body.position.set(h.x, b.y + 0.7, h.z + 4)
        g.capy.body.velocity.set(0, 0, 0)
      }
    })
    await page.waitForTimeout(2600)
    const start = await page.evaluate(() => {
      const g = window.__capy
      const h = g.hangAudit().rows[0]
      const b = g.exitBoard()
      if (!h || !b) return null
      const yaw = g.input.camYaw || 0
      // PLUS, not minus. `camYaw` is the bearing from the animal TO the camera
      // — the same convention frameShot uses — so W walks the animal AWAY from
      // (sin, cos) and the target has to be on that side. Written the other way
      // round the animal sprinted in exactly the wrong direction and the probe
      // reported a contact channel that does nothing: goreme 3.4 m -> 13.1 m.
      g.capy.body.position.set(h.x + Math.sin(yaw) * 3.4, h.y - h.len + 0.6,
                               h.z + Math.cos(yaw) * 3.4)
      g.capy.body.velocity.set(0, 0, 0)
      return { a: h.a, len: h.len, hangY: h.y, boardY: +b.y.toFixed(2),
               bottom: +(h.y - h.len).toFixed(2), yaw: +yaw.toFixed(2) }
    })
    await page.waitForTimeout(250)
    let peak = 0, best = 99; const trace = []
    await page.keyboard.down('KeyW')
    for (let step = 0; step < 12; step++) {
      const w = await page.evaluate(() => {
        const g = window.__capy
        const h = g.hangAudit().rows[0]
        const c = g.capy.position
        return { a: h ? h.a : 0,
                 d: h ? Math.hypot(h.x - c.x, h.z - c.z) : 99,
                 y: +c.y.toFixed(2), cx: +c.x.toFixed(2), cz: +c.z.toFixed(2),
                 sp: +Math.hypot(g.capy.velocity.x, g.capy.velocity.z).toFixed(2),
                 paused: !!g.state.paused }
      })
      if (w.a > peak) peak = w.a
      if (w.d < best) best = w.d
      if (step === 0 || step === 11) trace.push(w)
      await page.waitForTimeout(200)
    }
    await page.keyboard.up('KeyW')
    await page.waitForTimeout(400)
    const end = await page.evaluate(() => {
      const g = window.__capy
      const h = g.hangAudit().rows[0]
      const c = g.capy.position
      return { a: h ? h.a : null, v: h ? h.v : null, capyY: +c.y.toFixed(2),
               err: g.state.lastError || '' }
    })
    out.rows.push({ tag: tag, start: start, trace: trace, peak: +peak.toFixed(4),
                    closest: +best.toFixed(2), end: end })
    await page.screenshot({ path: 'qa/d7t-' + tag + '.png' })
  }
  await page.evaluate(o => fetch('/shot?name=d7-touch.json',
      { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
