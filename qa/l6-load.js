async page => {
  // ---- THE CROSSING, TIMED FROM BOTH SIDES OF THE WHITE (L6, E8) ----------
  // Shape of qa/l6r-qa-load.js with two more columns per chapter. That probe
  // measured the longest rAF gap in the nine seconds after hud.cross and the
  // programs compiled by the end of them, which conflates the build (behind
  // the white, where a stall is a held card) with the shader compiles (which
  // used to land on the first VISIBLE frame). So each row now also records:
  //   offAt      when the white came off, ms after cross
  //   progFade   programs compiled while the white was up (build + compile())
  //   progAfter  programs compiled after it came off — the number owed to the
  //              player's first steps; the fix in biomeGo should take it to ~0
  //   maxAfter   longest frame after the white came off — the freeze you SEE
  //   over100After  frames > 100 ms after the white came off
  // And a second lap (F6): re-entry is `world.addBody` and the re-attach, not
  // a build, and nobody had measured it quiet.
  const LAPS = 2
  const tGoto = Date.now()
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  let tTitle = -1
  for (let i = 0; i < 120; i++) {
    await page.waitForTimeout(250)
    const ok = await page.evaluate(() => !!(window.__capyRunning && document.querySelector('.capyui-go')))
    if (ok) { tTitle = Date.now() - tGoto; break }
  }
  await page.waitForTimeout(1500)
  const tBegin = Date.now()
  await page.evaluate(() => { const b = document.querySelector('.capyui-carry') || document.querySelector('.capyui-go'); if (b) b.click() })
  await page.keyboard.press('Shift')
  let tStarted = -1
  for (let i = 0; i < 80; i++) {
    await page.waitForTimeout(100)
    const s = await page.evaluate(() => !!(window.__capy && window.__capy.state.started))
    if (s) { tStarted = Date.now() - tBegin; break }
  }
  await page.waitForTimeout(5000)
  if (tStarted < 0) throw new Error('load probe never started the game')
  const names = ['pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi', 'sydney']
  const laps = []
  for (let lap = 0; lap < LAPS; lap++) {
    const rows = []
    for (const n of names) {
      const r = await page.evaluate(async (arg) => {
        const name = arg.name, win = arg.win
        const g = window.__capy
        const fadeEl = document.querySelector('.capyui-fade')
        const t0 = performance.now()
        const gaps = []
        let last = t0, tSwitch = -1, offAt = -1, seenOn = false, progOff = -1, iOff = -1
        const prog0 = g.renderer.info.programs.length, geo0 = g.renderer.info.memory.geometries
        const p = new Promise(res => {
          const f = (t) => {
            const gap = t - last; last = t; gaps.push(gap)
            if (g.biome.current === name && tSwitch < 0) tSwitch = t - t0
            const on = fadeEl && fadeEl.classList.contains('on')
            if (on) seenOn = true
            else if (seenOn && offAt < 0) { offAt = t - t0; progOff = g.renderer.info.programs.length; iOff = gaps.length }
            if (t - t0 < win) requestAnimationFrame(f); else res()
          }
          requestAnimationFrame(f)
        })
        g.hud.cross(name)
        await p
        let maxGap = 0, over100 = 0, over250 = 0, sumOver = 0, maxAfter = 0, over100After = 0
        for (let i = 0; i < gaps.length; i++) {
          const x = gaps[i]
          if (x > maxGap) maxGap = x
          if (x > 100) { over100++; sumOver += x }
          if (x > 250) over250++
          if (iOff >= 0 && i >= iOff) { if (x > maxAfter) maxAfter = x; if (x > 100) over100After++ }
        }
        const progN = g.renderer.info.programs.length
        return { biome: g.biome.current, ok: g.biome.current === name, tSwitch: +tSwitch.toFixed(0),
          offAt: +offAt.toFixed(0), maxGap: +maxGap.toFixed(0), over100, over250, stallMs: +sumOver.toFixed(0),
          maxAfter: +maxAfter.toFixed(0), over100After,
          progFade: progOff >= 0 ? progOff - prog0 : -1, progAfter: progOff >= 0 ? progN - progOff : -1,
          programsNew: progN - prog0, geomNew: g.renderer.info.memory.geometries - geo0,
          calls: g.state.perf ? g.state.perf.calls : -1, tris: g.state.perf ? g.state.perf.triangles : -1,
          frames: gaps.length, rung: g.state.perfRung, lastError: g.state.lastError || null }
      }, { name: n, win: lap === 0 ? 9000 : 6000 })
      rows.push(r)
      console.log('load lap ' + (lap + 1) + ' ' + n + ' ' + JSON.stringify({ ok: r.ok, maxAfter: r.maxAfter, rung: r.rung }))
    }
    laps.push(rows)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6-load.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, { tTitle, tStarted, rows: laps[0], lap2: laps[1] || null })
}
