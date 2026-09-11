async page => {
  // every errand in the game runs once: stand in each chapter 75 s and count
  // deliveries, stalls (an errand that never arrives) and errors
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  const out = { rows: [], errs }
  const KEYS = { pantanal: 'Semicolon' }
  for (const ch in KEYS) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(4800)
    await page.keyboard.press(KEYS[ch])
    await page.waitForTimeout(6000)
    await page.evaluate(() => { for (const r of window.__capy.locals) if (r.errand) r.errT = Math.min(r.errT, 2) })
    const r = await page.evaluate(() => new Promise((res) => {
      const g = window.__capy; const live = g.biome.current
      const t0 = performance.now(); const seen = {}
      const iv = setInterval(() => {
        for (const r of g.locals) { if (r.biome !== live || !r.errand) continue; const k = r.errand.carry + '@' + Math.round(r.ax); const s = seen[k] || (seen[k] = { phases: {}, n: 0, maxD: 0 }); s.phases[r.errPhase || 'idle'] = 1; s.n = r.errN; if (r.errPhase === 'out') s.maxD = Math.max(s.maxD, Math.hypot(r.x - r.ax, r.z - r.az)) }
        if (performance.now() - t0 > 40000) { clearInterval(iv); res({ biome: live, errands: seen, err: g.state.lastError || null }) }
      }, 250)
    }))
    out.rows.push(r)
  }
  await page.evaluate((o) => fetch('/shot?name=l3-errand2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), out)
}
