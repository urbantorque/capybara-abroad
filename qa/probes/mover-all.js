async page => {
  // S1b — every mover and bed the audio pass wires, in its own chapter.
  // switchTo, never a picker digit: a picker key is a one-based index and has
  // produced two confident false failures in this repo already.
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(7000)

  const want = {
    sydney: ['env:van', 'env:plane'],
    quay: ['quay:freshwater'],
    rio: ['rio:bonde0', 'rio:bonde1', 'rio:desfile'],
    kowloon: ['hk:bus'],
    manly: ['man:break'],
    kyoto: ['kyo:uji'],
    antarctic: ['ant:colony-bed'],
    hanoi: ['han:bike0', 'han:bike1', 'han:bike2', 'han:traffic'],
    monaco: ['mon:car'],
  }
  const out = { chapters: {}, errs: errs }

  for (const name of Object.keys(want)) {
    if (name !== 'sydney') {
      await page.evaluate((n) => window.__capy.biome.switchTo(n), name)
      await page.waitForTimeout(9000)
    }
    // Walk a little: a bed measured from one point cannot show that it moves.
    await page.evaluate(() => {
      const g = window.__capy
      window.__s = []
      window.__t = setInterval(() => {
        const a = g.hud.moverAudit()
        window.__s.push({ live: a.live, biome: a.biome, builds: a.builds,
          rows: a.rows.map(r => ({ k: r.key, g: r.gain, p: r.pan, rt: r.rate,
                                   d: r.d, live: r.live, bed: r.bed, built: r.built })) })
      }, 300)
    })
    for (const key of ['KeyW', 'KeyD', 'KeyS', 'KeyA']) {
      await page.keyboard.down(key)
      await page.waitForTimeout(2600)
      await page.keyboard.up(key)
      await page.waitForTimeout(300)
    }
    out.chapters[name] = await page.evaluate((expect) => {
      const g = window.__capy
      clearInterval(window.__t)
      const s = window.__s
      const per = {}
      for (const smp of s) {
        for (const r of smp.rows) {
          if (expect.indexOf(r.k) < 0) continue
          const v = per[r.k] || (per[r.k] = { n: 0, heard: 0, gMax: 0, dMin: 1e9,
                                              pMin: 9, pMax: -9, rtMin: 9, rtMax: 0,
                                              bed: r.bed, built: false })
          v.n++
          if (r.live && r.g > 0.002) v.heard++
          if (r.built) v.built = true
          v.gMax = Math.max(v.gMax, r.g); v.dMin = Math.min(v.dMin, r.d)
          v.pMin = Math.min(v.pMin, r.p); v.pMax = Math.max(v.pMax, r.p)
          v.rtMin = Math.min(v.rtMin, r.rt); v.rtMax = Math.max(v.rtMax, r.rt)
        }
      }
      const missing = expect.filter(k => !per[k])
      for (const k in per) {
        const v = per[k]
        v.gMax = +v.gMax.toFixed(4); v.dMin = +v.dMin.toFixed(1)
        v.pMin = +v.pMin.toFixed(2); v.pMax = +v.pMax.toFixed(2)
        v.rtMin = +v.rtMin.toFixed(4); v.rtMax = +v.rtMax.toFixed(4)
      }
      return { biome: g.biome.current, lastError: g.state.lastError || null,
               samples: s.length, maxLive: s.reduce((m, r) => Math.max(m, r.live), 0),
               builds: s.length ? s[s.length - 1].builds : 0,
               missing: missing, movers: per }
    }, want[name])
  }

  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=mover-all.json', { method: 'POST', body: s })
  }, out)
}
