async page => {
  // ---------------------------------------------------------------------------
  // qa/bodies.js — DOES A PERSON STAGGER, AND DO THEY SIT DOWN?
  // (ROADMAP-FUN, item 4e)
  //
  // Two events on the local record, and neither has a counter, a task or a
  // save field — so from outside, a stagger that never fires and a player who
  // never barged anybody look identical. They are watched where they live:
  // `stum` and `sat` on the record, and the group channels they drive.
  //
  // The barge is proximity-based for the two cast chapters and contact-based
  // everywhere else (npcBargeSweep), and it needs the animal MOVING at
  // npcBARGE_V toward the person — so the animal is put on a line behind them
  // and W is held, rather than teleported into them, which would produce no
  // velocity and no barge at all.
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
  for (const b of ['venice', 'goreme', 'kowloon']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(11000)
    const row = { b: b, runs: [] }
    // Four charges at the same person: the first should stagger, and one of
    // the later ones should land while the flinch is still deep enough to
    // count as "already startled", which is what a sit needs.
    for (let k = 0; k < 4; k++) {
      const put = await page.evaluate(() => {
        const g = window.__capy
        const live = g.biome.current
        const cp = g.capy.position
        let best = null, bd = 1e9
        for (const L of (g.locals || [])) {
          if (!L || L.biome !== live || !L.fig) continue
          const d = Math.hypot(L.x - cp.x, L.z - cp.z)
          if (d < bd) { bd = d; best = L }
        }
        if (!best) return { err: 'nobody' }
        window.__L = best
        // Stand 3.2 m off on the camera's forward line so W runs at them —
        // trap 26: W walks along MINUS (sin camYaw, cos camYaw).
        const yaw = g.input.camYaw
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw)
        g.capy.body.position.set(best.x - fx * 3.2, best.y + 0.5, best.z - fz * 3.2)
        g.capy.body.velocity.set(0, 0, 0)
        g.capy.body.previousPosition.copy(g.capy.body.position)
        g.capy.body.interpolatedPosition.copy(g.capy.body.position)
        return { at: +bd.toFixed(1), fl: +(best.fl || 0).toFixed(3),
                 stum: +(best.stum || 0).toFixed(3), sat: +(best.sat || 0).toFixed(2),
                 satCd: +(best.satCd || 0).toFixed(1) }
      })
      if (put.err) { row.runs.push(put); break }
      await page.waitForTimeout(900)
      await page.keyboard.down('ShiftLeft')
      await page.keyboard.down('KeyW')
      await page.waitForTimeout(950)
      await page.keyboard.up('KeyW')
      await page.keyboard.up('ShiftLeft')
      // Sample fast and keep the PEAK: a stagger spring settles in about a
      // second and one sample at the end of the window would read zero and
      // look exactly like a mechanic that does not fire (trap 38).
      const peak = await page.evaluate(async () => {
        const L = window.__L
        let stum = 0, sat = 0, roll = 0, dip = 0, fl = 0
        const baseY = L.baseY
        for (let i = 0; i < 40; i++) {
          stum = Math.max(stum, Math.abs(L.stum || 0))
          sat = Math.max(sat, L.sat || 0)
          roll = Math.max(roll, Math.abs(L.group.rotation.z))
          dip = Math.max(dip, baseY - L.group.position.y)
          fl = Math.max(fl, -(L.fl || 0))
          await new Promise(r => setTimeout(r, 50))
        }
        return { stum: +stum.toFixed(3), sat: +sat.toFixed(2),
                 rollRad: +roll.toFixed(3), dipM: +dip.toFixed(3),
                 flinch: +fl.toFixed(3), satCd: +(L.satCd || 0).toFixed(1) }
      })
      row.runs.push(Object.assign({ before: put }, peak))
    }
    rows.push(row)
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=bodies.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs })
}
