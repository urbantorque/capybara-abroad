async page => {
  // T1d: two things about the fort. (A) W alone from the berth, no wheel at
  // all, for 16 s: she must pass the fort's latitude without touching it.
  // (B) Then put her square on to it, dead centre, W still held: the head-on
  // slide must turn her off and let her go, and say "S to go astern" once.
  // Out: qa/ten-t1d-rock.json.png
  const TAG = 'ten-t1d-rock'
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5194/', { waitUntil: 'commit', timeout: 120000 })
  await page.waitForFunction(() => window.__capy && document.querySelector('.capyui-go'), null, { timeout: 120000 })
  await page.waitForTimeout(3000)
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
  await page.evaluate(() => window.__capy.quay.helmDebug(true))
  await page.waitForTimeout(400)
  const A = () => page.evaluate(() => Object.assign(window.__capy.quay.passageAudit(), { t: +window.__capy.state.time.toFixed(1) }))
  const FX = -20, FZ = -126, HARD = 13 * 0.9 + 2.35
  const out = { a: [], b: [] }
  await page.keyboard.down('KeyW')
  let t0 = Date.now(), fortMin = 1e9
  while (Date.now() - t0 < 16000) {
    const a = await A()
    fortMin = Math.min(fortMin, Math.hypot(a.x - FX, a.z - FZ))
    out.a.push([a.t, a.x, a.z, a.speed, a.headOnN])
    await page.waitForTimeout(400)
  }
  const endA = await A()
  out.A = { passedFortZ: endA.z < FZ - HARD, zEnd: endA.z, xEnd: endA.x, fortMin: +fortMin.toFixed(1), headOnN: endA.headOnN, yaw: endA.yaw }
  // (B) square on, 30 m short of the centre, same heading
  await page.evaluate(o => window.__capy.quay.boatDebugTo(o.x, o.z), { x: FX, z: FZ + 30 })
  t0 = Date.now()
  let touchT = null, clearT = null
  while (Date.now() - t0 < 40000) {
    const a = await A()
    const d = Math.hypot(a.x - FX, a.z - FZ)
    if (touchT === null && d < HARD + 0.3) touchT = a.t
    if (touchT !== null && clearT === null && (d > HARD + 3 || a.z < FZ - 2)) clearT = a.t
    out.b.push([a.t, a.x, a.z, +a.yaw.toFixed(2), a.speed, +d.toFixed(1), a.headOnN])
    if (clearT !== null && a.t - clearT > 3) break
    await page.waitForTimeout(300)
  }
  await page.keyboard.up('KeyW')
  const endB = await A()
  out.B = { touchT, clearT, stuckS: touchT !== null && clearT !== null ? +(clearT - touchT).toFixed(1) : null, headOnN: endB.headOnN, astern: endB.astern, speedEnd: endB.speed, yawTurned: +(endB.yaw - endA.yaw).toFixed(2) }
  out.toasts = await page.evaluate(() => window.__ev)
  out.asternToasts = out.toasts.filter(x => /astern/.test(x[1])).length
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.screenshot({ path: 'qa/' + TAG + '-end.png' })
  await page.evaluate(o => fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { tag: TAG, out })
}
