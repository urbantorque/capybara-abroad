async page => {
  // ROADMAP-WOW3 W5 — THE COMBINED NUMBER, WOW2 AND WOW3 TOGETHER. Nobody has
  // run every flag from both passes in one A/B. Every WOW2 flag (14, the
  // W6 list) plus every WOW3 flag actually added this pass (noRemember,
  // noLens2, noVoice2 — confirmed via `grep -oE "game\.state\.no[A-Za-z0-9]+"
  // src/*.js | sort -u` against every wave's own report, not guessed).
  // Live (all false) vs fully cut (all true), interleaved, 5 reps of 60
  // frames, the same 8 chapters WOW2's own W6 used.
  const FL = ['noAlive', 'noFootfall', 'noTracks', 'noGesture', 'noUmbrella', 'noCompany',
              'noFar', 'noSub2', 'noRainbow', 'noPuddle', 'noStrip', 'noShelf', 'noGlimpse', 'noTut',
              'noRemember', 'noLens2', 'noVoice2']
  const NAMES = ['sydney', 'kyoto', 'pantanal', 'monaco', 'hanoi', 'sahara', 'iceland', 'goreme']
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  // pin governor rung 0 (WOW2 V1's own trap 1): a headless GL box settles at
  // rung 3 on its own and would park every term in BOTH arms, hiding the delta.
  await page.addInitScript(() => { try { localStorage['capy3.prefs.v1'] = JSON.stringify({ v: 1, pf: 1 }) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)
  const out = { errs, flags: FL, rows: {} }
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
      return { biome: g.biome.current, onMed: +med(on).toFixed(2), onP95: +p95(on).toFixed(2),
                offMed: +med(off).toFixed(2), offP95: +p95(off).toFixed(2), rung: g.state.perfRung }
    }, FL)
    out.rows[name] = r
  }
  const deltas = Object.values(out.rows).map(r => r.onMed - r.offMed)
  out.deltaMedMs = +(deltas.reduce((a, b) => a + b, 0) / deltas.length).toFixed(3)
  out.deltaByChap = Object.fromEntries(Object.entries(out.rows).map(([k, r]) => [k, +(r.onMed - r.offMed).toFixed(3)]))
  await page.evaluate(async (o) => { await fetch('/shot?name=wow3-frametime-final.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
