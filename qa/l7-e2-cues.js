async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)) })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => {
    try { localStorage.clear() } catch (e) {}
    const AC = window.AudioContext || window.webkitAudioContext
    const orig = AC.prototype.createDynamicsCompressor
    AC.prototype.createDynamicsCompressor = function () {
      const n = orig.call(this)
      if (!window.__tap) { const an = this.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0; n.connect(an); window.__tap = { an: an, comp: n, ac: this } }
      return n
    }
  })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  for (let w = 0; w < 30; w++) { const st = await page.evaluate(() => window.__tap && window.__tap.ac.state); if (st === 'running') break; await page.waitForTimeout(500) }
  const out = { errs, started: await page.evaluate(() => window.__capy.state.started) }
  await page.evaluate(() => {
    const g = window.__capy, t = window.__tap
    window.__stems = {}
    const mk = (node) => { const an = t.ac.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0; node.connect(an); return an }
    try { window.__stems.music = mk(g.music.taps.vol) } catch (e) {}
    try { window.__stems.bass = mk(g.music.taps.bass) } catch (e) {}
    try { window.__stems.pluck = mk(g.music.taps.pluck) } catch (e) {}
    try { window.__stems.drum = mk(g.music.taps.drum) } catch (e) {}
    window.__sfxLog = []
    const o = g.sfx
    g.sfx = function (name, opts) { if (window.__sfxLog.length < 600) window.__sfxLog.push([+(performance.now() / 1000).toFixed(2), name]); return o.apply(this, arguments) }
  })
  // rms of a stem over a window, dB; and the max over 100 ms frames
  const rmsMax = (stem, ms) => page.evaluate(async ([stem, ms]) => {
    function sleep(x) { return new Promise(r => setTimeout(r, x)) }
    const an = window.__stems[stem]; if (!an) return null
    const td = new Float32Array(2048); let mx = -120; const t0 = performance.now()
    while (performance.now() - t0 < ms) { an.getFloatTimeDomainData(td); let a2 = 0; for (let i = 0; i < td.length; i++) a2 += td[i] * td[i]; const db = 10 * Math.log10(Math.max(1e-12, a2 / td.length)); if (db > mx) mx = db; await sleep(25) }
    return +mx.toFixed(1)
  }, [stem, ms])
  // 1. the denial: npc:caught -> cueDenied +1 within 300 ms, and the bass stem moves
  out.denied = await page.evaluate(async () => {
    function sleep(x) { return new Promise(r => setTimeout(r, x)) }
    const g = window.__capy
    const an = window.__stems.bass, td = new Float32Array(2048)
    const rms = () => { an.getFloatTimeDomainData(td); let a2 = 0; for (let i = 0; i < td.length; i++) a2 += td[i] * td[i]; return 10 * Math.log10(Math.max(1e-12, a2 / td.length)) }
    let before = -120; for (let i = 0; i < 8; i++) { before = Math.max(before, rms()); await sleep(25) }
    const m0 = g.musAudit(); window.__sfxLog = []
    g.events.emit('npc:caught', { x: 0, z: 0 })
    await sleep(300)
    const m1 = g.musAudit()
    let after = -120; for (let i = 0; i < 12; i++) { after = Math.max(after, rms()); await sleep(25) }
    return { cueDenied: m1.cueDenied - m0.cueDenied, sfx300: window.__sfxLog.map(r => r[1]), bassBefore: +before.toFixed(1), bassAfter: +after.toFixed(1) }
  })
  await page.waitForTimeout(2000)
  // 2. the exit zone: stand on the wharf -> cueExit +1 within 300 ms, and the ladder log shows the destination's signature
  out.exit = await page.evaluate(async () => {
    function sleep(x) { return new Promise(r => setTimeout(r, x)) }
    const g = window.__capy
    try { g.hud.ambAudit(true) } catch (e) {}
    const m0 = g.musAudit()
    const body = g.capy.body
    if (body) { body.position.set(-40, 1.2, -20.5); body.velocity.set(0, 0, 0) } else { g.capy.position.set(-40, 1.2, -20.5) }
    await sleep(300)
    const m1 = g.musAudit()
    await sleep(1200)
    const m2 = g.musAudit()
    const amb = g.hud.ambAudit()
    return { cueExit300: m1.cueExit - m0.cueExit, cueExit1500: m2.cueExit - m0.cueExit, amb: amb.tally, pos: [+g.capy.position.x.toFixed(1), +g.capy.position.z.toFixed(1)], home: !!document.querySelector('.capyui-home.show, .capy-home.show') }
  })
  // 3. the clock, the window and the arm, on Hanoi's train (96 s between trains, 11 s of horn)
  await page.evaluate(() => window.__capy.hud.cross('hanoi')); await page.waitForTimeout(9000)
  out.clock = await page.evaluate(async () => {
    function sleep(x) { return new Promise(r => setTimeout(r, x)) }
    const g = window.__capy
    const mp = g.marqueePoint()
    if (!mp) return { err: 'no marquee point' }
    let ty = mp.y; try { if (typeof g.groundY === 'function') ty = g.groundY(mp.x - 3, mp.z) } catch (e) {}
    const body = g.capy.body
    if (body) { body.position.set(mp.x - 3, ty + 0.6, mp.z); body.velocity.set(0, 0, 0) } else { g.capy.position.set(mp.x - 3, ty + 0.6, mp.z) }
    return { mp: [+mp.x.toFixed(1), +mp.z.toFixed(1)], live: mp.live }
  })
  await page.waitForTimeout(1500)
  // poll nextIn until it enters the last ten seconds, then measure the cue within 300 ms; then the open
  let res = null
  for (let k = 0; k < 8 && !res; k++) {
    res = await page.evaluate(async () => {
      function sleep(x) { return new Promise(r => setTimeout(r, x)) }
      const g = window.__capy
      const api = g.biome && g.biome.api ? g.biome.api : null
      const nextIn = () => { try { return g.todoNextIn ? g.todoNextIn() : (window.__capy.hud.nextIn ? window.__capy.hud.nextIn() : -2) } catch (e) { return -3 } }
      const t0 = performance.now()
      let firstTen = null, firstOpen = null, tickAt10 = null, tickAt10b = null, openAt = null, armedAt = null, nxSeen = []
      let last = null
      while (performance.now() - t0 < 19000) {
        const m = g.musAudit()
        const nx = m.nextIn !== undefined ? m.nextIn : null
        nxSeen.push(nx)
        if (firstTen === null && nx !== null && nx > 0 && nx <= 10) { firstTen = performance.now(); tickAt10 = m.cueTick; await sleep(300); tickAt10b = g.musAudit().cueTick; continue }
        if (firstTen !== null && firstOpen === null && nx !== null && nx < 1) { firstOpen = performance.now(); const a = g.musAudit(); await sleep(300); const b = g.musAudit(); openAt = b.cueOpen - a.cueOpen + (b.cueOpen > a.cueOpen ? 0 : 0); armedAt = b.cueArmed; return { done: true, nx0: nxSeen[0], tickDelta300: tickAt10b - tickAt10, tickTotal: b.cueTick, open300: b.cueOpen - a.cueOpen, openTotal: b.cueOpen, armed: b.cueArmed, sting: b.stingEnv, err: g.state.lastError || null } }
        await sleep(50)
      }
      return firstTen !== null ? { done: false, partial: true, tickDelta300: tickAt10b - tickAt10, nxLast: nxSeen[nxSeen.length - 1] } : null
    })
  }
  out.cues = res
  out.errsN = errs.length
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l7-e2-cues.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
