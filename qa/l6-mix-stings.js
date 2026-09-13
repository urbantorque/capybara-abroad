async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => {
    try { localStorage.clear() } catch (e) {}
    const AC = window.AudioContext || window.webkitAudioContext
    const orig = AC.prototype.createDynamicsCompressor
    AC.prototype.createDynamicsCompressor = function () {
      const n = orig.call(this)
      if (!window.__tap) {
        const an = this.createAnalyser(); an.fftSize = 4096; an.smoothingTimeConstant = 0
        n.connect(an)
        window.__tap = { an: an, comp: n, ac: this }
      }
      return n
    }
  })
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(5000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  const out = { errs, started: await page.evaluate(() => window.__capy.state.started) }
  // the review's sting section, in Sydney (no chapter holds a swell here), with the pad stem tapped
  await page.evaluate(() => {
    const g = window.__capy, t = window.__tap
    window.__stems = {}
    const mk = (node) => { const an = t.ac.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0; node.connect(an); return an }
    try { window.__stems.music = mk(g.music.taps.vol) } catch (e) {}
    try { window.__stems.pad = mk(g.music.taps.pad) } catch (e) {}
    g.hud.setSfxVolume(0, true)
  })
  // a short walk so the calm is 0 (the calm's pad cut would otherwise move under the window), then still
  await page.keyboard.down('KeyW'); await page.waitForTimeout(800); await page.keyboard.up('KeyW')
  // 9 s, not 2.5: the first run's bed rose 6 dB across its six seconds (the arrival's
  // intensity and card were still draining) and `arrive`, the first sting, was judged
  // against a bed that was not one
  await page.waitForTimeout(9000)
  // 100 ms rows of the score and the pad
  const meter = (secs) => page.evaluate(async (secs) => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const S = window.__stems, g = window.__capy
    const ans = { music: S.music, pad: S.pad }
    const acc = {}
    for (const k in ans) acc[k] = { td: new Float32Array(ans[k].fftSize), ws2: 0, wn: 0, rows: [] }
    const env = []
    let slot = 0
    const t0 = performance.now()
    while (performance.now() - t0 < secs * 1000) {
      for (const k in ans) {
        const a = acc[k], an = ans[k]
        an.getFloatTimeDomainData(a.td)
        let a2 = 0
        for (let i = 0; i < a.td.length; i++) { const v = a.td[i]; a2 += v * v }
        a.ws2 += a2 / a.td.length; a.wn++
      }
      const s = Math.floor((performance.now() - t0) / 100)
      if (s !== slot) {
        for (const k in ans) { const a = acc[k]; a.rows.push(+(10 * Math.log10(Math.max(1e-12, a.ws2 / Math.max(1, a.wn)))).toFixed(1)); a.ws2 = 0; a.wn = 0 }
        env.push(g.musAudit().stingEnv); slot = s
      }
      await sleep(20)
    }
    return { music: acc.music.rows, pad: acc.pad.rows, env }
  }, secs)
  const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length)
  const bedRun = await meter(6)
  out.bed = { music: +mean(bedRun.music).toFixed(1), pad: +mean(bedRun.pad).toFixed(1), musicRows: bedRun.music }
  out.stings = {}
  for (const s of ['arrive', 'record', 'done', 'keep', 'act', 'wear']) {
    // a tap of W before each: the nap (26 s of rest puts the score to sleep — E3) and the calm's
    // pad cut would otherwise drift under the window. The bed is the second before the sting.
    await page.keyboard.down('KeyW'); await page.waitForTimeout(300); await page.keyboard.up('KeyW')
    // 4.5 s, not 2.5: the tap releases the calm's pad cut (+4 dB over τ 1.2 s) and at 2.5 s
    // the pad was still rising through the window, so `arrive` and `record` read a pad that
    // did not duck (+0.1 / −1.3) against a bed second that was lower than the sting's own
    await page.waitForTimeout(4500)
    const p = meter(4.5); await page.waitForTimeout(1000)
    const n = await page.evaluate((s) => window.__capy.hud.stingAudit(s), s)
    const r = await p
    const bedM = mean(r.music.slice(0, 9)), bedP = mean(r.pad.slice(0, 9))
    // the loudest 0.5 s window of the score (5 rows), the pad's quietest 0.5 s, and when the pad is back within 1.5 dB of its bed
    let best = -120, bestI = 0
    for (let i = 9; i + 5 <= r.music.length; i++) { const w = mean(r.music.slice(i, i + 5)); if (w > best) { best = w; bestI = i } }
    let padMin = 120, padI = 0
    for (let i = 9; i + 5 <= r.pad.length; i++) { const w = mean(r.pad.slice(i, i + 5)); if (w < padMin) { padMin = w; padI = i } }
    let backAt = -1
    for (let i = padI + 5; i < r.pad.length; i++) { if (r.pad[i] >= bedP - 1.5) { backAt = i; break } }
    out.stings[s] = { notes: n, bed: +bedM.toFixed(1), bedPad: +bedP.toFixed(1), peak05: +best.toFixed(1), over: +(best - bedM).toFixed(1), at: (bestI - 9) / 10,
                      padMin05: +padMin.toFixed(1), padUnder: +(padMin - bedP).toFixed(1), padAt: (padI - 9) / 10,
                      padBackAt: backAt < 0 ? null : +((backAt - padI) / 10).toFixed(1), music: r.music, pad: r.pad, env: r.env }
  }
  out.errsN = errs.length
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6-mix-stings.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
