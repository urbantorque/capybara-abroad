async page => {
  // ---------------------------------------------------------------------------
  // qa/fam-reach.js — IS `fam` REACHABLE AT ALL? (ROADMAP-FUN, item 3)
  //
  // The snack is gated on `fam >= npcFAM_HEAT` (0.45), and a gift gated on an
  // unreachable number is a dead feature that looks alive — which this session
  // has now found four times. `npcFAM_T` is 34 s to reach 1.0, so 0.45 should
  // be about fifteen seconds of standing about. But the rise needs THREE things
  // at once: the animal inside `r.near` (7 m by default), `game.calm()` above
  // 0.25, and the person not wary — and it is multiplied by the calm, so a
  // world that is only just calm enough rises at a quarter speed.
  //
  // Stand still for ninety seconds and watch the best `fam` in the chapter.
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
  for (const b of ['venice', 'goreme', 'sahara', 'manly']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(11000)
    await page.evaluate(() => {
      const g = window.__capy
      window.__fam = { best: 0, bestNear: 0, calm: 0, n: 0, ticks: [] }
      window.__famT = setInterval(() => {
        const S = window.__fam
        const p = g.capy.position
        const live = g.biome.current
        let best = 0, near = 0
        for (const L of (g.locals || [])) {
          if (!L || L.biome !== live) continue
          const d = Math.hypot(L.x - p.x, L.z - p.z)
          if (d < (L.near || 7)) near++
          if ((L.fam || 0) > best) best = L.fam
        }
        S.best = Math.max(S.best, best)
        S.bestNear = Math.max(S.bestNear, near)
        S.calm = typeof g.calm === 'function' ? g.calm(p.x, p.z) : -1
        S.n++
        if (S.n % 10 === 0) S.ticks.push(+best.toFixed(3))
      }, 500)
    })
    for (let i = 0; i < 18; i++) await page.evaluate(() => new Promise(r => setTimeout(r, 5000)))
    const r = await page.evaluate((arg) => {
      const g = window.__capy
      clearInterval(window.__famT)
      const S = window.__fam
      const p = g.capy.position
      const live = g.biome.current
      const near = []
      for (const L of (g.locals || [])) {
        if (!L || L.biome !== live) continue
        const d = Math.hypot(L.x - p.x, L.z - p.z)
        if (d < 14) near.push({ d: +d.toFixed(1), near: L.near,
                                fam: +(L.fam || 0).toFixed(3),
                                wary: +(L.wary || 0).toFixed(2) })
      }
      return { biome: live, want: arg.b, best: +S.best.toFixed(3),
               insideCircle: S.bestNear, calm: +(+S.calm).toFixed(2),
               restT: +(g.capy.restT || 0).toFixed(1),
               curve: S.ticks, near: near }
    }, { b: b })
    rows.push(r)
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=fam-reach.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs })
}
