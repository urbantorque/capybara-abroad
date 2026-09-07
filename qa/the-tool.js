async page => {
  // ---------------------------------------------------------------------------
  // qa/the-tool.js — CAN YOU BREAK SOMEBODY'S ROUTINE? (ROADMAP-FUN item 5a)
  //
  // Five things, in one sequence per chapter, because they are one mechanic:
  //
  //   1. the tool exists, and it is where the person is
  //   2. the beat runs, with sound
  //   3. take it -> the beat FAILS: empty strokes counted, no sound
  //   4. they come and get it (localOwnStart, which the item says is already
  //      there and which was verified by reading rather than by running)
  //   5. put it back -> they resume
  //
  // `beatAudit` grew four columns for this, and four rather than one flag
  // because the failures are different: a beat that names no tool, one whose
  // tool was never spawned, one whose tool is exactly where it lives, and one
  // that has been robbed. The second is the one that ships silently.
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
  for (const b of ['kyoto', 'venice', 'hanoi', 'kowloon', 'cali']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(12000)
    const row = { b: b }

    // ---- 1. what got spawned ---------------------------------------------
    row.stock = await page.evaluate(() => {
      const a = window.__capy.beatAudit(true)
      const t = a.rows.filter(r => r.tool)
      return { withJob: a.withJob, withTool: t.length,
               made: t.filter(r => r.toolMade).length,
               types: t.map(r => r.tool),
               at: t.map(r => r.toolAt) }
    })
    if (!row.stock.made) { rows.push(row); continue }

    // ---- 2. the beat runs, untouched --------------------------------------
    await page.waitForTimeout(9000)
    row.before = await page.evaluate(() => {
      const a = window.__capy.beatAudit(false)
      const t = a.rows.filter(r => r.tool && r.toolMade)
      return { swings: t.reduce((s, r) => s + r.swings, 0),
               fails: t.reduce((s, r) => s + r.toolFail, 0),
               out: t.filter(r => r.toolOut).length }
    })

    // ---- 3. take one ------------------------------------------------------
    row.took = await page.evaluate(() => {
      const g = window.__capy
      const live = g.biome.current
      let who = null
      for (const L of (g.locals || [])) {
        if (L && L.biome === live && L.tool && !L.toolOut) { who = L; break }
      }
      if (!who) return { err: 'nobody with a tool to hand' }
      window.__W = who
      const p = who.tool
      // Straight into the mouth: the grab is the event ownership listens for,
      // and walking there is not what is being tested.
      g.capy.body.position.set(p.body.position.x + 0.4, p.body.position.y + 0.5,
                              p.body.position.z)
      g.capy.body.velocity.set(0, 0, 0)
      const ok = g.physics.grab(p)
      return { ok: ok, type: p.type, owner: p.owner ? 'somebody' : null }
    })
    if (row.took.err) { rows.push(row); continue }
    await page.evaluate(async () => {
      // Carry it well clear of the bench, then drop it — npcTOOL_R is 3.2 m.
      const g = window.__capy, W = window.__W
      const a = Math.random() * 6.28
      g.capy.body.position.set(W.ax + Math.cos(a) * 14, g.capy.body.position.y,
                              W.az + Math.sin(a) * 14)
      g.capy.body.velocity.set(0, 0, 0)
      await new Promise(r => setTimeout(r, 400))
    })
    // AND IT STAYS IN THE MOUTH. The first cut dropped it fourteen metres away
    // and in two chapters of five the tool was back at the bench before the
    // sample — because `localOwnStart` had already sent the owner to fetch it,
    // which is the mechanic working and is not what this window is measuring.
    // Holding it is the only way to guarantee an absence long enough to count
    // empty strokes in.
    await page.waitForTimeout(16000)
    row.broken = await page.evaluate(() => {
      const g = window.__capy, W = window.__W
      const a = g.beatAudit(false)
      const t = a.rows.filter(r => r.tool && r.toolMade)
      return { out: t.filter(r => r.toolOut).length,
               fails: t.reduce((s, r) => s + r.toolFail, 0),
               said: !!W.toolSaid,
               // The retrieval errand the item says is already there.
               errand: !!W.own,
               toolAt: W.tool && W.tool.body
                 ? +Math.hypot(W.tool.body.position.x - W.ax,
                               W.tool.body.position.z - W.az).toFixed(1) : null }
    })

    // ---- 5. put it back ---------------------------------------------------
    row.back = await page.evaluate(async () => {
      const g = window.__capy, W = window.__W
      const p = W.tool
      if (g.capy.heldProp === p) g.physics.release(null)
      p.body.position.set(W.ax + 0.4, W.y + 0.3, W.az + 0.4)
      p.body.velocity.set(0, 0, 0)
      p.body.previousPosition.copy(p.body.position)
      p.body.interpolatedPosition.copy(p.body.position)
      p.body.wakeUp()
      await new Promise(r => setTimeout(r, 6000))
      const a = g.beatAudit(true)
      const t = a.rows.filter(r => r.tool && r.toolMade)
      return { out: t.filter(r => r.toolOut).length, said: !!W.toolSaid }
    })
    await page.waitForTimeout(9000)
    row.after = await page.evaluate(() => {
      const a = window.__capy.beatAudit(false)
      const t = a.rows.filter(r => r.tool && r.toolMade)
      return { swings: t.reduce((s, r) => s + r.swings, 0),
               fails: t.reduce((s, r) => s + r.toolFail, 0) }
    })
    rows.push(row)
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=the-tool.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs })
}
