async page => {
  // T4d, noPanWarm audit: does anything in the Pantanal link a program AFTER
  // the white card drops? Real clock, fresh profile, cross from Sydney.
  //  - renderer.info.programs.length at the hold's release, 3 s on, and after
  //    the dormant things wake (dusk, the fireflies, the onça, the egrets)
  //  - warmN / warmMs from systems.js's biomeWarm (the L6 E8 warm)
  //  - rAF frame times: the first 3 s after the release against 3 s steady
  //    (a contended laptop: indicative only; the proof slot owns the number)
  // TAG is rewritten between runs (run-code takes no argument).
  const NAME = 'ten-t4d-warm'
  const TAG = 'live'
  const PORT = 5194
  const out = { tag: TAG }
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:' + PORT + '/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() }); await page.waitForTimeout(7000)
  out.from = await page.evaluate(() => window.__capy.biome.current)
  await page.evaluate(tag => {
    const g = window.__capy
    if (tag === 'off') g.state.noPanWarm = true
    window.__t4dW = { f: [], progHold: null, tHold: null, prog0: g.renderer.info.programs.length, holdSeen: false }
    const W = window.__t4dW
    let last = performance.now()
    const loop = () => {
      const now = performance.now()
      const hold = !!g.state.renderHold
      if (hold) W.holdSeen = true
      if (W.holdSeen && !hold && W.tHold === null && g.biome.current === 'pantanal') {
        W.tHold = now; W.progHold = g.renderer.info.programs.length
      }
      if (W.tHold !== null) W.f.push([+(now - W.tHold).toFixed(1), +(now - last).toFixed(1), g.renderer.info.programs.length])
      last = now
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
    g.state.journeyMode = 'free'
    g.hud.cross('pantanal')
  }, TAG)
  await page.waitForTimeout(20000)
  out.a = await page.evaluate(() => {
    const g = window.__capy, W = window.__t4dW
    const first = W.f.filter(r => r[0] < 3000).map(r => r[1]).sort((a, b) => a - b)
    const steady = W.f.filter(r => r[0] > 8000 && r[0] < 11000).map(r => r[1]).sort((a, b) => a - b)
    const q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : null
    const at = t => { const r = W.f.filter(x => x[0] <= t); return r.length ? r[r.length - 1][2] : null }
    return { biome: g.biome.current, warmN: g.state.warmN, warmMs: g.state.warmMs, prog0: W.prog0,
             progHold: W.progHold, prog3s: at(3000), prog10s: at(10000),
             first: { n: first.length, p50: q(first, 0.5), p95: q(first, 0.95), max: first[first.length - 1] },
             steady: { n: steady.length, p50: q(steady, 0.5), p95: q(steady, 0.95) },
             firstFrames: W.f.slice(0, 8) }
  })
  // ---- the dormant things wake: dusk, fireflies, the onça, the egrets --
  out.wake = await page.evaluate(async () => {
    const g = window.__capy, P = g.pantanal
    const p0 = g.renderer.info.programs.length
    P.forceJaguar()
    await new Promise(r => setTimeout(r, 6000))
    const j = P.jaguarDebug()
    return { p0: p0, p1: g.renderer.info.programs.length, jag: j.st, jagVis: j.visible, dusk: j.dusk }
  })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME + '-' + TAG, out })
}
