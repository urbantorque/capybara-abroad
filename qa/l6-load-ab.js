async page => {
  // ---- THE CROSSING, WITH AND WITHOUT THE WARM, UNDER ONE LOAD (L6, E8) ----
  // qa/l6-load.js's before/after were taken an hour apart on a machine six
  // agents share, and the governor read rung 0-1 in one and rung 3 in the
  // other: not a differential. This runs the same nineteen first entries
  // twice in one session, on two fresh pages, with `game.state.noWarm` set
  // on the first (biomeWarm returns at once; the draw compiles on first use,
  // as it always did) and clear on the second. Same probe, same columns as
  // l6-load.js; the pair is what the report quotes.
  const names = ['pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi', 'sydney']
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const out = {}
  for (const mode of ['noWarm', 'warm']) {
    await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
    for (let i = 0; i < 120; i++) {
      await page.waitForTimeout(250)
      if (await page.evaluate(() => !!(window.__capyRunning && document.querySelector('.capyui-go')))) break
    }
    await page.waitForTimeout(1500)
    await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
    for (let i = 0; i < 80; i++) {
      await page.waitForTimeout(100)
      if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break
    }
    await page.evaluate((m) => { window.__capy.state.noWarm = m === 'noWarm' }, mode)
    await page.waitForTimeout(4000)
    const rows = []
    for (const n of names) {
      rows.push(await page.evaluate(async (name) => {
        const g = window.__capy
        const fadeEl = document.querySelector('.capyui-fade')
        const t0 = performance.now(), gaps = []
        let last = t0, tSwitch = -1, offAt = -1, seenOn = false, progOff = -1, iOff = -1
        const prog0 = g.renderer.info.programs.length
        const p = new Promise(res => {
          const f = (t) => {
            const gap = t - last; last = t; gaps.push(gap)
            if (g.biome.current === name && tSwitch < 0) tSwitch = t - t0
            const on = fadeEl && fadeEl.classList.contains('on')
            if (on) seenOn = true
            else if (seenOn && offAt < 0) { offAt = t - t0; progOff = g.renderer.info.programs.length; iOff = gaps.length }
            if (t - t0 < 7000) requestAnimationFrame(f); else res()
          }
          requestAnimationFrame(f)
        })
        g.hud.cross(name)
        await p
        let maxGap = 0, over100 = 0, maxAfter = 0, over100After = 0
        for (let i = 0; i < gaps.length; i++) {
          const x = gaps[i]
          if (x > maxGap) maxGap = x
          if (x > 100) over100++
          if (iOff >= 0 && i >= iOff) { if (x > maxAfter) maxAfter = x; if (x > 100) over100After++ }
        }
        const progN = g.renderer.info.programs.length
        return { biome: g.biome.current, ok: g.biome.current === name, tSwitch: +tSwitch.toFixed(0), offAt: +offAt.toFixed(0),
          maxGap: +maxGap.toFixed(0), over100, maxAfter: +maxAfter.toFixed(0), over100After,
          progFade: progOff >= 0 ? progOff - prog0 : -1, progAfter: progOff >= 0 ? progN - progOff : -1,
          warmMs: g.state.warmMs || 0, rung: g.state.perfRung, noWarm: !!g.state.noWarm, lastError: g.state.lastError || null }
      }, n))
    }
    out[mode] = rows
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6-load-ab.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
