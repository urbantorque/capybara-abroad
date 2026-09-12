async page => {
  // l4r-audio-record: listen by measurement. Taps the master AFTER the limiter
  // (wrapping createDynamicsCompressor before boot) and the score bus
  // (game.music.bus), plays a chapter for ~80 s with REAL keys (walk, run, hop,
  // wheek, grab, slide), and bins the two taps into 1 s windows: RMS dBFS,
  // peak, crest, spectral centroid, band energy. Also counts distinct sfx
  // names via a wrapper on game.sfx plus hud.ambAudit for the ladder.
  const chapterKey = { sydney: 'Digit1', kowloon: 'Minus', cave: 'Quote', hanoi: 'Slash', venice: 'Digit0', rio: 'Digit6' }
  const which = ['sydney', 'kowloon', 'cave']
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
  for (const ch of which) {
    await page.goto('http://localhost:5188/'); await page.waitForTimeout(5000)
    await page.keyboard.press(chapterKey[ch]); await page.waitForTimeout(1500)
    // wrap game.sfx to count names, reset the ladder log, hang an analyser on the score bus
    await page.evaluate(() => {
      const g = window.__capy
      window.__sfxN = {}
      const o = g.sfx
      g.sfx = function (name, opts) { window.__sfxN[name] = (window.__sfxN[name] || 0) + 1; return o.apply(this, arguments) }
      try { g.hud.ambAudit(true) } catch (e) {}
      try {
        const t = window.__tap
        if (t && g.music && g.music.bus) {
          const an = t.ac.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0
          g.music.bus.connect(an); t.mus = an
        }
      } catch (e) { window.__musTapErr = String(e) }
    })
    // start the sampler (not awaited)
    const sampler = page.evaluate(async (secs) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
      const t = window.__tap; if (!t) return { err: 'no tap' }
      const ac = t.ac
      const mk = (an) => ({ an, N: an.frequencyBinCount, f: new Float32Array(an.frequencyBinCount), td: new Float32Array(an.fftSize) })
      const M = mk(t.an), S = t.mus ? mk(t.mus) : null
      const hz = i => i * ac.sampleRate / t.an.fftSize
      const win = (x) => ({ s2: 0, n: 0, pk: 0, cw: 0, cs: 0, lo: 0, mid: 0, hi: 0, top: 0, red: 0 })
      const rows = [], srows = []
      let cur = win(), scur = S ? win() : null, t0 = performance.now(), last = 0
      const feed = (X, w) => {
        X.an.getFloatTimeDomainData(X.td); X.an.getFloatFrequencyData(X.f)
        let s2 = 0, pk = 0
        for (let i = 0; i < X.td.length; i++) { const v = X.td[i]; s2 += v * v; const a = v < 0 ? -v : v; if (a > pk) pk = a }
        w.s2 += s2 / X.td.length; w.n++; if (pk > w.pk) w.pk = pk
        let cw = 0, cs = 0, lo = 0, mid = 0, hi = 0, top = 0
        for (let i = 1; i < X.N; i++) {
          const p = Math.pow(10, X.f[i] / 10), h = hz(i)
          cw += p * h; cs += p
          if (h < 250) lo += p; else if (h < 2000) mid += p; else if (h < 5000) hi += p; else top += p
        }
        w.cw += cw; w.cs += cs; w.lo += lo; w.mid += mid; w.hi += hi; w.top += top
      }
      const fin = (w) => {
        const rms = Math.sqrt(w.s2 / Math.max(1, w.n))
        const tot = w.lo + w.mid + w.hi + w.top
        return { rms: +(20 * Math.log10(Math.max(1e-6, rms))).toFixed(1),
                 pk: +(20 * Math.log10(Math.max(1e-6, w.pk))).toFixed(1),
                 crest: +(20 * Math.log10(Math.max(1e-6, w.pk) / Math.max(1e-6, rms))).toFixed(1),
                 cent: Math.round(w.cw / Math.max(1e-12, w.cs)),
                 lo: +(w.lo / Math.max(1e-12, tot) * 100).toFixed(1), mid: +(w.mid / Math.max(1e-12, tot) * 100).toFixed(1),
                 hi: +(w.hi / Math.max(1e-12, tot) * 100).toFixed(1), top: +(w.top / Math.max(1e-12, tot) * 100).toFixed(2),
                 red: w.red }
      }
      while (performance.now() - t0 < secs * 1000) {
        feed(M, cur); if (S) feed(S, scur)
        if (t.comp.reduction < -1) cur.red++
        const sec = Math.floor((performance.now() - t0) / 1000)
        if (sec !== last) { rows.push(fin(cur)); if (S) srows.push(fin(scur)); cur = win(); if (S) scur = win(); last = sec }
        await sleep(40)
      }
      return { master: rows, score: srows, sr: ac.sampleRate, state: ac.state }
    }, 84)
    // the walk, with real keys. ~80 s.
    const k = page.keyboard
    const hold = async (key, ms) => { await k.down(key); await page.waitForTimeout(ms); await k.up(key) }
    await page.waitForTimeout(9000)                       // arrival shot + phrase + stand still
    await hold('KeyW', 4000)
    await k.press('Space'); await page.waitForTimeout(800)
    await k.press('KeyQ'); await page.waitForTimeout(1500)
    await k.down('ShiftLeft'); await hold('KeyW', 5000); await k.up('ShiftLeft')
    await k.press('KeyG'); await page.waitForTimeout(1200)
    await hold('KeyA', 1200); await hold('KeyW', 3500)
    await k.press('KeyE'); await page.waitForTimeout(600); await k.press('KeyE'); await page.waitForTimeout(800)
    await k.press('KeyQ'); await page.waitForTimeout(500); await k.press('KeyQ'); await page.waitForTimeout(2000)
    await k.press('Space'); await page.waitForTimeout(400); await k.press('Space'); await page.waitForTimeout(1500)
    await hold('KeyD', 1500); await k.down('ShiftLeft'); await hold('KeyW', 6000); await k.up('ShiftLeft')
    await page.waitForTimeout(12000)                       // stand still: the calm
    await hold('KeyS', 2500); await k.press('KeyQ'); await page.waitForTimeout(3000)
    await k.down('ShiftLeft'); await hold('KeyW', 4000); await k.up('ShiftLeft')
    await page.waitForTimeout(14000)                       // still again
    const rec = await sampler
    const tail = await page.evaluate(() => {
      const g = window.__capy
      let amb = null, mus = null, mix = null, room = null, mov = null
      try { amb = g.hud.ambAudit() } catch (e) {}
      try { mus = g.musAudit() } catch (e) {}
      try { mix = g.hud.mixAudit() } catch (e) {}
      try { room = g.hud.roomAudit() } catch (e) {}
      try { mov = g.hud.moverAudit() } catch (e) {}
      return { sfxNames: window.__sfxN, amb, mus, mix, room, mov, musTapErr: window.__musTapErr || null,
               biome: g.biome && g.biome.current, err: g.state.lastError || null }
    })
    out[ch] = Object.assign({}, rec, tail)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4r-audio-record.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
