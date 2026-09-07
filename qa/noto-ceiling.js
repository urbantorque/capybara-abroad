async page => {
  // ---------------------------------------------------------------------------
  // qa/noto-ceiling.js — HOW HIGH CAN THE NUMBER GO? (item 6, B14)
  //
  // noto-premise.js measured a RANDOM masher: 2 incidents and 1 scene in six
  // minutes across four chapters. A masher is the wrong instrument for this
  // question — it holds keys at random and almost never picks something up
  // and throws it, which is what causing trouble actually IS after B9 and B10.
  //
  // This one is DIRECTED: find the nearest loose prop, grab it, throw it at
  // the nearest person, over and over. It is the fastest any player could
  // possibly earn the number, and it is therefore the only honest input to
  // the TOP of a tier table.
  //
  // The structural ceiling is `sysINC_COOL` = 50 s: one card per 50 seconds
  // however chaotic the world gets. Four minutes can hold at most 4.8.
  //
  // TRAP, PAID FOR ONCE: `physics.release` takes an impulse VECTOR, not the
  // scalar multiplier `capyTryRelease` takes. Passing the number put
  // `set(undefined, undefined, undefined)` on the body and threw 1094
  // non-finite AudioParam errors out of the placed-sound path — a probe
  // breaking the thing it is measuring, not a defect. The impulse below is
  // built the way capyTryRelease builds it.
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

  await page.evaluate(() => {
    const g = window.__capy, W = window
    new MutationObserver(ms => {
      for (const m of ms) for (const nd of m.addedNodes) {
        const t = nd.textContent || ''
        if (/AN INCIDENT/.test(t)) W.__n.inc++
        if (/A SCENE/.test(t)) W.__n.scn++
      }
    }).observe(document.body, { childList: true, subtree: true })
    g.events.on('prop:destroy', () => { if (W.__n) W.__n.broke++ })
    g.events.on('npc:startled', () => { if (W.__n) W.__n.startled++ })

    W.__trouble = () => {
      const bad = new Set()
      const iv = setInterval(() => {
        try {
          const ph = g.physics, cp = g.capy.position
          if (g.capy.heldProp) {
            // Aimed at the nearest person, and built the way capyTryRelease
            // builds it: mass-proportional, 4.2 * m on the vertical.
            const p = g.capy.heldProp
            const m = Math.max(0.15, p.mass || 0.5)
            const spin = (p.spin === undefined || p.spin === null) ? 1 : p.spin
            let tx = cp.x, tz = cp.z + 1, bd = 1e9
            for (const L of (g.locals || [])) {
              if (!L || L.biome !== g.biome.current) continue
              const d = Math.hypot(L.ax - cp.x, L.az - cp.z)
              if (d < bd && d > 1) { bd = d; tx = L.ax; tz = L.az }
            }
            let dx = tx - cp.x, dz = tz - cp.z
            const dl = Math.hypot(dx, dz) || 1
            dx /= dl; dz /= dl
            const power = 5.0 * (0.8 + spin * 0.15) * 2.15
            ph.release({ x: dx * power * m, y: 4.2 * m * 2.15, z: dz * power * m })
            W.__n.thrown++
            return
          }
          let best = null, bd2 = 1e9
          for (const p of (g.props || [])) {
            if (!p || !p.body || p.held || bad.has(p)) continue
            const d = Math.hypot(p.body.position.x - cp.x, p.body.position.z - cp.z)
            if (d < bd2) { bd2 = d; best = p }
          }
          if (!best) { bad.clear(); return }
          g.capy.body.position.set(best.body.position.x + 0.4,
                                   best.body.position.y + 0.5,
                                   best.body.position.z)
          g.capy.body.velocity.set(0, 0, 0)
          // A prop that refuses to be picked up is skipped rather than
          // retried forever — the first cut threw once in four minutes in
          // Sydney because it asked the same immovable thing 260 times.
          if (!ph.grab(best)) { bad.add(best); W.__n.refused++ }
        } catch (e) { W.__n.err++ }
      }, 900)
      W.__calm = () => clearInterval(iv)
    }
  })

  const laps = []
  for (const name of ['sydney', 'venice', 'hanoi']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, name)
    await page.waitForTimeout(12000)
    await page.evaluate(() => {
      window.__n = { inc: 0, scn: 0, thrown: 0, broke: 0, startled: 0, refused: 0, err: 0 }
      window.__trouble()
    })
    await page.waitForTimeout(240000)
    laps.push(await page.evaluate((n) => {
      window.__calm()
      const g = window.__capy
      return { b: n, secs: 240, n: Object.assign({}, window.__n),
               props: (g.props || []).length,
               people: (g.locals || []).filter(L => L && L.biome === g.biome.current).length }
    }, name))
    await page.waitForTimeout(2500)
  }

  const save = await page.evaluate(() => {
    let s = null
    try { s = JSON.parse(localStorage.getItem('capy3.journey.v1') || 'null') } catch (e) {}
    if (!s) return { err: 'no save' }
    const sum = o => { let t = 0; for (const k in (o || {})) t += o[k] || 0; return t }
    return { inc: sum(s.inc), scn: sum(s.scn), pho: sum(s.pho), fed: sum(s.fed),
             finds: (s.finds || []).length, recs: Object.keys(s.recs || {}).length,
             tasks: (s.tasks || []).length, ms: Math.round((s.ms || 0) / 1000) }
  })

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=noto-ceiling.json', { method: 'POST', body: s })
  }, { laps: laps, save: save, errs: errs.slice(0, 6), errN: errs.length })
}
