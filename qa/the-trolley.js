async page => {
  // ---------------------------------------------------------------------------
  // qa/the-trolley.js — CAN YOU STAND ON IT, AND DOES IT TAKE YOU WITH IT?
  // (ROADMAP-FUN, item 4c — one rideable prop)
  //
  // The carrier contract in this game is capybara.js's contact sweep: whatever
  // the animal is standing on hands over its velocity, provided the body has at
  // least capyPLAT_MIN_MASS (4) and is actually moving. The trolley is 6 kg, so
  // the claim is that a prop needed no new machinery — only a deck.
  //
  // Three things, and the third is the one the memory about carriers says
  // always breaks: the animal gets ON, the animal is CARRIED, and the animal is
  // not DROPPED THROUGH — a zero-velocity carrier and a carrier that lets go
  // both look like a ride that works right up until it does not.
  // ---------------------------------------------------------------------------
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)

  const rows = []
  for (const b of ['quay', 'kowloon', 'monaco']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(11000)
    const row = { b: b }
    row.found = await page.evaluate(() => {
      const g = window.__capy
      const live = g.biome.current
      const cp = g.capy.position
      let t = null, bd = 1e9
      for (const q of (g.props || [])) {
        if (!q || q.biome !== live || q.type !== 'trolley') continue
        if (!q.body || !q.body.world || q.removed || q.hidden) continue
        const d = Math.hypot(q.body.position.x - cp.x, q.body.position.z - cp.z)
        if (d < bd) { bd = d; t = q }
      }
      if (!t) return { err: 'no trolley' }
      window.__t = t
      return { fromSpawn: +bd.toFixed(1), mass: t.body.mass,
               deckY: +(t.body.position.y + t.originY).toFixed(2),
               grabbable: !!t.grabbable }
    })
    if (row.found.err) { rows.push(row); continue }
    // ---- 1. get on it -----------------------------------------------------
    await page.evaluate(() => {
      const g = window.__capy, t = window.__t
      const b = t.body.position
      g.capy.body.position.set(b.x, b.y + t.originY + 0.55, b.z)
      g.capy.body.velocity.set(0, 0, 0)
      g.capy.body.previousPosition.copy(g.capy.body.position)
      g.capy.body.interpolatedPosition.copy(g.capy.body.position)
    })
    await page.waitForTimeout(1800)
    row.on = await page.evaluate(() => {
      const g = window.__capy, t = window.__t
      return { dy: +(g.capy.position.y - t.body.position.y).toFixed(2),
               grounded: !!g.capy.grounded,
               offset: +Math.hypot(g.capy.position.x - t.body.position.x,
                                   g.capy.position.z - t.body.position.z).toFixed(2) }
    })
    // ---- 2. move it, and see whether the animal comes ----------------------
    row.ride = await page.evaluate(async () => {
      const g = window.__capy, t = window.__t
      const c0 = { x: g.capy.position.x, z: g.capy.position.z }
      const t0 = { x: t.body.position.x, z: t.body.position.z }
      // A push, not a teleport: the frame is inherited from the body's
      // VELOCITY, so a carrier that is moved by hand teaches nothing. This is
      // the trap the carriers memory names — a zero-velocity carrier looks
      // like a ride and hands over nothing.
      // ONE SHOVE, AND THEN NOTHING. The first cut rewrote velocity.x = 3
      // twenty-five times a second from outside the frame loop, which the
      // solver zeroes in between — it measured the probe fighting cannon, not
      // the trolley rolling. A single impulse and a free coast is the question:
      // does a shoved trolley keep going, and does it take the animal with it.
      t.body.wakeUp()
      // A plain {x,y,z} is not a CANNON.Vec3 and applyImpulse wants one; the
      // shove landed as 0.06 m of travel, which is a probe fault and not a
      // trolley fault. Setting the velocity is unambiguous.
      t.body.velocity.set(5, 0, 0)
      await new Promise(r => setTimeout(r, 2200))
      const dt = Math.hypot(t.body.position.x - t0.x, t.body.position.z - t0.z)
      const dc = Math.hypot(g.capy.position.x - c0.x, g.capy.position.z - c0.z)
      return { trolleyMoved: +dt.toFixed(2), capyMoved: +dc.toFixed(2),
               stillOn: +Math.hypot(g.capy.position.x - t.body.position.x,
                                    g.capy.position.z - t.body.position.z).toFixed(2),
               dy: +(g.capy.position.y - t.body.position.y).toFixed(2) }
    })
    // ---- 3. and it is not grabbable ---------------------------------------
    row.grab = await page.evaluate(() => {
      const g = window.__capy
      return { took: !!g.physics.grab(window.__t) }
    })
    rows.push(row)
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=the-trolley.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs })
}
