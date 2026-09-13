async page => {
  // L6 E1 — THE LENS COMES BACK. Five measurements, Sydney then the Quay:
  //   A  from a rig turned 90 deg off the heading (X held), W held 6 s:
  //      |camYaw - (heading + pi)| sampled every 0.25 s; the roadmap wants <= 0.3 by 4 s
  //   B  D held 6 s from a settled rig: the rig must not spiral (|dYaw| < 0.5 rad)
  //   C  idle 60 s at 1 m from the Sydney bench (QA F7's station): camDist >= 5 m, pitch <= 30
  //   D  C pressed from that parked lens: pitch and dist 2 s later
  //   E  the Quay: driven off the wharf edge into the harbour; the animal's NDC
  //      box sampled at 50 ms; time out of frame before it is back
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(5500)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(7000)
  const out = {}
  const wrap = 'const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a }'
  const snap = () => page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    const fwd = new T.Vector3(); g.camera.getWorldDirection(fwd)
    const p = g.capy.position, c = g.camera.position
    const dist = Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z)
    const pr = new T.Vector3(p.x, p.y + 0.4, p.z).project(g.camera)
    return { started: g.state.started, biome: g.biome.current, camYaw: +g.input.camYaw.toFixed(3), heading: +g.capy.group.rotation.y.toFixed(3),
      pitch: +(Math.asin(-fwd.y) * 180 / Math.PI).toFixed(1), dist: +dist.toFixed(2), clear: +g.camInfo.clear.toFixed(2), rest: +g.camInfo.rest.toFixed(2),
      ndc: [+pr.x.toFixed(2), +pr.y.toFixed(2), +pr.z.toFixed(2)], pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)],
      lastError: g.state.lastError || null }
  })
  out.boot = await snap()
  // ---- A: a 90 degree rig, then W ----
  await page.keyboard.down('KeyX'); await page.waitForTimeout(660); await page.keyboard.up('KeyX')
  await page.waitForTimeout(2000)
  out.A0 = await snap()
  await page.keyboard.down('KeyW')
  out.A = await page.evaluate(async () => {
    const g = window.__capy
    const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a }
    const rows = []
    const t0 = performance.now()
    while (performance.now() - t0 < 6000) {
      await new Promise(r => setTimeout(r, 250))
      const t = (performance.now() - t0) / 1000
      rows.push({ t: +t.toFixed(2), err: +Math.abs(wrap(g.input.camYaw - (g.capy.group.rotation.y + Math.PI))).toFixed(3), camYaw: +g.input.camYaw.toFixed(3) })
    }
    return rows
  })
  await page.keyboard.up('KeyW')
  await page.waitForTimeout(2500)
  // ---- B: D held 6 s ----
  out.B0 = await snap()
  await page.keyboard.down('KeyD')
  out.B = await page.evaluate(async () => {
    const g = window.__capy
    const rows = []
    const t0 = performance.now(), y0 = g.input.camYaw
    const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a }
    while (performance.now() - t0 < 6000) {
      await new Promise(r => setTimeout(r, 500))
      rows.push({ t: +((performance.now() - t0) / 1000).toFixed(1), dYaw: +wrap(g.input.camYaw - y0).toFixed(3) })
    }
    return rows
  })
  await page.keyboard.up('KeyD')
  // ---- C: the bench station, idle 60 s ----
  await page.evaluate(() => { const b = window.__capy.capy.body; b.position.set(-9.4, 0.5, 17.5); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) })
  await page.waitForTimeout(1500)
  out.C = []
  for (let i = 0; i < 4; i++) { await page.waitForTimeout(15000); out.C.push(await snap()) }
  await page.screenshot({ path: 'qa/l6-lens-bench-idle.png' })
  // ---- D: C from the parked lens ----
  await page.keyboard.press('KeyC')
  await page.waitForTimeout(2200)
  out.D = await snap()
  await page.screenshot({ path: 'qa/l6-lens-bench-C.png' })
  // ---- E: the Quay wharf ----
  await page.evaluate(() => window.__capy.hud.cross('quay'))
  await page.waitForTimeout(10000)
  out.E0 = await snap()
  await page.keyboard.down('KeyW')
  out.E = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE
    const rows = []
    const t0 = performance.now()
    let outT = 0, outMax = 0, lastIn = 0, fell = null, n = 0
    const v = new T.Vector3()
    while (performance.now() - t0 < 12000) {
      await new Promise(r => setTimeout(r, 50))
      const t = (performance.now() - t0) / 1000
      const p = g.capy.position
      v.set(p.x, p.y + 0.4, p.z).project(g.camera)
      const inF = Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1
      if (p.y < 0.3 && fell === null) fell = +t.toFixed(2)
      if (inF) { if (outT > outMax) outMax = outT; outT = 0; lastIn = t } else outT = t - lastIn
      n++
      if (n % 10 === 0 || !inF) rows.push({ t: +t.toFixed(2), y: +p.y.toFixed(2), ndc: [+v.x.toFixed(2), +v.y.toFixed(2)], inF, swim: !!g.capy.swimming, dist: +g.camInfo.dist.toFixed(1), clear: +g.camInfo.clear.toFixed(2) })
    }
    if (outT > outMax) outMax = outT
    return { fell, outMax: +outMax.toFixed(2), rows: rows.slice(0, 80) }
  })
  await page.keyboard.up('KeyW')
  await page.screenshot({ path: 'qa/l6-lens-quay-wharf.png' })
  out.E1 = await snap()
  await page.evaluate((o) => fetch('/shot?name=l6-lens.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
