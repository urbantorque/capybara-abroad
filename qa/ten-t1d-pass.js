async page => {
  // T1d: the passage from the berth, with real keys. W is held from cast-off
  // to the last 60 m; A/D are a closed loop on the fairway (the midpoints of
  // the buoy pairs, then the wharf head); S brings her down to alongside
  // speed. One run per invocation; the run number counts up in the tab's
  // sessionStorage (trap 4, used on purpose). Out: qa/ten-t1d-pass-<n>.json.png
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5194/', { waitUntil: 'commit', timeout: 120000 })
  await page.waitForFunction(() => window.__capy && document.querySelector('.capyui-go'), null, { timeout: 120000 })
  await page.waitForTimeout(3000)
  const RUN = await page.evaluate(() => { try { const n = +(sessionStorage.getItem('t1dRun') || 0) + 1; sessionStorage.setItem('t1dRun', String(n)); return n } catch (e) { return 0 } })
  const TAG = 'ten-t1d-pass-' + RUN
  await page.evaluate(() => {
    window.__ev = []
    const w = document.querySelector('.capyui-toasts')
    if (w) new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.textContent) window.__ev.push([+window.__capy.state.time.toFixed(1), n.textContent.slice(0, 80)]) }).observe(w, { childList: true, subtree: true })
    document.querySelector('.capyui-go').click()
  })
  await page.waitForTimeout(6000)
  await page.evaluate(() => { window.__capy.state.journeyMode = 'free'; window.__capy.hud.cross('quay') })
  await page.waitForFunction(() => window.__capy.biome.current === 'quay' && window.__capy.quay && window.__capy.quay.passageAudit, null, { timeout: 90000 })
  await page.waitForTimeout(4000)
  // Onto the foredeck under the bridge, and take the wheel with a real E.
  const takeE = async () => {
    await page.evaluate(() => {
      const g = window.__capy, a = g.quay.passageAudit(), cb = g.capy.body
      const cs = Math.cos(a.yaw), sn = Math.sin(a.yaw), lx = 0.9, lz = 2.6
      cb.position.set(a.x + sn * lz + cs * lx, g.quay.boat.position.y + 0.8, a.z + cs * lz - sn * lx)
      cb.velocity.set(0, 0, 0)
    })
    await page.waitForTimeout(900)
    await page.keyboard.down('KeyE'); await page.waitForTimeout(140); await page.keyboard.up('KeyE')
    await page.waitForTimeout(500)
    return page.evaluate(() => window.__capy.quay.passageAudit().helm)
  }
  const out = { run: RUN, helmByE: await takeE(), s: [], wp: [] }
  if (!out.helmByE) { await page.evaluate(() => window.__capy.quay.helmDebug(true)); out.helmForced = true }
  const WP = [[19, -40], [39, -150], [69, -300], [99, -440], [104, -522]]
  let wi = 0, keyLR = null, keyFB = 'KeyW'
  await page.keyboard.down('KeyW')
  const set = async (want) => {
    if (want === keyLR) return
    if (keyLR) await page.keyboard.up(keyLR)
    if (want) await page.keyboard.down(want)
    keyLR = want
  }
  const setFB = async (want) => {
    if (want === keyFB) return
    if (keyFB) await page.keyboard.up(keyFB)
    if (want) await page.keyboard.down(want)
    keyFB = want
  }
  const t0 = Date.now()
  let lastS = 0, fortMin = 1e9
  while (Date.now() - t0 < 170000) {
    const a = await page.evaluate(() => Object.assign(window.__capy.quay.passageAudit(), { t: +window.__capy.state.time.toFixed(1) }))
    const fd = Math.hypot(a.x - (-20), a.z - (-126)); if (fd < fortMin) fortMin = fd
    if (a.dolphin > 0.7 && !out.dolphinAt) out.dolphinAt = [a.t, a.x, a.z]
    if (a.arrived) { out.arrived = a; break }
    const [tx, tz] = WP[wi]
    const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz)
    if (wi < WP.length - 1 && (d < 25 || a.z < tz)) { out.wp.push([wi, a.t]); wi++; continue }
    let err = Math.atan2(dx, dz) - a.yaw
    while (err > Math.PI) err -= 2 * Math.PI
    while (err < -Math.PI) err += 2 * Math.PI
    await set(err > 0.05 ? 'KeyA' : err < -0.05 ? 'KeyD' : null)
    if (wi === WP.length - 1 && d < 50) await setFB(a.throttle > 0.40 ? 'KeyS' : a.throttle < 0.28 ? 'KeyW' : null)
    else await setFB('KeyW')
    if (Date.now() - lastS > 2500) { lastS = Date.now(); out.s.push([a.t, a.x, a.z, a.speed, a.headOnN, wi]) }
    await page.waitForTimeout(90)
  }
  await set(null); await setFB(null)
  out.final = await page.evaluate(() => window.__capy.quay.passageAudit())
  out.fortMin = +fortMin.toFixed(1)
  out.toasts = await page.evaluate(() => window.__ev)
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  out.realS = Math.round((Date.now() - t0) / 1000)
  await page.screenshot({ path: 'qa/' + TAG + '-end.png' })
  await page.evaluate(o => fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { tag: TAG, out })
}
