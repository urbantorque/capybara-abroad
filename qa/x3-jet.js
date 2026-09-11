async page => {
  // x3-jet: the jetpack. Up to the crest, E at the pack, then an autopilot:
  // lean toward the target (camera-relative keys from input.camYaw), burn
  // while the target is higher or the tank is full and we are on the ground,
  // land to refill. Expect four rings, then the minaret, then the tick.
  await page.setViewportSize({ width: 1200, height: 700 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(4500)
  await page.keyboard.press('Digit1'); await page.waitForTimeout(3500)
  const tp = (x, y, z) => page.evaluate(([x, y, z]) => {
    const g = window.__capy; const b = g.capy.body; b.position.set(x, y, z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
  }, [x, y, z])
  const live = () => page.evaluate(() => (document.querySelector('.capyui-marqlive') || {}).textContent || '')
  const jet = () => page.evaluate(() => window.__capy.sahara.jet())
  await page.evaluate(() => window.__capy.biome.switchTo('sahara')); await page.waitForTimeout(3500)
  const pack = await page.evaluate(() => window.__capy.sahara.jetPack())
  await tp(pack.x + 2.0, pack.y + 1.2, pack.z + 1); await page.waitForTimeout(1500)
  const out = { pack: pack, before: await jet() }
  await page.screenshot({ path: 'qa/x3-crest.png' })
  await page.keyboard.press('KeyE'); await page.waitForTimeout(600)
  out.took = await jet()
  out.toast0 = await page.evaluate(() => Array.from(document.querySelectorAll('.capyui-toast')).map(e => e.textContent).join(' / '))
  const held = {}
  const set = async (code, on) => { if (!!held[code] === on) return; held[code] = on; if (on) await page.keyboard.down(code); else await page.keyboard.up(code) }
  const samples = []
  let t0 = Date.now(), shot = 0
  while (Date.now() - t0 < 240000) {
    const st = await page.evaluate(() => {
      const g = window.__capy; const j = g.sahara.jet(); if (j.done) return { j: j, done: true }
      const tg = g.sahara.jetTarget(); const cy = g.input.camYaw || 0
      const dx = tg.x - j.x, dz = tg.z - j.z, d = Math.hypot(dx, dz)
      // world direction -> keys: forward f = (-sin cy, -cos cy), right r = (cos cy, -sin cy)
      const fx = -Math.sin(cy), fz = -Math.cos(cy), rx = Math.cos(cy), rz = -Math.sin(cy)
      const f = (dx * fx + dz * fz) / (d || 1), r = (dx * rx + dz * rz) / (d || 1)
      return { j: j, d: d, f: f, r: r, up: tg.y - j.y, tg: tg }
    })
    if (st.done) break
    const j = st.j
    // burn: on the ground with a tank, or in the air while the target is higher than we are (plus margin) and we have fuel
    const wantBurn = (j.ground && j.fuel > 3.5) || (!j.ground && j.fuel > 0 && (st.up > -6 || j.vy < -8 && st.d > 20))
    await set('Space', wantBurn)
    await set('KeyW', st.f > 0.3)
    await set('KeyS', st.f < -0.3)
    await set('KeyD', st.r > 0.3)
    await set('KeyA', st.r < -0.3)
    if ((Date.now() - t0) % 1000 < 220) samples.push({ t: Math.round((Date.now() - t0) / 1000), next: j.next, x: +j.x.toFixed(0), y: +j.y.toFixed(0), z: +j.z.toFixed(0), d: +st.d.toFixed(0), up: +st.up.toFixed(0), fuel: +j.fuel.toFixed(1), g: j.ground, line: await live() })
    if (shot === 0 && !j.ground && j.y - pack.y > 6) { shot = 1; await page.screenshot({ path: 'qa/x3-burn.png' }) }
    if (shot === 1 && j.next >= 2) { shot = 2; await page.screenshot({ path: 'qa/x3-ring.png' }) }
    await page.waitForTimeout(120)
  }
  for (const k of Object.keys(held)) await set(k, false)
  out.samples = samples
  out.flown = await jet()
  await page.waitForTimeout(3500)
  await page.screenshot({ path: 'qa/x3-minaret.png' })
  out.ticked = await page.evaluate(() => window.__capy.taskDone('jetpack'))
  out.toasts = await page.evaluate(() => Array.from(document.querySelectorAll('.capyui-toast')).map(e => e.textContent).join(' / '))
  out.capy = await page.evaluate(() => { const c = window.__capy.capy; const p = c.position; return { p: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], atHelm: c.atHelm } })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(async (o) => { await fetch('/shot?name=x3jet.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
