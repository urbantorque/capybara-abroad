async page => {
  // l4-audio-world (E2, audio #5): two questions, both in Sydney with real
  // keys. (1) Is the speech duck a state or an event? 60 s standing at the
  // spawn, musAudit().speak sampled at 4 Hz: the mean, the share of samples
  // over 0.5, the blip count. (2) Does the world make room for a sting? Music
  // at volume 0 (the stings still fire — only `musMuted` gates them), master
  // tapped after the limiter, RMS in 100 ms windows for 0.6 s before and 2.4 s
  // after hud.stingAudit('done'), four times: the drop within 0.3 s against
  // the pre-window median, and the time the level is back within 1 dB.
  // Output: qa/l4-audio-world.json.png.
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
  await page.goto('http://localhost:5188/'); await page.waitForTimeout(5000)
  await page.keyboard.press('Digit1'); await page.waitForTimeout(9000)     // the arrival shot and the card
  const out = {}
  // ---- (1) the speech term, 60 s ------------------------------------------
  out.speak = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const g = window.__capy
    const m0 = g.musAudit(), blip0 = m0.speakN || 0
    const rows = []; let sum = 0, over = 0, n = 0
    const t0 = performance.now()
    while (performance.now() - t0 < 60000) {
      const m = g.musAudit(); const s = m.speak || 0
      rows.push(s); sum += s; if (s > 0.5) over++; n++
      await sleep(250)
    }
    const m1 = g.musAudit()
    return { n, mean: +(sum / Math.max(1, n)).toFixed(3), over05: +(over / Math.max(1, n)).toFixed(3),
             blips: (m1.speakN || 0) - blip0, pad: m1.pad, biome: g.biome.current,
             trace: rows.filter((_, i) => i % 4 === 0).map(v => +v.toFixed(2)) }
  })
  // ---- (2) the world under a sting, music at 0 -------------------------------
  // The world in Sydney is gulls and a plane, and a gull in the window is
  // +15 dB — the first run of this measured the world's own randomness and
  // nothing else. So a steady tone is put INTO the world bus (acSfxIn, via
  // game.music.taps.sfx) at −22 dBFS, over the world's own −32: what the
  // master then shows is the bus's gain, which is the thing being tested.
  await page.evaluate(() => {
    const g = window.__capy; g.hud.setMusicVolume(0, true)
    const ac = window.__tap.ac, o = ac.createOscillator(), gn = ac.createGain()
    o.frequency.value = 220; gn.gain.value = 0.08; o.connect(gn); gn.connect(g.music.taps.sfx); o.start()
  })
  await page.waitForTimeout(3000)
  out.sting = []
  for (let k = 0; k < 6; k++) {
    const r = await page.evaluate(async () => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
      const g = window.__capy, t = window.__tap, an = t.an
      const td = new Float32Array(an.fftSize)
      const win = () => { an.getFloatTimeDomainData(td); let s = 0; for (let i = 0; i < td.length; i++) s += td[i] * td[i]; return 10 * Math.log10(Math.max(1e-12, s / td.length)) }
      const pre = [], post = []
      for (let i = 0; i < 6; i++) { pre.push(win()); await sleep(100) }
      const notes = g.hud.stingAudit('done')
      const t0 = performance.now()
      const ducks = []
      for (let i = 0; i < 24; i++) { post.push(win()); ducks.push(g.musAudit().worldDuck); await sleep(100) }
      const med = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)] }
      const base = med(pre)
      const d03 = Math.min(post[1], post[2], post[3]) - base
      let back = null
      for (let i = 4; i < post.length; i++) { if (post[i] >= base - 1) { back = +((i + 1) * 0.1).toFixed(1); break } }
      return { notes, base: +base.toFixed(1), drop03: +d03.toFixed(1), backAt: back, ms: Math.round(performance.now() - t0),
               post: post.map(v => +(v - base).toFixed(1)), duck: ducks.filter((_, i) => i % 2 === 0).map(v => v === null ? null : +v.toFixed(2)) }
    })
    out.sting.push(r)
    await page.waitForTimeout(3000)
  }
  // The world is gulls and a plane: any one window can carry a one-shot, so the
  // verdict is the median of the runs, and the duck param's own trace is the
  // proof the writer wrote.
  const med = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)] }
  out.stingSummary = {
    drop03Median: med(out.sting.map(s => s.drop03)),
    backAtMedian: med(out.sting.map(s => s.backAt === null ? 9 : s.backAt)),
    duckMin: Math.min(...out.sting.map(s => Math.min(...s.duck.map(v => v === null ? 1 : v)))),
  }
  out.state = await page.evaluate(() => ({ ac: window.__tap && window.__tap.ac.state, err: window.__capy.state.lastError || null, audit: window.__capy.musAudit() }))
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4-audio-world.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
