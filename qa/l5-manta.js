async page => {
  // L5 M1 — THE MANTA: the leap, the lean, the second one.
  // Fresh file, Begin, cross to Palawan. mantaForce(0) puts the animal on the
  // ray at ride time 0. Sampled every 150 ms: u, the second manta's position
  // (it should trail the first on the lap and breach after it), sparks
  // alive, the lens (camInfo.shot > 0 at the breach), timeScale (< 1 at the
  // breach). Then a second ride: at u ~0.90 Space — the leap — and the
  // record 'the-manta' in the audit should be metres, not seconds.
  // qa/l5-manta.json; frames qa/l5-manta-breach.png, qa/l5-manta-leap.png.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  const begin = await page.$('text=Begin')
  if (begin) await begin.click(); else await page.mouse.click(430, 350)
  await page.waitForTimeout(6000)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started) }
  await page.evaluate(() => { window.__capy.hud.cross('palawan') })
  await page.waitForTimeout(9000)
  out.biome = await page.evaluate(() => window.__capy.biome.current)

  // ---- ride one: sit through it, watch the breach -------------------------
  await page.evaluate(() => {
    const g = window.__capy, p = g.palawan
    const L = window.__l5m = { rows: [], t0: performance.now() }
    p.mantaForce(0)
    L.iv = setInterval(() => {
      const a = p.mantaAudit()
      L.rows.push({ t: +((performance.now() - L.t0) / 1000).toFixed(2), u: a.u, y: a.y, two: a.two, breached: a.breached,
        sparks: g.sparksLive(), shot: +g.camInfo.shot.toFixed(2), ts: +(g.state.timeScale || 1).toFixed(2),
        capyY: +g.capy.position.y.toFixed(2), carried: !!g.capy.carriedBy })
    }, 150)
  })
  await page.waitForTimeout(20500)
  await page.screenshot({ path: 'qa/l5-manta-breach.png', timeout: 90000 })
  await page.waitForTimeout(4000)
  out.ride = await page.evaluate(() => { const L = window.__l5m; clearInterval(L.iv); return L.rows })
  out.rideEnd = await page.evaluate(() => window.__capy.palawan.mantaAudit())

  // ---- ride two: the leap ---------------------------------------------------
  await page.evaluate(() => {
    const g = window.__capy, p = g.palawan
    const L = window.__l5m = { rows: [], t0: performance.now(), leapt: false }
    p.mantaForce(17.5)     // u 0.795: the climb starts at 0.80
    L.iv = setInterval(() => {
      const a = p.mantaAudit()
      L.rows.push({ t: +((performance.now() - L.t0) / 1000).toFixed(2), u: a.u, y: a.y, leapOn: a.leapOn, peak: a.leapPeak,
        capyY: +g.capy.position.y.toFixed(2), carried: !!g.capy.carriedBy, ts: +(g.state.timeScale || 1).toFixed(2) })
    }, 100)
  })
  // wait for u ~ 0.91 (t = 20.0 s of ride, 2.5 s from 17.5 — slow-mo at the breach stretches it)
  for (let k = 0; k < 60; k++) {
    await page.waitForTimeout(100)
    const u = await page.evaluate(() => window.__capy.palawan.mantaAudit().u)
    if (u >= 0.915 || u < 0) break
  }
  await page.keyboard.press('Space')
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'qa/l5-manta-leap.png', timeout: 90000 })
  await page.waitForTimeout(5000)
  out.leap = await page.evaluate(() => { const L = window.__l5m; clearInterval(L.iv); return L.rows })
  out.leapEnd = await page.evaluate(() => window.__capy.palawan.mantaAudit())
  out.record = await page.evaluate(() => {
    const h = window.__capy.hud
    const a = typeof h.recordAudit === 'function' ? h.recordAudit() : null
    const el = document.querySelector('.capyui-rec')
    return { audit: a, line: el ? el.textContent.replace(/\s+/g, ' ').trim() : null }
  })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=l5-manta.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
  return out
}
