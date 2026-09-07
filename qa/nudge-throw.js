async page => {
  // ---------------------------------------------------------------------------
  // qa/nudge-throw.js — WHAT DOES A WALK DO, AND HOW FAR DOES A THROW GO?
  // (ROADMAP-FUN, items 4b and 4c)
  //
  // 4c says "below physBarge's 3.2 m/s, a steady push so a ball rolls and a
  // trolley starts down a slope", which asserts that below the barge threshold
  // nothing useful happens. props.js says the same thing in a comment — "moved
  // by the solver alone, which mostly means it slides a hand's width and stops"
  // — and a comment is not a measurement.
  //
  // 4b says to release "at 5-11 m/s with pitch from the camera's elevation".
  // Both halves of that are claims: the throw's present envelope, and whether
  // the camera HAS an elevation the player can change.
  //
  // THE ANIMAL IS PUT BACK BETWEEN ROWS. The first cut let it walk from row to
  // row and by the third one it was pinned against something 19 m from the
  // spawn: every row after the second read a closing speed of 0.33 m/s and a
  // displacement of zero, which is exactly what "the nudge does nothing" looks
  // like. Trap 26's convention is the other half — W walks the animal along
  // MINUS (sin camYaw, cos camYaw), and camYaw is damped, so it is read after
  // the animal has settled and immediately before the key goes down.
  // ---------------------------------------------------------------------------
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(11000)

  await page.evaluate(() => {
    const g = window.__capy
    const p = g.capy.position
    window.__home = { x: p.x, y: p.y, z: p.z }
    // The release velocity, on the event, not a poll — see B9.
    window.__rel = null
    g.events.on('capy:drop', (e) => {
      const q = e && e.prop
      if (!q) return
      window.__rel = { v: +Math.hypot(q.body.velocity.x, q.body.velocity.y,
                                      q.body.velocity.z).toFixed(3),
                       vy: +q.body.velocity.y.toFixed(2),
                       vh: +Math.hypot(q.body.velocity.x, q.body.velocity.z).toFixed(2) }
    })
  })
  const home = async () => page.evaluate(() => {
    const g = window.__capy, h = window.__home
    g.capy.body.position.set(h.x, h.y + 0.4, h.z)
    g.capy.body.velocity.set(0, 0, 0)
    g.capy.body.previousPosition.copy(g.capy.body.position)
    g.capy.body.interpolatedPosition.copy(g.capy.body.position)
  })

  // ---- 1. THE CAMERA'S ELEVATION ------------------------------------------
  const cam = await page.evaluate(async () => {
    const g = window.__capy
    let lo = 9, hi = -9
    for (let i = 0; i < 32; i++) {
      const c = g.camera
      const d = Math.hypot(c.position.x - g.capy.position.x, c.position.z - g.capy.position.z)
      const el = Math.atan2(c.position.y - g.capy.position.y, d)
      if (el < lo) lo = el
      if (el > hi) hi = el
      await new Promise(r => setTimeout(r, 250))
    }
    return { loDeg: +(lo * 57.2958).toFixed(1), hiDeg: +(hi * 57.2958).toFixed(1),
             // ...and whether the player has any way to change it at all.
             inputKeys: Object.keys(g.input).join(','),
             gravityY: g.world ? +g.world.gravity.y.toFixed(2) : null }
  })

  // ---- 2. THE NUDGE --------------------------------------------------------
  const nudge = []
  for (const t of ['ball', 'hat', 'basket', 'cone', 'bin']) {
    for (const run of [false, true]) {
      await home()
      await page.waitForTimeout(1400)
      const put = await page.evaluate((arg) => {
        const g = window.__capy
        const cp = g.capy.position
        const yaw = g.input.camYaw
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw)
        const px = cp.x + fx * 3.4, pz = cp.z + fz * 3.4
        const pr = g.physics.spawnProp(arg.t, px, pz, cp.y)
        if (!pr) return { err: 'no prop' }
        window.__p = pr
        return { yaw: +yaw.toFixed(2) }
      }, { t: t })
      if (put.err) { nudge.push({ t: t, run: run, err: put.err }); continue }
      await page.waitForTimeout(1100)
      const before = await page.evaluate(() => {
        const p = window.__p
        p.body.wakeUp()
        return { x: p.body.position.x, z: p.body.position.z }
      })
      if (run) await page.keyboard.down('ShiftLeft')
      await page.keyboard.down('KeyW')
      await page.waitForTimeout(1100)
      const hit = await page.evaluate(() => {
        const v = window.__capy.capy.velocity
        return +Math.hypot(v.x, v.z).toFixed(2)
      })
      await page.waitForTimeout(700)
      await page.keyboard.up('KeyW')
      if (run) await page.keyboard.up('ShiftLeft')
      await page.waitForTimeout(1800)
      nudge.push(await page.evaluate((arg) => {
        const p = window.__p
        const d = Math.hypot(p.body.position.x - arg.b.x, p.body.position.z - arg.b.z)
        const r = { t: arg.t, run: arg.run, closing: arg.hit,
                    moved: +d.toFixed(2), mass: p.body.mass }
        window.__capy.physics.removeProp(p)
        return r
      }, { t: t, run: run, b: before, hit: hit }))
    }
  }

  // ---- 3. THE THROW'S ENVELOPE --------------------------------------------
  const throwRows = []
  for (const arg of [{ t: 'hat', run: false }, { t: 'hat', run: true },
                     { t: 'winebottle', run: false }, { t: 'camera', run: false }]) {
    await home()
    await page.waitForTimeout(1400)
    const s = await page.evaluate((a) => {
      const g = window.__capy
      const cp = g.capy.position
      const pr = g.physics.spawnProp(a.t, cp.x + 0.5, cp.z + 0.5, cp.y + 0.4)
      if (!pr) return { err: 'no prop' }
      // Nobody may come and take it back mid-test — see B9.
      pr.owner = null
      if (!g.physics.grab(pr)) return { err: 'grab refused' }
      window.__p = pr
      window.__rel = null
      window.__from = { x: cp.x, y: cp.y, z: cp.z }
      return { ok: true }
    }, arg)
    if (s.err) { throwRows.push(Object.assign({ err: s.err }, arg)); continue }
    await page.waitForTimeout(900)
    if (arg.run) await page.keyboard.down('ShiftLeft')
    // down/up rather than press(): B9's put-down arms on the press and
    // resolves on the release, and a 10 ms press is over before a frame runs.
    await page.keyboard.down('KeyE')
    await page.waitForTimeout(90)
    await page.keyboard.up('KeyE')
    if (arg.run) await page.keyboard.up('ShiftLeft')
    const flight = await page.evaluate(async () => {
      const g = window.__capy, p = window.__p, f = window.__from
      let apex = -99
      for (let i = 0; i < 80; i++) {
        const b = p.body
        apex = Math.max(apex, b.position.y - f.y)
        await new Promise(r => setTimeout(r, 35))
        if (i > 6 && Math.hypot(b.velocity.x, b.velocity.y, b.velocity.z) < 0.3) break
      }
      const b = p.body
      const range = Math.hypot(b.position.x - f.x, b.position.z - f.z)
      const r = { rel: window.__rel, apex: +apex.toFixed(2), range: +range.toFixed(2),
                  gone: !!(p.removed || p.hidden || p.spilled) }
      g.physics.removeProp(p)
      return r
    })
    throwRows.push(Object.assign({}, arg, flight))
  }

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=nudge-throw.json', { method: 'POST', body: s })
  }, { cam: cam, nudge: nudge, throwRows: throwRows, errs: errs })
}
