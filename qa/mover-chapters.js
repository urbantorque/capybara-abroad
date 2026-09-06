async page => {
  // A1/A2 across the three chapters S1 wires, plus the two axes themselves.
  // switchTo rather than the picker: a picker key is a one-based index and it
  // has produced two confident false failures in this repo already.
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(7000)

  const out = { chapters: {}, axes: null, errs: errs }

  // ---- the two axes, measured where the ear actually is --------------------
  out.axes = await page.evaluate(() => {
    const g = window.__capy
    const e = g.hud.audioProbe(0, 0, 0).ear
    const ring = []
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4
      const p = g.hud.audioProbe(e.x + Math.cos(a) * 30, e.y, e.z + Math.sin(a) * 30, 60, 400)
      ring.push({ deg: Math.round(a * 180 / Math.PI), pan: p.pan, back: p.back, up: p.up })
    }
    const above = g.hud.audioProbe(e.x, e.y + 30, e.z, 60, 400)
    const level = g.hud.audioProbe(e.x + 30, e.y, e.z, 60, 400)
    return { ring: ring, above: { back: above.back, up: above.up, pan: above.pan },
             level: { back: level.back, up: level.up, pan: level.pan },
             maxBack: Math.max.apply(null, ring.map(r => r.back)),
             minBack: Math.min.apply(null, ring.map(r => r.back)) }
  })

  for (const name of ['hanoi', 'monaco']) {
    await page.evaluate((n) => {
      const g = window.__capy
      g.biome.switchTo(n)
    }, name)
    await page.waitForTimeout(9000)
    await page.evaluate(() => {
      const g = window.__capy
      window.__s = []
      window.__t = setInterval(() => {
        const a = g.hud.moverAudit()
        window.__s.push({ live: a.live, builds: a.builds, biome: a.biome,
          rows: a.rows.filter(r => r.built || r.gain > 0)
                 .map(r => ({ key: r.key, g: r.gain, p: r.pan, rt: r.rate,
                              d: r.d, k: r.k, live: r.live, bed: r.bed })) })
      }, 300)
    })
    for (let i = 0; i < 6; i++) await page.evaluate(() => new Promise(r => setTimeout(r, 5000)))
    out.chapters[name] = await page.evaluate(() => {
      const g = window.__capy
      clearInterval(window.__t)
      const s = window.__s
      const keys = {}
      for (const smp of s) {
        for (const r of smp.rows) {
          const k = keys[r.key] || (keys[r.key] = { n: 0, gMin: 9, gMax: 0, rtMin: 9, rtMax: 0,
                                                    pMin: 9, pMax: -9, dMin: 1e9, liveN: 0, bed: r.bed })
          k.n++
          if (r.live) k.liveN++
          k.gMin = Math.min(k.gMin, r.g); k.gMax = Math.max(k.gMax, r.g)
          k.rtMin = Math.min(k.rtMin, r.rt); k.rtMax = Math.max(k.rtMax, r.rt)
          k.pMin = Math.min(k.pMin, r.p); k.pMax = Math.max(k.pMax, r.p)
          k.dMin = Math.min(k.dMin, r.d)
        }
      }
      for (const k in keys) {
        const v = keys[k]
        v.gMin = +v.gMin.toFixed(4); v.gMax = +v.gMax.toFixed(4)
        v.rtMin = +v.rtMin.toFixed(4); v.rtMax = +v.rtMax.toFixed(4)
        v.pMin = +v.pMin.toFixed(3); v.pMax = +v.pMax.toFixed(3)
        v.dMin = +v.dMin.toFixed(2)
      }
      return { biome: g.biome.current, lastError: g.state.lastError || null,
               samples: s.length, maxLive: s.reduce((m, r) => Math.max(m, r.live), 0),
               builds: s.length ? s[s.length - 1].builds : 0, keys: keys }
    })
  }

  // Back to Sydney: does a mover left behind in another chapter stay silent?
  await page.evaluate(() => window.__capy.biome.switchTo('sydney'))
  await page.waitForTimeout(6000)
  out.afterReturn = await page.evaluate(() => {
    const g = window.__capy
    const a = g.hud.moverAudit()
    return { biome: a.biome, live: a.live, builds: a.builds,
             foreign: a.rows.filter(r => r.biome !== a.biome && r.gain > 0)
                       .map(r => ({ key: r.key, biome: r.biome, gain: r.gain })),
             rows: a.rows.map(r => ({ key: r.key, biome: r.biome, gain: r.gain,
                                      built: r.built, live: r.live })) }
  })

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=mover-chapters.json', { method: 'POST', body: s })
  }, out)
}
