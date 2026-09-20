async page => {
  // ROADMAP-WOW2 Part N — the interleaved rAF A/B for N1's shelf-queue step
  // and N2's glimpse step. Both are near-zero cost by construction (the
  // shelf queue early-returns when empty; the glimpse step walks at most
  // one gateChap record per live chapter) — this is the honest check that
  // confirms that rather than asserting it.
  const FL = ['noShelf', 'noGlimpse']
  const NAMES = ['sydney', 'kyoto']
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForTimeout(9000)
  const out = { errs, rows: {} }
  for (let ci = 0; ci < NAMES.length; ci++) {
    const name = NAMES[ci]
    if (ci > 0) { await page.evaluate((n) => window.__capy.hud.cross(n), name); await page.waitForTimeout(9500) }
    const r = await page.evaluate(async (FL) => {
      const g = window.__capy
      const frames = (n) => new Promise(res => { const t = []; let last = performance.now(); let k = 0
        const step = () => { const now = performance.now(); t.push(now - last); last = now; if (++k < n) requestAnimationFrame(step); else res(t) }
        requestAnimationFrame(step) })
      const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1] }
      const on = [], off = []
      for (let rep = 0; rep < 5; rep++) {
        for (const f of FL) g.state[f] = false
        await frames(10); on.push(...await frames(60))
        for (const f of FL) g.state[f] = true
        await frames(10); off.push(...await frames(60))
      }
      for (const f of FL) g.state[f] = false
      return { biome: g.biome.current, onMed: +med(on).toFixed(3), offMed: +med(off).toFixed(3), rung: g.state.perfRung }
    }, FL)
    out.rows[name] = r
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-frametime-n.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
