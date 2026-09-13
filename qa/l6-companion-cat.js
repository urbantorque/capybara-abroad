async page => {
  // THE WALKER AT THE BANK (L6, F1). A Cappadocian cat carried into Kowloon
  // follows down the street, stops at the last dry step when the capybara
  // swims out, calls, and comes on again when the capybara comes back.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(5000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const g = window.__capy; g.completeTask('gather', true); g.completeTask('the-crossing', true); g.hud.cross('goreme') })
  await page.waitForTimeout(9000)
  const out = {}
  out.mount = await page.evaluate(() => {
    const g = window.__capy
    const r = { biome: g.biome.current }
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false) }
    let k = g.herdDebug().kinds[0]
    for (let w = 0; w < 40 && (!k || !k.n || !k.first); w++) { tick(60); k = g.herdDebug().kinds[0] }
    if (!k || !k.first) { r.err = 'nothing offered'; return r }
    const px = k.first.x + 1.85 * 0.71, pz = k.first.z + 1.85 * 0.71
    const b = g.capy.body
    const pin = () => { b.position.x = px; b.position.z = pz; b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0) }
    b.position.set(px, k.first.y + 0.8, pz); tick(1)
    for (let i = 0; i < 240; i++) { pin(); g.tick(1 / 60, false) }
    for (let w = 0; w < 5; w++) { pin(); g.events.emit('capy:wheek', { position: g.capy.position, soft: false }); for (let i = 0; i < 30; i++) { pin(); g.tick(1 / 60, false) } }
    let n = 0
    for (; n < 60 * 26 && g.perchCount() < 1; n++) { pin(); if (n > 0 && n % 600 === 0) g.events.emit('capy:wheek', { position: g.capy.position, soft: false }); g.tick(1 / 60, false) }
    for (let i = 0; i < 90; i++) { pin(); g.tick(1 / 60, false) }
    r.on = g.perchCount(); r.ticks = n; r.kind = k.kind
    return r
  })
  await page.evaluate(() => window.__capy.hud.cross('kowloon'))
  await page.waitForTimeout(9500)
  out.arrive = await page.evaluate(() => { const d = window.__capy.stowDebug(); return { kind: d.kind, state: d.state, from: d.from } })
  await page.keyboard.press('Space')
  await page.waitForTimeout(1200)
  // down the street, off the end of the pontoon into the harbour, and back
  out.walk = await page.evaluate(() => {
    const g = window.__capy, inp = g.input
    const wp = [{ x: 1, z: 0 }, { x: 0, z: -44 }, { x: 2, z: -58 }, { x: 2, z: -67 }, { x: 2, z: -82 }, { x: 2, z: -66 }, { x: 0, z: -50 }]
    let wpi = 0
    const rows = []
    let calls = 0
    const orig = g.sfx
    for (let i = 0; i < 60 * 55; i++) {
      const p = g.capy.position, w = wp[wpi]
      if (w) { const dx = w.x - p.x, dz = w.z - p.z, d = Math.hypot(dx, dz); if (d < 1.2) { wpi++; inp.x = 0; inp.z = 0 } else { inp.x = dx / d; inp.z = dz / d } } else { inp.x = 0; inp.z = 0 }
      inp.camYaw = 0
      // twelve seconds in the water: hold there
      if (wpi === 5 && rows.length && rows[rows.length - 1].swimT < 12) { const w4 = wp[4]; const dx = w4.x - p.x, dz = w4.z - p.z, d = Math.hypot(dx, dz); if (d > 0.5) { inp.x = dx / d; inp.z = dz / d } else { inp.x = 0; inp.z = 0 } }
      g.tick(1 / 60, false)
      if (i % 6 === 0) {
        const d = g.stowDebug()
        const last = rows[rows.length - 1]
        rows.push({ t: rows.length, d: +Math.hypot(d.x - p.x, d.z - p.z).toFixed(2), st: d.state, y: d.y, cz: +p.z.toFixed(1), cy: +p.y.toFixed(2),
                    swim: g.capy.swimming ? 1 : 0, swimT: +((last ? last.swimT : 0) + (g.capy.swimming ? 0.1 : 0)).toFixed(1),
                    wet: g.kowloon.waterHeightAt(d.x, d.z) > g.kowloon.terrainHeight(d.x, d.z) + 0.05 ? 1 : 0, wait: d.waiting ? 1 : 0, wpi })
      }
    }
    inp.x = 0; inp.z = 0
    const swim = rows.filter(r => r.swim)
    const wait = rows.filter(r => r.wait)
    const wetComp = rows.filter(r => r.wet)
    const dry = rows.filter(r => !r.swim)
    const back = rows.slice(-40)
    return { samples: rows.length, wpiEnd: wpi, swimSamples: swim.length, swimMaxD: swim.length ? Math.max(...swim.map(r => r.d)) : null,
             waitSamples: wait.length, compEverWet: wetComp.length, compYMin: Math.min(...rows.map(r => r.y)),
             waitZ: wait.length ? { min: Math.min(...wait.map(r => r.cz)), z: wait[0] } : null,
             dryWithin3: +(100 * dry.filter(r => r.d <= 3).length / Math.max(1, dry.length)).toFixed(1),
             endD: back[back.length - 1].d, endState: back[back.length - 1].st, backWithin3: back.filter(r => r.d <= 3).length,
             states: Array.from(new Set(rows.map(r => r.st))), err: g.state.lastError || null }
  })
  await page.keyboard.press('KeyC')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'qa/l6-companion-cat.png' })
  out.errs = errs.slice(0, 10)
  await page.evaluate(async (o) => { await fetch('/shot?name=l6-companion-cat.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
