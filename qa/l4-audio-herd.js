async page => {
  // l4-audio-herd: does the herd answer one by one? Stand in the middle of the
  // Pantanal's campo cattle (the densest cluster of the thirteen offered cows,
  // from game.herdDebug(true)), wheek once on a REAL key, and count what comes
  // back inside 1.2 s: placed answers (every StereoPanner sfx() built after
  // the key — the constructor is hooked), their pan spread, and for a
  // wheek-voiced herd how far each answer's base sits from a tone of the chord
  // the score was on (hud.herdAudit()). Before L4 the answers were un-placed,
  // on the same frame, and the per-name gap left one: placed = 0, audible <= 1.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)) })
  await page.setViewportSize({ width: 1200, height: 700 })
  await page.addInitScript(() => {
    try { localStorage.clear() } catch (e) {}
    const AC = window.AudioContext || window.webkitAudioContext
    const orig = AC.prototype.createStereoPanner
    window.__pans = []
    AC.prototype.createStereoPanner = function () {
      const n = orig.call(this)
      window.__pans.push({ t: this.currentTime, n: n })
      return n
    }
  })
  // The Pantanal's thirteen cows graze up to 13 m from home and measured two
  // in earshot of the densest spot, so the sheep (fourteen, wheek-voiced, and
  // a flock) and the gentoos (forty-two) are asked as well.
  const out = { runs: [], errs }
  for (const [key, kind] of [['Semicolon', 'cow'], ['Digit7', 'sheep'], ['Comma', 'gentoo']]) {
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  await page.keyboard.press(key)
  await page.waitForTimeout(10000)
  const place = await page.evaluate((kind) => {
    const g = window.__capy
    g.completeTask('gather', true)                 // the herd skill
    const H = g.herdDebug(true)
    const K = H.kinds.find(k => k.kind === kind)
    if (!K || !K.pts || !K.pts.length) return { err: 'no ' + kind, H }
    // the cow with the most others within 14 m; stand a metre from it
    let best = null, bestN = -1
    for (const p of K.pts) {
      let n = 0
      for (const q of K.pts) if (Math.hypot(q[0] - p[0], q[2] - p[2]) < 14) n++
      if (n > bestN) { bestN = n; best = p }
    }
    const b = g.capy.body
    b.position.set(best[0] + 1.0, best[1] + 0.6, best[2] + 1.0)
    b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    return { biome: H.biome, kind: kind, n: K.n, voice: K.voice, within14: bestN, at: best, can: g.capy.can('herd') }
  }, kind)
  if (place.err) { out.runs.push({ place }); continue }
  await page.waitForTimeout(2500)
  const pre = await page.evaluate((kind) => {
    const g = window.__capy
    const p = g.capy.position
    const K = g.herdDebug(true).kinds.find(k => k.kind === kind)
    let within15 = 0
    for (const q of K.pts) if (Math.hypot(q[0] - p.x, q[2] - p.z) <= 15) within15++
    window.__pan0 = window.__pans.length
    window.__t0 = g.hud.audioBus().ac.currentTime
    return { within15, capy: { x: +p.x.toFixed(1), z: +p.z.toFixed(1) }, chord: g.hud.herdAudit().chord }
  }, kind)
  await page.keyboard.press('KeyQ')               // a real key: the wheek
  await page.waitForTimeout(1700)
  const res = await page.evaluate(() => {
    const g = window.__capy
    const A = g.hud.herdAudit()
    // distinct (time, pan): a playwright-cli session keeps every run-code's
    // init script, so a hook registered twice reports each panner twice
    const seen = new Set()
    const pans = window.__pans.slice(window.__pan0).map(r => ({ dt: +(r.t - window.__t0).toFixed(3), pan: +r.n.pan.value.toFixed(3) }))
      .filter(r => { const k = r.dt + '/' + r.pan; if (seen.has(k)) return false; seen.add(k); return true })
    const within = pans.filter(r => r.dt <= 1.25)
    const spread = within.length ? Math.max(...within.map(r => r.pan)) - Math.min(...within.map(r => r.pan)) : 0
    // cents from the nearest chord tone, octaves folded
    const cents = A.answers.filter(a => a.tuned).map(a => {
      const midi = 69 + 12 * Math.log2(a.hz / 440)
      let best = 1e9
      for (const c of (A.chord || [])) { let n = c; while (n < midi - 6) n += 12; while (n > midi + 6) n -= 12; best = Math.min(best, Math.abs(n - midi) * 100) }
      return +best.toFixed(1)
    })
    const ansIn = A.answers.filter(a => a.dt <= 1.2)
    const ansSpread = ansIn.length ? Math.max(...ansIn.map(a => a.pan)) - Math.min(...ansIn.map(a => a.pan)) : 0
    return { placedWithin1_2: within.filter(r => r.dt <= 1.2).length, placedAll: pans.length, pans, spread: +spread.toFixed(3),
             answersWithin1_2: ansIn.length, answerSpread: +ansSpread.toFixed(3),
             audit: A, cents, centsMax: cents.length ? Math.max(...cents) : null }
  })
  out.runs.push({ place, pre, res })
  }
  await page.evaluate((o) => fetch('/shot?name=l4-audio-herd.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
