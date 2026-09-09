async page => {
  // ---------------------------------------------------------------------------
  // qa/q2-names.js — HOW MANY OF THE FORTY DOES A PLAYER ACTUALLY HAVE? (Q2)
  //
  // Two questions, one run, and both of them have to be answered before a line
  // of Q2 is written:
  //
  //  1. THE PAGE. Forty silhouettes is a promise if you have some of them and a
  //     wall of grey if you never get any. So: how many DISTINCT names does the
  //     most determined troublemaker the game can be made to produce actually
  //     come away with, and how often does the same name come up twice?
  //  2. THE VARIETY TERM. notoScore is inc + scn + spread, and its tier table
  //     was calibrated on a measured 12-minute directed run that came to 17.
  //     Adding a fourth term moves every boundary in that table, so the delta
  //     has to be measured on the same instrument rather than reasoned about.
  //
  // The masher is deliberately NOT the instrument here: qa/q1-chains.js already
  // measured that a random player produces ONE card in six chapters. This is
  // noto-ceiling.js's directed troublemaker — grab the nearest prop, throw it
  // at the nearest person, every 0.9 s — which is the ceiling and therefore the
  // only honest input to a tier table.
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
    W.__cards = []
    // The card is the only place the name is published as it happens, and
    // repDebug().last is the name of the LAST one — read on the same beat.
    new MutationObserver(ms => {
      for (const m of ms) for (const nd of m.addedNodes) {
        const t = nd.textContent || ''
        if (!/AN INCIDENT|A SCENE/.test(t)) continue
        if (W.__n) { if (/A SCENE/.test(t)) W.__n.scn++; else W.__n.inc++ }
      }
    }).observe(document.body, { childList: true, subtree: true })
    const el = () => document.querySelector('.capyui-momenttext')
    let lastSeen = ''
    setInterval(() => {
      try {
        const d = g.repDebug()
        if (d && d.last && d.last !== lastSeen) { lastSeen = d.last; W.__cards.push(d.last) }
        if (d && !d.last) lastSeen = ''
      } catch (e) {}
    }, 300)

    W.__trouble = () => {
      const bad = new Set()
      const iv = setInterval(() => {
        try {
          const ph = g.physics, cp = g.capy.position
          if (g.capy.heldProp) {
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
          if (!ph.grab(best)) { bad.add(best) }
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
      window.__n = { inc: 0, scn: 0, thrown: 0, err: 0 }
      window.__trouble()
    })
    await page.waitForTimeout(180000)
    laps.push(await page.evaluate((n) => {
      window.__calm()
      const g = window.__capy
      return { b: n, secs: 180, n: Object.assign({}, window.__n),
               noto: g.hud.notoAudit(), rep: g.repDebug(), cards: window.__cards.slice() }
    }, name))
    await page.waitForTimeout(2500)
  }

  const end = await page.evaluate(() => {
    const g = window.__capy
    const d = g.repDebug()
    const a = g.hud.notoAudit()
    let names = 0, repeats = 0
    for (const k in d.counts) { if (d.counts[k] > 0) names++; repeats += Math.max(0, d.counts[k] - 1) }
    let s = null
    try { s = JSON.parse(localStorage.getItem('capy3.journey.v1') || 'null') } catch (e) {}
    return { noto: a, ofForty: d.n, distinct: names, repeats: repeats,
             counts: d.counts, cards: window.__cards.slice(),
             savedRep: s ? s.rep : null }
  })

  await page.evaluate((o) => fetch('/shot?name=q2-names.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), { laps: laps, end: end, errs: errs.slice(0, 6), errN: errs.length })
}
