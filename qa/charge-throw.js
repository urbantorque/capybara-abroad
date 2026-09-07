async page => {
  // ---------------------------------------------------------------------------
  // qa/charge-throw.js — DOES HOLDING IT THROW IT FURTHER? (item 4b)
  //
  // Four holds of increasing length on the same prop from the same spot, and
  // the range measured each time. The first is 90 ms, which is a click and must
  // land where an uncharged throw has always landed — 1.65 m for a sun hat,
  // measured before any of this was built, off a launch of 5.12 across and 4.90
  // up.
  //
  // The mark is checked too: `capy.aim` is what systems.js draws the ring on,
  // and a ring that is not where the thing lands is worse than no ring.
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
    const p = window.__capy.capy.position
    window.__home = { x: p.x, y: p.y, z: p.z }
    window.__rel = null
    window.__capy.events.on('capy:drop', (e) => {
      const q = e && e.prop
      if (!q) return
      window.__rel = { v: +Math.hypot(q.body.velocity.x, q.body.velocity.y,
                                      q.body.velocity.z).toFixed(3),
                       vy: +q.body.velocity.y.toFixed(2),
                       vh: +Math.hypot(q.body.velocity.x, q.body.velocity.z).toFixed(2) }
    })
  })

  const rows = []
  for (const arg of [{ t: 'hat', hold: 90 }, { t: 'hat', hold: 600 }, { t: 'hat', hold: 1400 },
                     { t: 'camera', hold: 90 }, { t: 'camera', hold: 1400 },
                     { t: 'winebottle', hold: 90 }, { t: 'winebottle', hold: 1400 }]) {
    const hold = arg.hold
    await page.evaluate(() => {
      const g = window.__capy, h = window.__home
      g.capy.body.position.set(h.x, h.y + 0.4, h.z)
      g.capy.body.velocity.set(0, 0, 0)
      g.capy.body.previousPosition.copy(g.capy.body.position)
      g.capy.body.interpolatedPosition.copy(g.capy.body.position)
    })
    await page.waitForTimeout(1500)
    await page.evaluate((t) => { window.__ty = t }, arg.t)
    const s = await page.evaluate(() => {
      const g = window.__capy
      const cp = g.capy.position
      const pr = g.physics.spawnProp(window.__ty, cp.x + 0.5, cp.z + 0.5, cp.y + 0.4)
      if (!pr) return { err: 'no prop' }
      pr.owner = null
      if (!g.physics.grab(pr)) return { err: 'grab refused' }
      window.__p = pr
      window.__rel = null
      window.__from = { x: cp.x, y: cp.y, z: cp.z }
      // A vessel in reach would make this a put-down instead of a charge, and
      // Sydney's nearest bin is 20 m away — asserted rather than assumed.
      const v = g.physics.vesselNear(cp, undefined, pr)
      return { vesselInReach: !!v }
    })
    if (s.err) { rows.push({ hold: hold, err: s.err }); continue }
    await page.waitForTimeout(800)
    await page.keyboard.down('KeyE')
    // Read the mark two thirds of the way through the hold, while it is up.
    await page.waitForTimeout(Math.max(40, Math.round(hold * 0.66)))
    const mid = await page.evaluate(() => {
      const g = window.__capy
      return { charge: +(g.capy.charge || 0).toFixed(2),
               aim: g.capy.aim ? { d: +g.capy.aim.d.toFixed(2) } : null }
    })
    await page.waitForTimeout(Math.max(20, hold - Math.round(hold * 0.66)))
    const atRelease = await page.evaluate(() => {
      const g = window.__capy
      return { charge: +(g.capy.charge || 0).toFixed(2),
               aimD: g.capy.aim ? +g.capy.aim.d.toFixed(2) : null }
    })
    await page.keyboard.up('KeyE')
    const flight = await page.evaluate(async () => {
      const g = window.__capy, p = window.__p, f = window.__from
      let apex = -99, touch = null, rising = true
      for (let i = 0; i < 90; i++) {
        const dy = p.body.position.y - f.y
        apex = Math.max(apex, dy)
        // WHERE IT LANDS, not where it stops. The mark predicts the first
        // contact with the ground; the prop then skids, and the two numbers
        // are different things. Recorded separately so the mark can be judged
        // against the one it is actually claiming.
        // THE BOUNCE, not a height. The first cut called it a landing when dy
        // fell below a quarter metre, and a prop leaves the mouth 0.4 m up, so
        // it fired half a metre into the descent and reported 0.81 m for every
        // throw in the table including one that flew eleven. The landing is the
        // frame the vertical velocity turns round.
        if (touch === null) {
          if (rising && p.body.velocity.y < -0.5) rising = false
          else if (!rising && p.body.velocity.y > -0.05) {
            touch = +Math.hypot(p.body.position.x - f.x, p.body.position.z - f.z).toFixed(2)
          }
        }
        await new Promise(r => setTimeout(r, 20))
        if (i > 6 && Math.hypot(p.body.velocity.x, p.body.velocity.y,
                                p.body.velocity.z) < 0.3) break
      }
      const r = { rel: window.__rel, apex: +apex.toFixed(2), touch: touch,
                  broke: !!(p.hidden || p.removed),
                  range: +Math.hypot(p.body.position.x - f.x,
                                     p.body.position.z - f.z).toFixed(2),
                  markStillUp: !!g.capy.aim }
      g.physics.removeProp(p)
      return r
    })
    rows.push(Object.assign({ t: arg.t, hold: hold, vessel: s.vesselInReach, mid: mid },
                            atRelease, flight))
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=charge-throw.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs })
}
