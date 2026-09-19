async page => {
  // ROADMAP-WOW W5 — the interleaved rAF A/B: every term this pass added,
  // live vs cut, per chapter, on a machine with nothing else running. The
  // harness is headless (software GL), so the ABSOLUTE numbers are not the
  // reference machine's 16.7; the DELTA between arms is what this reads.
  const FL = ['noReflect', 'noGrass', 'noMist', 'noRays', 'noSky2', 'noDapple', 'noFore', 'noRound',
              'noCapyRim', 'noSkitter', 'noFleetGlow', 'noCaustic', 'noSpill']
  const NAMES = ['sydney', 'kyoto', 'pantanal', 'monaco', 'hanoi', 'sahara', 'iceland', 'goreme']
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
      return { biome: g.biome.current, onMed: +med(on).toFixed(2), onP95: +p95(on).toFixed(2), offMed: +med(off).toFixed(2), offP95: +p95(off).toFixed(2), rung: g.state.perfRung }
    }, FL)
    out.rows[name] = r
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=wow-frametime.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
