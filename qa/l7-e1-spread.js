async page => {
  // THE STILL WINDOW, THREE TIMES (L7, E1 / audio #1). The L6 states probe's still window moved
  // 4 dB between runs; the review traced it to startles feeding musChaseT. Three fresh pages,
  // 12 s standing at the Sydney spawn each, score RMS (taps.vol) and the drum stem; the spread
  // is max − min of the score's RMS. Then Kyoto once, for the per-second fall the review saw.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const out = { errs, runs: [] }
  const meter = (secs) => page.evaluate(async (secs) => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const g = window.__capy
    const ac = g.hud.audioBus().sfxOut.context
    const an = ac.createAnalyser(); an.fftSize = 4096; an.smoothingTimeConstant = 0
    g.music.taps.vol.connect(an)
    const dn = ac.createAnalyser(); dn.fftSize = 2048; dn.smoothingTimeConstant = 0
    try { g.music.taps.drum.connect(dn) } catch (e) {}
    const td = new Float32Array(4096), dd = new Float32Array(2048)
    let s2 = 0, n = 0, ds2 = 0, over = 0, chaseOn = 0
    const perSec = []; let ws2 = 0, wn = 0, sec = 0
    const m0 = g.musAudit(); let startled = 0
    g.events.on('npc:startled', () => startled++)
    const t0 = performance.now()
    while (performance.now() - t0 < secs * 1000) {
      an.getFloatTimeDomainData(td); let a2 = 0; for (let i = 0; i < td.length; i++) a2 += td[i] * td[i]; a2 /= td.length; s2 += a2; n++; ws2 += a2; wn++
      dn.getFloatTimeDomainData(dd); let b2 = 0; for (let i = 0; i < dd.length; i++) b2 += dd[i] * dd[i]; b2 /= dd.length; ds2 += b2; if (10 * Math.log10(Math.max(1e-12, b2)) > -45) over++
      const m = g.musAudit(); if (m.chaseT > 0) chaseOn++
      const s = Math.floor((performance.now() - t0) / 1000)
      if (s !== sec) { perSec.push(+(10 * Math.log10(Math.max(1e-12, ws2 / Math.max(1, wn)))).toFixed(1)); ws2 = 0; wn = 0; sec = s }
      await sleep(40)
    }
    const m1 = g.musAudit()
    try { an.disconnect(); dn.disconnect() } catch (e) {}
    return { rms: +(10 * Math.log10(Math.max(1e-12, s2 / Math.max(1, n)))).toFixed(1), perSec, drumRms: +(10 * Math.log10(Math.max(1e-12, ds2 / Math.max(1, n)))).toFixed(1), drumOn: +(over / n).toFixed(2), chaseTon: +(chaseOn / n).toFixed(2), chaseHits: m1.chaseHits - m0.chaseHits, startled, flinchSeen: m1.flinch !== undefined, calm: +g.calm().toFixed(2), err: g.state.lastError || null }
  }, secs)
  for (let r = 0; r < 3; r++) {
    await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForTimeout(9000)
    await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
    await page.waitForTimeout(8000)
    const row = { run: r, started: await page.evaluate(() => window.__capy.state.started) }
    row.sydney = await meter(12)
    if (r === 0) { await page.evaluate(() => window.__capy.hud.cross('kyoto')); await page.waitForTimeout(9000); row.kyoto = await meter(12) }
    out.runs.push(row)
  }
  const v = out.runs.map(r => r.sydney.rms)
  out.spread = +(Math.max(...v) - Math.min(...v)).toFixed(1)
  out.errsN = errs.length
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l7-e1-spread.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
