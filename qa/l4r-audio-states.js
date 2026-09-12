async page => {
  // l4r-audio-states: (1) the first 16 s after the picker key in Sydney — is the
  // score there? (2) the score ALONE (sfx muted) in three mix states: calm
  // (still 20 s), chase (npc:chase emitted every 3 s while running), celebrate
  // (music.swell(1) held) — RMS, centroid, band share per state. The question
  // is whether the states are measurably different.
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => {
    try { localStorage.clear() } catch (e) {}
    const AC = window.AudioContext || window.webkitAudioContext
    const orig = AC.prototype.createDynamicsCompressor
    AC.prototype.createDynamicsCompressor = function () {
      const n = orig.call(this)
      if (!window.__tap) {
        const an = this.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0
        n.connect(an)
        window.__tap = { an: an, comp: n, ac: this }
      }
      return n
    }
  })
  const out = {}
  const meter = (secs, tag) => page.evaluate(async ([secs, tag]) => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const t = window.__tap, ac = t.ac, an = t.an
    const N = an.frequencyBinCount, f = new Float32Array(N), td = new Float32Array(an.fftSize)
    const hz = i => i * ac.sampleRate / an.fftSize
    let s2 = 0, n = 0, pk = 0, cw = 0, cs = 0, lo = 0, mid = 0, hi = 0, top = 0
    const t0 = performance.now(), rows = []
    let sec = 0, ws2 = 0, wn = 0
    while (performance.now() - t0 < secs * 1000) {
      an.getFloatTimeDomainData(td); an.getFloatFrequencyData(f)
      let a2 = 0, p = 0
      for (let i = 0; i < td.length; i++) { const v = td[i]; a2 += v * v; const a = v < 0 ? -v : v; if (a > p) p = a }
      s2 += a2 / td.length; n++; if (p > pk) pk = p; ws2 += a2 / td.length; wn++
      for (let i = 1; i < N; i++) { const q = Math.pow(10, f[i] / 10), h = hz(i); cw += q * h; cs += q; if (h < 250) lo += q; else if (h < 2000) mid += q; else if (h < 5000) hi += q; else top += q }
      const s = Math.floor((performance.now() - t0) / 1000)
      if (s !== sec) { rows.push(+(20 * Math.log10(Math.max(1e-6, Math.sqrt(ws2 / Math.max(1, wn))))).toFixed(1)); ws2 = 0; wn = 0; sec = s }
      await sleep(40)
    }
    const rms = Math.sqrt(s2 / Math.max(1, n)), tot = lo + mid + hi + top
    const g = window.__capy, m = g.musAudit()
    return { tag, rms: +(20 * Math.log10(Math.max(1e-6, rms))).toFixed(1), pk: +(20 * Math.log10(Math.max(1e-6, pk))).toFixed(1),
             cent: Math.round(cw / Math.max(1e-12, cs)), lo: +(lo / tot * 100).toFixed(1), mid: +(mid / tot * 100).toFixed(1), hi: +(hi / tot * 100).toFixed(1), top: +(top / tot * 100).toFixed(2),
             perSec: rows, pad: m.pad, bass: m.bass, intensity: m.intensity, breath: m.breath, chase: g.hud.mixAudit().chase, calm: +g.calm().toFixed(2), state: ac.state }
  }, [secs, tag])

  // ---- (1) the first 16 s of Sydney ------------------------------------
  await page.goto('http://localhost:5188/'); await page.waitForTimeout(5000)
  const pre = await page.evaluate(() => { const t = window.__tap; return { tapped: !!t, state: t && t.ac.state } })
  await page.keyboard.press('Digit1')
  const open = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const t = window.__tap, an = t.an, td = new Float32Array(an.fftSize), rows = []
    const t0 = performance.now()
    while (performance.now() - t0 < 16000) {
      an.getFloatTimeDomainData(td); let a2 = 0; for (let i = 0; i < td.length; i++) a2 += td[i] * td[i]
      const g = window.__capy, m = g.musAudit()
      rows.push({ t: +((performance.now() - t0) / 1000).toFixed(1), rms: +(20 * Math.log10(Math.max(1e-6, Math.sqrt(a2 / td.length)))).toFixed(0), ac: t.ac.state, started: g.state.started, pad: m.pad, duck: m.duck, dc: m.duckCross, busy: m.busy, pal: m.pal })
      await sleep(500)
    }
    return rows
  })
  out.pre = pre; out.open = open
  // ---- (2) the states, score only ---------------------------------------
  await page.evaluate(() => { const g = window.__capy; g.hud.setSfxVolume(0, true) })
  await page.waitForTimeout(2000)
  out.calm = await meter(20, 'calm: still 20 s')
  const k = page.keyboard
  const chaseP = meter(20, 'chase: npc:chase every 3 s, running')
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => { const g = window.__capy; g.events.emit('npc:chase', { authority: false }) })
    await k.down('ShiftLeft'); await k.down('KeyW'); await page.waitForTimeout(2500); await k.up('KeyW'); await k.up('ShiftLeft')
    await k.press('KeyQ'); await page.waitForTimeout(500)
  }
  out.chase = await chaseP
  await page.waitForTimeout(6000)
  const celP = meter(12, 'celebrate: music.swell(1) held')
  for (let i = 0; i < 24; i++) { await page.evaluate(() => window.__capy.music.swell(1)); await page.waitForTimeout(500) }
  out.celebrate = await celP
  await page.waitForTimeout(8000)
  const liveP = meter(10, 'live: wowLive(line, t) held')
  for (let i = 0; i < 20; i++) { await page.evaluate(() => { try { window.__capy.wowLive('probe', 0.5) } catch (e) {} }); await page.waitForTimeout(500) }
  out.live = await liveP
  await page.waitForTimeout(6000)
  out.after = await meter(10, 'after: still again')
  // stings, one at a time, measure each in isolation
  out.stings = {}
  for (const s of ['arrive', 'record', 'act', 'done', 'keep', 'wear']) {
    const p = meter(3, s)
    await page.waitForTimeout(100)
    const n = await page.evaluate((s) => window.__capy.hud.stingAudit(s), s)
    out.stings[s] = Object.assign({ notes: n }, await p)
    await page.waitForTimeout(2500)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4r-audio-states.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
