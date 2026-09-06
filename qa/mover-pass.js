async page => {
  // A1 — THE MOVER. Three questions a Web Audio graph cannot be asked from
  // outside any other way: does a pass actually sweep, is the Doppler the right
  // way round, and does the budget ever let more than four voices run.
  //
  // The van is the subject because her route is a known 60 m line at a known
  // 3.15 m/s and she comes back: stand still for a minute and she passes twice.
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')          // the picker takes a digit directly
  await page.waitForTimeout(7000)

  await page.evaluate(() => {
    const g = window.__capy
    // Stand on the promenade beside the van's route, and stay there: a mover
    // measured from a moving ear is measuring the ear.
    g.capy.body.position.set(-30, g.capy.position.y + 0.5, 4)
    g.capy.body.velocity.set(0, 0, 0)
    window.__mv = []
    window.__mvT = setInterval(() => {
      const a = g.hud.moverAudit()
      const pick = (k) => {
        const r = a.rows.filter(x => x.key === k)[0]
        return r ? { d: r.d, gain: r.gain, pan: r.pan, rate: r.rate, k: r.k,
                     amp: r.amp, live: r.live, built: r.built } : null
      }
      window.__mv.push({ t: +g.state.time.toFixed(2), live: a.live, builds: a.builds,
                         van: pick('env:van'), plane: pick('env:plane') })
    }, 250)
  })
  for (let i = 0; i < 14; i++) {
    await page.evaluate(() => new Promise(r => setTimeout(r, 5000)))
  }

  const out = await page.evaluate(() => {
    const g = window.__capy
    clearInterval(window.__mvT)
    const s = window.__mv
    const van = s.filter(r => r.van && r.van.built)
    // The closest approach, and what the pass looked like either side of it.
    let ci = -1, cd = 1e9
    for (let i = 0; i < van.length; i++) if (van[i].van.d < cd) { cd = van[i].van.d; ci = i }
    const near = van.slice(Math.max(0, ci - 8), Math.min(van.length, ci + 9))
        .map(r => ({ t: r.t, d: r.van.d, gain: r.van.gain, pan: r.van.pan, rate: r.van.rate }))
    // APPROACHING MUST BE FASTER THAN ONE. The whole point of the probe.
    const before = van.slice(Math.max(0, ci - 6), ci).map(r => r.van.rate)
    const after = van.slice(ci + 1, ci + 7).map(r => r.van.rate)
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0
    let peakG = 0, peakI = -1
    for (let i = 0; i < van.length; i++) if (van[i].van.gain > peakG) { peakG = van[i].van.gain; peakI = i }
    return {
      biome: g.biome.current,
      lastError: g.state.lastError || null,
      samples: s.length,
      builtSamples: van.length,
      builds: s.length ? s[s.length - 1].builds : 0,
      maxLive: s.reduce((m, r) => Math.max(m, r.live), 0),
      closest: { i: ci, d: +cd.toFixed(2) },
      peakGain: { i: peakI, gain: +peakG.toFixed(4) },
      rateBeforeMean: +mean(before).toFixed(5),
      rateAfterMean: +mean(after).toFixed(5),
      rateSpan: [Math.min.apply(null, van.map(r => r.van.rate)),
                 Math.max.apply(null, van.map(r => r.van.rate))],
      panSpan: [Math.min.apply(null, van.map(r => r.van.pan)),
                Math.max.apply(null, van.map(r => r.van.pan))],
      gainSpan: [Math.min.apply(null, van.map(r => r.van.gain)),
                 Math.max.apply(null, van.map(r => r.van.gain))],
      pass: near,
      planeSeen: s.filter(r => r.plane && r.plane.built).length,
      planeAmpSpan: (() => {
        const p = s.filter(r => r.plane).map(r => r.plane.amp)
        return p.length ? [Math.min.apply(null, p), Math.max.apply(null, p)] : null
      })(),
      audit: g.hud.moverAudit(),
    }
  })
  out.errs = errs
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=mover-pass.json', { method: 'POST', body: s })
  }, out)
}
