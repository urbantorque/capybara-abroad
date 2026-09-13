async page => {
  // WHERE THE LONG FRAME IS (L6 owed, the sliced build): the switch (ensureBuilt + attach),
  // the warm's compile() call, and the first drawn frames, timed separately per chapter.
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  for (let i = 0; i < 120; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capyRunning && document.querySelector('.capyui-go')))) break }
  await page.waitForTimeout(1500)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break }
  await page.waitForTimeout(4000)
  await page.evaluate(() => {
    const g = window.__capy
    window.__split = { build: 0, compile: 0, add: 0, addN: 0 }
    const sw = g.biome.switchTo
    g.biome.switchTo = function (n) { const t = performance.now(); const r = sw.call(this, n); window.__split.build = performance.now() - t; return r }
    const cp = g.renderer.compile
    g.renderer.compile = function (a, b, c) { const t = performance.now(); const r = cp.call(this, a, b, c); window.__split.compile = performance.now() - t; return r }
  })
  const names = ['pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi', 'sydney']
  const rows = []
  for (const n of names) {
    rows.push(await page.evaluate(async (name) => {
      const g = window.__capy
      window.__split.build = 0; window.__split.compile = 0
      const t0 = performance.now(); const gaps = []; let last = t0
      const p = new Promise(res => { const f = (t) => { gaps.push(+(t - last).toFixed(0)); last = t; if (t - t0 < 6000) requestAnimationFrame(f); else res() }; requestAnimationFrame(f) })
      g.hud.cross(name)
      await p
      let max = 0, iMax = -1; for (let i = 0; i < gaps.length; i++) if (gaps[i] > max) { max = gaps[i]; iMax = i }
      return { biome: name, ok: g.biome.current === name, build: +window.__split.build.toFixed(0), compile: +window.__split.compile.toFixed(0),
               warmMs: g.state.warmMs, warmN: g.state.warmN, maxGap: max, big: gaps.filter(x => x > 100), err: g.state.lastError || null }
    }, n))
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=l7-load-split.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, { rows })
}
