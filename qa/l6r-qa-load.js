async page => {
  const tGoto = Date.now()
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  let tTitle = -1
  for (let i = 0; i < 120; i++) {
    await page.waitForTimeout(250)
    const ok = await page.evaluate(() => !!(window.__capyRunning && document.querySelector('.capyui-go')))
    if (ok) { tTitle = Date.now() - tGoto; break }
  }
  await page.waitForTimeout(1500)
  const tBegin = Date.now()
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  let tStarted = -1
  for (let i = 0; i < 80; i++) {
    await page.waitForTimeout(100)
    const s = await page.evaluate(() => !!(window.__capy && window.__capy.state.started))
    if (s) { tStarted = Date.now() - tBegin; break }
  }
  await page.waitForTimeout(5000)
  const names = ['pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi', 'sydney']
  const rows = []
  for (const n of names) {
    const r = await page.evaluate(async (name) => {
      const g = window.__capy
      const t0 = performance.now()
      const gaps = []
      let last = t0, tSwitch = -1, tSettled = -1
      const prog0 = g.renderer.info.programs.length, geo0 = g.renderer.info.memory.geometries
      const p = new Promise(res => {
        const f = (t) => {
          const gap = t - last; last = t; gaps.push(gap)
          if (g.biome.current === name && tSwitch < 0) tSwitch = t - t0
          if (t - t0 < 9000) requestAnimationFrame(f); else res()
        }
        requestAnimationFrame(f)
      })
      g.hud.cross(name)
      await p
      let maxGap = 0, over100 = 0, over250 = 0, sumOver = 0, iMax = -1
      for (let i = 0; i < gaps.length; i++) { const x = gaps[i]; if (x > maxGap) { maxGap = x; iMax = i }; if (x > 100) { over100++; sumOver += x }; if (x > 250) over250++ }
      // time of the last frame over 100 ms after the switch = when the chapter is "settled"
      let acc = 0
      for (let i = 0; i < gaps.length; i++) { acc += gaps[i]; if (gaps[i] > 100) tSettled = acc }
      return { biome: g.biome.current, ok: g.biome.current === name, tSwitch: +tSwitch.toFixed(0), maxGap: +maxGap.toFixed(0),
        over100, over250, stallMs: +sumOver.toFixed(0), settledAt: +tSettled.toFixed(0), frames: gaps.length,
        programsNew: g.renderer.info.programs.length - prog0, geomNew: g.renderer.info.memory.geometries - geo0, lastError: g.state.lastError || null }
    }, n)
    rows.push(r)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6r-qa-load.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, { tTitle, tStarted, rows })
}
