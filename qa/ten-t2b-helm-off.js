async page => {
  // T2b A/B (noPodLead on): the closed-loop helm run from qa/ten-review/b3m-antarctic.js on
  // a fresh profile, real keys: W held, steer at the pod, Q when within 180 m.
  // One change from b3m: in `escort` it steers 40 m up the lead, as the toast
  // asks, because steering AT a pod sitting on the boat saturates the rudder
  // and circles her at 1 m/s in open water (measured, run 3 of this file).
  // Passes if orca-ride ticks inside 150 s of taking the helm. Writes
  // qa/ten-t2b-helm-<stamp>.json.png; LEAD_OFF true runs the A/B with noPodLead.
  const CH = 'antarctic', PORT = 5192, LEAD_OFF = true
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:' + PORT + '/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  for (let i = 0; i < 3; i++) {
    const cur = await page.evaluate(() => window.__capy.biome.current)
    if (cur === CH) break
    await page.evaluate(n => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross(n) }, CH)
    await page.waitForTimeout(12000)
  }
  await page.evaluate(o => { const g = window.__capy; g.state.journeyMode = 'story'; g.state.noPodLead = o }, LEAD_OFF)
  const out = { errs, log: [], leadOff: LEAD_OFF }
  await page.evaluate(() => { const g = window.__capy; g.capy.body.position.set(3.6, 1.6, 26); g.capy.body.velocity.set(0, 0, 0) })
  await page.waitForTimeout(1500)
  for (let i = 0; i < 14; i++) {
    const helm = await page.evaluate(() => window.__capy.antarctic.atHelm())
    if (helm) break
    const k = await page.evaluate(() => { const g = window.__capy, p = g.capy.position; const h = g.hintTarget('take-tiller'); const f = new g.THREE.Vector3(); g.camera.getWorldDirection(f); f.y = 0; f.normalize(); const dx = h.x - p.x, dz = h.z - p.z, d = Math.hypot(dx, dz); const fw = (dx * f.x + dz * f.z) / d, rt = (dx * -f.z + dz * f.x) / d; const keys = []; if (d > 1.2) { if (fw > 0.35) keys.push('KeyW'); if (fw < -0.35) keys.push('KeyS'); if (rt > 0.35) keys.push('KeyD'); if (rt < -0.35) keys.push('KeyA') } return keys })
    for (const kk of k) await page.keyboard.down(kk)
    await page.waitForTimeout(350)
    for (const kk of k) await page.keyboard.up(kk)
    await page.keyboard.press('KeyE'); await page.waitForTimeout(500)
  }
  out.helm = await page.evaluate(() => window.__capy.antarctic.atHelm())
  const y0 = await page.evaluate(() => window.__capy.antarctic.boat.heading)
  await page.keyboard.down('KeyW'); await page.keyboard.down('KeyA'); await page.waitForTimeout(1800); await page.keyboard.up('KeyA')
  const y1 = await page.evaluate(() => window.__capy.antarctic.boat.heading)
  const aInc = y1 > y0
  const t0 = Date.now(), gt0 = await page.evaluate(() => window.__capy.state.time)
  let called = 0, lastQ = 0, held = null, tick = null, maxPackEscort = 0
  const states = {}
  while (Date.now() - t0 < 150000) {
    const s = await page.evaluate(() => { const g = window.__capy, a = g.antarctic, b = a.boat; const pod = a.pod(); const dbg = a.podDebug(); const bx = g.capy.position.x, bz = g.capy.position.z; const esc = dbg.st === 'escort'; const dx = (esc ? dbg.leadX : pod.x) - bx, dz = (esc ? bz - 40 : pod.z) - bz; const want = Math.atan2(dx, dz); let d = want - b.heading; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return { d, dist: Math.hypot(pod.x - bx, pod.z - bz), spd: b.speed, withPod: a.withPod(), done: g.taskDone('orca-ride'), st: dbg.st, pack: dbg.pack, boatPack: a.pack(), told: dbg.toldLead, wait: dbg.waitT, gt: g.state.time, rung: g.state.perfRung | 0 } })
    states[s.st] = (states[s.st] || 0) + 1
    if (s.st === 'escort' || s.st === 'run') maxPackEscort = Math.max(maxPackEscort, s.boatPack)
    let want = null
    if (s.d > 0.12) want = aInc ? 'KeyA' : 'KeyD'
    else if (s.d < -0.12) want = aInc ? 'KeyD' : 'KeyA'
    if (held !== want) { if (held) await page.keyboard.up(held); if (want) await page.keyboard.down(want); held = want }
    if (s.dist < 180 && Date.now() - lastQ > 6000 && s.st !== 'run' && s.st !== 'escort') { await page.keyboard.press('KeyQ'); lastQ = Date.now(); called++ }
    if (out.log.length < 60 && (Date.now() - t0) % 5000 < 300) out.log.push({ t: Date.now() - t0, gt: +(s.gt - gt0).toFixed(1), st: s.st, dist: Math.round(s.dist), spd: +s.spd.toFixed(1), w: +s.withPod.toFixed(2), podPack: s.pack, boatPack: +s.boatPack.toFixed(2), rung: s.rung, told: s.told, wait: s.wait })
    if (s.done) { tick = { wall: Date.now() - t0, game: +(s.gt - gt0).toFixed(1) }; await page.waitForTimeout(1200); await page.screenshot({ path: 'qa/ten-t2b-helm-tick.png' }); break }
    await page.waitForTimeout(250)
  }
  if (held) await page.keyboard.up(held)
  await page.keyboard.up('KeyW')
  out.tick = tick; out.called = called; out.states = states; out.maxBoatPackWithPod = +maxPackEscort.toFixed(2)
  out.lastError = await page.evaluate(() => window.__capy.state.lastError || null)
  out.dbg = await page.evaluate(() => window.__capy.antarctic.podDebug())
  await page.evaluate(async (o) => { await fetch('/shot?name=ten-t2b-helm-' + Date.now() + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
