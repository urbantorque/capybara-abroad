async page => {
  // ---------------------------------------------------------------------------
  // qa/the-pat.js — DOES ANYBODY REACH DOWN? (ROADMAP-FUN, item 3)
  //
  // The pat is the one thing in item 3 that is scored nowhere, which means it
  // has no event, no counter and no save field to read — so from outside, a
  // pat that never fires and a pat nobody has stood close enough for look
  // identical. It is watched at the only place it exists: `patT` on the record
  // and the arm angle it drives.
  //
  // The animal has to be teleported next to somebody: the three gestures tile
  // the distance (pat under 1.9 m, gift 2.2-9, photo 3-11) and a random walk
  // will not park itself at arm's length from a fixed local.
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
  for (const b of ['venice', 'goreme']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(11000)
    // Stand at arm's length from the nearest local and do nothing.
    const put = await page.evaluate(() => {
      const g = window.__capy
      const live = g.biome.current
      const p = g.capy.position
      let best = null, bd = 1e9
      for (const L of (g.locals || [])) {
        if (!L || L.biome !== live || !L.fig) continue
        const d = Math.hypot(L.x - p.x, L.z - p.z)
        if (d < bd) { bd = d; best = L }
      }
      if (!best) return null
      // 1.4 m out, which is inside npcPAT_R and outside npcGIFT_NEAR.
      const a = Math.random() * 6.28
      const x = best.x + Math.cos(a) * 1.4, z = best.z + Math.sin(a) * 1.4
      g.capy.body.position.set(x, best.y + 0.6, z)
      g.capy.body.velocity.set(0, 0, 0)
      return { d: +bd.toFixed(1) }
    })
    // `fam` has to climb past 0.45 first — about fifteen seconds — and then
    // the four-second loaf on top.
    let seen = null
    for (let i = 0; i < 90; i++) {
      seen = await page.evaluate(() => {
        const g = window.__capy
        const live = g.biome.current
        for (const L of (g.locals || [])) {
          if (!L || L.biome !== live || !L.fig) continue
          if (L.patT > 0) {
            return { patT: +L.patT.toFixed(2), fam: +(L.fam || 0).toFixed(2),
                     armR: +L.fig.armR.rotation.x.toFixed(2),
                     d: +Math.hypot(L.x - g.capy.position.x,
                                    L.z - g.capy.position.z).toFixed(1) }
          }
        }
        return null
      })
      if (seen) break
      await page.waitForTimeout(1000)
    }
    const end = await page.evaluate((arg) => {
      const g = window.__capy
      const live = g.biome.current
      let bestFam = 0
      for (const L of (g.locals || [])) {
        if (L && L.biome === live) bestFam = Math.max(bestFam, L.fam || 0)
      }
      return { biome: g.biome.current, want: arg.b, bestFam: +bestFam.toFixed(2),
               restT: +(g.capy.restT || 0).toFixed(1) }
    }, { b: b })
    rows.push(Object.assign(end, { placedAt: put, pat: seen }))
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=the-pat.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs })
}
