async page => {
  // ROADMAP-WOW2 V5 — the interleaved rAF A/B for this wave's three terms:
  // the rainbow (shared.js's dome hook), the puddle (grain()'s reflect.wet
  // gate + mask, Kowloon's road only), the gust-strip and the drip (both
  // behind noStrip, weather.js's wxStepStrip). Same pattern as
  // qa/wow-frametime.js: live vs cut, interleaved, per chapter, delta is
  // the reference (headless software GL has no absolute 16.7 to compare to).
  const FL = ['noRainbow', 'noPuddle', 'noStrip']
  // Kyoto/Pantanal/Manly/Sydney carry the strip+drip (the dapple canopy
  // list found in each); Kyoto/Pantanal also carry the rainbow; Kowloon is
  // the one live `reflect.wet` caller (the puddle). Five chapters covers
  // all three terms at least once each.
  const NAMES = ['sydney', 'kyoto', 'pantanal', 'manly', 'kowloon']
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
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
      const p95 = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length * 0.95)] }
      const on = [], off = []
      for (let rep = 0; rep < 5; rep++) {
        for (const f of FL) g.state[f] = false
        await frames(10); on.push(...await frames(60))
        for (const f of FL) g.state[f] = true
        await frames(10); off.push(...await frames(60))
      }
      for (const f of FL) g.state[f] = false
      return { biome: g.biome.current, onMed: +med(on).toFixed(2), onP95: +p95(on).toFixed(2), offMed: +med(off).toFixed(2), offP95: +p95(off).toFixed(2),
               deltaMed: +(med(on) - med(off)).toFixed(3), rung: g.state.perfRung }
    }, FL)
    out.rows[name] = r
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-frametime-v5.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
