async page => {
  // l4r-audio-open: the first 16 s after Digit1 on a fresh file, three times.
  // Two of three earlier runs measured 12 s of digital silence at the master.
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => {
    try { localStorage.clear() } catch (e) {}
    const AC = window.AudioContext || window.webkitAudioContext
    const orig = AC.prototype.createDynamicsCompressor
    window.__ctxN = 0
    const origCtor = AC
    AC.prototype.createDynamicsCompressor = function () {
      const n = orig.call(this)
      window.__ctxN++
      if (!window.__tap) {
        const an = this.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0
        n.connect(an)
        window.__tap = { an: an, comp: n, ac: this }
      }
      return n
    }
  })
  const out = []
  for (let run = 0; run < 3; run++) {
    await page.goto('http://localhost:5188/'); await page.waitForTimeout(5000)
    await page.keyboard.press('Digit1')
    out.push(await page.evaluate(async () => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
      const t = window.__tap, an = t.an, td = new Float32Array(an.fftSize), rows = []
      const t0 = performance.now()
      let firstSound = -1
      while (performance.now() - t0 < 16000) {
        an.getFloatTimeDomainData(td); let a2 = 0; for (let i = 0; i < td.length; i++) a2 += td[i] * td[i]
        const rms = 20 * Math.log10(Math.max(1e-6, Math.sqrt(a2 / td.length)))
        const el = (performance.now() - t0) / 1000
        if (rms > -80 && firstSound < 0) firstSound = el
        const g = window.__capy
        rows.push({ t: +el.toFixed(1), rms: +rms.toFixed(0), ac: t.ac.state, ct: +t.ac.currentTime.toFixed(2), started: g.state.started, pal: g.musAudit().pal, pad: g.musAudit().pad })
        await sleep(500)
      }
      return { firstSound, ctxN: window.__ctxN, rows }
    }))
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4r-audio-open.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
