async page => {
  // D9, two audits in one walk.
  //
  // 1. `nextIn` IS AN OPTIONAL HOOK WITH NO AUDIT. Six chapters publish it and
  //    thirteen do not, and the difference between "this chapter has no task on
  //    a clock" and "this chapter has one and forgot the hook" is invisible
  //    from outside — todoNextIn answers -1 for both. This asks every chapter
  //    for every one of its own task ids and reports which answer.
  //
  // 2. HOW FAST DOES A CARRIER TURN? The reference-frame channel carries a
  //    deck's LINEAR velocity and not its angular one, so a passenger standing
  //    off the centreline of something that is turning is carried as though the
  //    deck were going straight. Whether that is worth building depends on a
  //    number nobody has taken: the yaw rate of the things you can stand on.
  //    Measured by DIFFERENCING THE QUATERNION, not by reading
  //    `angularVelocity` — these bodies are kinematic and most of them are
  //    turned by writing a quaternion, which leaves that field at zero.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1100, height: 660 })
  const out = { clocks: [], omega: [], errs: [] }
  const KEYS = ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9',
                'Digit0','Minus','Equal','BracketLeft','BracketRight','Semicolon','Quote',
                'Comma','Period','Slash']
  const SPIN = { quay: 1, manly: 1, monaco: 1, antarctic: 1, palawan: 1, pantanal: 1, cali: 1 }

  for (let i = 0; i < KEYS.length; i++) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(KEYS[i])
    await page.waitForTimeout(10000)
    const row = await page.evaluate((n) => {
      const g = window.__capy
      const live = g.biome.current
      const api = g[live] || (g.env && live === 'sydney' ? g.env : null)
      const ids = g.hud.taskIds(n)
      const answers = []
      let has = false
      if (api && typeof api.nextIn === 'function') {
        has = true
        for (const id of ids) {
          let s = -1
          try { s = api.nextIn(id) } catch (e) { s = -1 }
          if (typeof s === 'number' && s === s && s >= 0) answers.push(id)
        }
      }
      return { biome: live, chapter: n, tasks: ids.length, publishes: has, withClock: answers }
    }, i + 1)
    out.clocks.push(row)

    if (SPIN[row.biome]) {
      const spin = await page.evaluate(async () => {
        const g = window.__capy
        // Only bodies big enough to stand on, and only mass-0 ones: a dynamic
        // body spinning is a crate rolling, not a deck.
        const cands = []
        for (const b of g.world.bodies) {
          if (b.mass > 0) continue
          let big = false
          for (const s of b.shapes) {
            if (s.halfExtents && s.halfExtents.x > 1.6 && s.halfExtents.z > 1.6) big = true
          }
          if (big) cands.push({ b: b, yaw: 0, max: 0 })
        }
        const yawOf = (q) => Math.atan2(2 * (q.w * q.y + q.x * q.z),
                                        1 - 2 * (q.y * q.y + q.z * q.z))
        for (const c of cands) c.yaw = yawOf(c.b.quaternion)
        let t0 = performance.now()
        for (let k = 0; k < 900; k++) {
          await new Promise(r => setTimeout(r, 25))
          const t1 = performance.now(), dt = (t1 - t0) / 1000
          t0 = t1
          if (dt <= 0) continue
          for (const c of cands) {
            const y = yawOf(c.b.quaternion)
            let d = y - c.yaw
            while (d > Math.PI) d -= Math.PI * 2
            while (d < -Math.PI) d += Math.PI * 2
            c.yaw = y
            const w = Math.abs(d) / dt
            if (w < 4 && w > c.max) c.max = w    // >4 rad/s is a teleport, not a turn
          }
        }
        cands.sort((a, b) => b.max - a.max)
        return cands.slice(0, 4).map(c => ({
          maxOmega: Math.round(c.max * 1000) / 1000,
          driftAt4m: Math.round(c.max * 4 * 1000) / 1000,
          half: c.b.shapes[0].halfExtents
            ? [Math.round(c.b.shapes[0].halfExtents.x * 10) / 10,
               Math.round(c.b.shapes[0].halfExtents.z * 10) / 10] : null }))
      })
      out.omega.push({ biome: row.biome, bodies: spin })
    }
  }
  out.errs = errs
  await page.evaluate((o) => fetch('/shot?name=d9-clock.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
