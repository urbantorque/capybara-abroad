async page => {
  // D3: DOES THE WORLD ANSWER?
  //
  // Two questions, neither answerable from a still or from a state dump:
  //
  //   BARGE. Walk into somebody and watch their flinch spring. The animal is
  //   DRIVEN into them rather than teleported next to them — the whole feature
  //   is a contact, so a probe that writes a position has tested nothing.
  //
  //   THE CHAIN. Count who turned to look at the person who reacted, which is
  //   `looking` in reactAudit. SECOND-ORDER attention is the measurement; a
  //   first-order flinch is not.
  //
  // STEERING. `input.x/z` are camera-relative and systems.js owns `camYaw`, so
  // a world bearing has to be rotated INTO the live camera frame every tick —
  // writing the world vector straight into x/z walks in a circle as the camera
  // swings round behind the animal.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1100, height: 660 })
  const out = { rows: [], errs: [] }
  // Digit1 sydney, Digit2 pasto, Digit3 quay, Digit4 kyoto, Digit0 venice,
  // BracketRight manly, Period monaco, Slash hanoi. The first two are the CAST
  // chapters and take the other branch of the barge.
  const KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit0', 'BracketRight', 'Period', 'Slash']

  for (const key of KEYS) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(11000)
    const row = await page.evaluate(async () => {
      const g = window.__capy
      const cp = g.capy.position
      // TARGETS COME OUT OF THE PHYSICS WORLD, not out of `game.locals`. The
      // barge branch keys on `body.userData.npc || body.userData.local`, so
      // asking the world for bodies that carry either is asking exactly the
      // question the feature asks — and it covers Sydney and Pasto, which have
      // no `locals` at all (they predate addLocal and their people are the
      // module's own instanced casts, on the other branch).
      let best = null, bd = 1e9, kind = null
      for (const b of g.world.bodies) {
        const ud = b.userData
        if (!ud || (!ud.npc && !ud.local)) continue
        const d = Math.hypot(b.position.x - cp.x, b.position.z - cp.z)
        if (d < bd) { bd = d; best = b; kind = ud.local ? 'local' : 'cast' }
      }
      return { biome: g.biome.current, before: g.reactAudit(), kind: kind,
               nearest: best ? Math.round(bd * 10) / 10 : null,
               // The HEIGHTS, because a barge is a contact and two colliders
               // that pass within a metre horizontally do not touch if one of
               // them is on a promenade and the other is on the sand.
               targetY: best ? Math.round(best.position.y * 10) / 10 : null,
               capyY: Math.round(cp.y * 10) / 10,
               nx: best ? best.position.x : null, nz: best ? best.position.z : null }
    })
    if (row.nearest !== null && row.nearest < 30) {
      const hit = await page.evaluate(async (t) => {
        const g = window.__capy
        let peakFl = 0, peakV = 0, near = 0
        // COUNT THE EVENT ITSELF. Inferring "did the barge fire" from a spring
        // that a dozen other things also drive is how a probe reports a
        // feature dead in the one chapter where something else was in the way.
        window.__barge = 0
        g.events.on('npc:barge', function () { window.__barge++ })
        // BACK OFF FIRST IF WE ARE ALREADY ON TOP OF THEM. A barge is an
        // ARRIVAL at speed, and in Pasto the nearest person is 1.3 m from the
        // spawn — the animal starts pressed against them, never closes at
        // capyBARGE_V, and the probe reported the feature dead. Walking away
        // and turning round is what a player would do and it is two seconds.
        {
          const cp0 = g.capy.position
          if (Math.hypot(t.x - cp0.x, t.z - cp0.z) < 4.5) {
            for (let i = 0; i < 150; i++) {
              const cp = g.capy.position
              const wx = cp.x - t.x, wz = cp.z - t.z
              const m = Math.hypot(wx, wz) || 1
              const c = Math.cos(g.input.camYaw), s = Math.sin(g.input.camYaw)
              g.input.x = (wx / m) * c - (wz / m) * s
              g.input.z = (wx / m) * s + (wz / m) * c
              await new Promise(r => setTimeout(r, 12))
              if (m > 7) break
            }
          }
        }
        for (let i = 0; i < 700; i++) {
          const cp = g.capy.position
          const wx = t.x - cp.x, wz = t.z - cp.z
          const m = Math.hypot(wx, wz) || 1
          const c = Math.cos(g.input.camYaw), s = Math.sin(g.input.camYaw)
          g.input.x = (wx / m) * c - (wz / m) * s
          g.input.z = (wx / m) * s + (wz / m) * c
          g.input.run = m > 6
          await new Promise(r => setTimeout(r, 12))
          for (const r of (g.locals || [])) {
            if (r.biome !== g.biome.current) continue
            if (Math.abs(r.fl) > peakFl) peakFl = Math.abs(r.fl)
            if (Math.abs(r.flV) > peakV) peakV = Math.abs(r.flV)
          }
          if (m < 1.6) { near++; if (near > 40) break }
        }
        g.input.x = 0; g.input.z = 0; g.input.run = false
        // A flinch seeded on the LAST frame of the drive is one this probe
        // would otherwise report as zero. Let the spring run before reading.
        await new Promise(r => setTimeout(r, 320))
        for (const r of (g.locals || [])) {
          if (r.biome !== g.biome.current) continue
          if (Math.abs(r.fl) > peakFl) peakFl = Math.abs(r.fl)
        }
        const cp = g.capy.position
        return { barges: window.__barge, peakFl: Math.round(peakFl * 1000) / 1000,
                 peakFlV: Math.round(peakV * 100) / 100, framesInContact: near,
                 after: g.reactAudit(),
                 endDist: Math.round(Math.hypot(t.x - cp.x, t.z - cp.z) * 10) / 10 }
      }, { x: row.nx, z: row.nz })
      Object.assign(row, hit)
    }
    delete row.nx; delete row.nz
    out.rows.push(row)
  }
  out.errs = errs
  await page.evaluate((o) => fetch('/shot?name=d3-react.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
