async page => {
  // ---------------------------------------------------------------------------
  // qa/the-blame.js — DOES SOMEBODY ELSE GET THE BLAME? (item 5c)
  //
  // An exchange only fires when the player is between npcEX_MIN and npcEX_MAX
  // of one of the pair (6-26 m) and both mouths are free, so the probe has to
  // stand in that window and wait. Two things are measured and they are
  // different failures:
  //
  //   armed  — localBlameArm found a pair near the event and handed it a line
  //   said   — the pair actually got round to saying it
  //
  // A run that arms and never says is a mechanic that works and a player who
  // will never hear it, which is the more likely of the two to ship.
  //
  // The trigger is a real event: a bowl broken at somebody's feet, which is
  // B9's route into localsReact. `forceBlame` exists as well and is used only
  // to check the arming in chapters where nothing can be broken near a pair.
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
  for (const b of ['venice', 'goreme', 'kowloon', 'sahara', 'palawan']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(12000)
    const row = { b: b }
    row.stock = await page.evaluate(() => {
      const a = window.__capy.exAudit(true)
      return { pairs: a.pairs }
    })
    if (!row.stock.pairs) { rows.push(row); continue }

    // Stand at the far edge of the exchange window from the first pair, and
    // break something at their feet.
    row.fired = await page.evaluate(async () => {
      const g = window.__capy
      const a = g.exAudit(false)
      const p0 = a.rows[0]
      // 9 m out: inside npcEX_MAX (26) and outside npcEX_MIN (6).
      const ang = Math.random() * 6.28
      const cx = p0.ax + Math.cos(ang) * 9, cz = p0.az + Math.sin(ang) * 9
      g.capy.body.position.set(cx, g.capy.position.y + 0.4, cz)
      g.capy.body.velocity.set(0, 0, 0)
      await new Promise(r => setTimeout(r, 1200))
      // A break at the animal's own feet, so `mine` in localsReact is true.
      const pr = g.physics.spawnProp('cuencobowl', cx + 0.8, cz, g.capy.position.y + 0.3)
      if (!pr) return { err: 'no prop' }
      pr.disturbed = true
      await new Promise(r => setTimeout(r, 900))
      g.physics.shatter(pr)
      await new Promise(r => setTimeout(r, 700))
      const b2 = g.exAudit(false)
      return { armedAfterBreak: b2.rows.filter(r => r.armed).length,
               cool: b2.cool, standingAt: +Math.hypot(cx - p0.ax, cz - p0.az).toFixed(1) }
    })
    // ...then stand there and let them say it. The pair's own clock was
    // brought forward to under npcBLAME_SOON, so this is a short wait.
    await page.waitForTimeout(14000)
    row.said = await page.evaluate(() => {
      const a = window.__capy.exAudit(false)
      const armed = a.rows.filter(r => r.armed)
      return { total: a.total, stillArmed: armed.length,
               dropped: a.rows.reduce((s, r) => s + r.dropped, 0),
               why: armed.map(r => ({ t: r.t, near: r.near, inWindow: r.inWindow,
                                      aCd: r.aCd, bCd: r.bCd, step: r.step })) }
    })
    // ...and the arming on its own, through the test hook, so a chapter whose
    // pairs are all a long way from anything breakable still answers.
    row.forced = await page.evaluate(async () => {
      const g = window.__capy
      const a = g.exAudit(true)
      const p0 = a.rows[0]
      // The cooldown from the real one is still running; this reports whether
      // it refused for that reason rather than for want of a pair.
      const first = g.forceBlame(p0.ax, p0.az)
      await new Promise(r => setTimeout(r, 200))
      return { armed: first, cool: +g.exAudit(false).cool.toFixed(1) }
    })
    rows.push(row)
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=the-blame.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs })
}
