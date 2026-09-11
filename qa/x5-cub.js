async page => {
  // x5-cub: the pho run. To the stall, E at the Cub, then an autopilot on
  // the keys that steers toward the next lantern along the roads (a crude
  // waypoint list per drop), brakes inside the ring, and expects three
  // deliveries and the tick.
  await page.setViewportSize({ width: 1200, height: 700 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(4500)
  await page.keyboard.press('Digit1'); await page.waitForTimeout(3500)
  const tp = (x, y, z) => page.evaluate(([x, y, z]) => {
    const g = window.__capy; const b = g.capy.body; b.position.set(x, y, z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
  }, [x, y, z])
  const live = () => page.evaluate(() => (document.querySelector('.capyui-marqlive') || {}).textContent || '')
  const cub = () => page.evaluate(() => window.__capy.hanoi.cub())
  await page.evaluate(() => window.__capy.biome.switchTo('hanoi')); await page.waitForTimeout(3500)
  const at = await page.evaluate(() => window.__capy.hanoi.cubAt())
  await tp(at.x + 1.5, at.y + 1.0, at.z + 0.5); await page.waitForTimeout(1200)
  const out = { at: at, before: await cub() }
  await page.keyboard.press('KeyE'); await page.waitForTimeout(600)
  out.took = await cub()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'qa/x5-stall.png' })
  // waypoints along the lanes, per drop (the lanes: 0 north-south at x~0, 1 east-west at z~28, 3 at z~84, 2 the lake ring)
  const routes = [
    [[0, 28], [58, 26], [60, 22.5]],
    [[10, 30], [0, 44], [0, 82], [4, 86], [-52, 80], [-52, 83.5]],
    [[-40, 80], [0, 82], [0, 44], [0, 8], [0, -12], [34, -18], [40, -24.5]],
  ]
  const held = {}
  const set = async (code, on) => { if (!!held[code] === on) return; held[code] = on; if (on) await page.keyboard.down(code); else await page.keyboard.up(code) }
  const samples = []
  let t0 = Date.now(), wp = 0, lastNext = 0, shot = false
  while (Date.now() - t0 < 200000) {
    const c = await cub()
    if (c.done) break
    if (c.next !== lastNext) { lastNext = c.next; wp = 0 }
    const route = routes[c.next]
    const target = route[Math.min(wp, route.length - 1)]
    const dx = target[0] - c.x, dz = target[1] - c.z, d = Math.hypot(dx, dz)
    if (d < 3.5 && wp < route.length - 1) { wp++; continue }
    let want = Math.atan2(dx, dz), diff = want - c.yaw
    while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2
    const last = wp >= route.length - 1
    await set('KeyA', diff > 0.15)
    await set('KeyD', diff < -0.15)
    const slow = last && d < 4.5
    await set('KeyW', !slow && Math.abs(diff) < 2.4)
    await set('KeyS', slow && c.v > 1.5)
    if ((Date.now() - t0) % 1000 < 220) samples.push({ t: Math.round((Date.now() - t0) / 1000), next: c.next, wp: wp, x: +c.x.toFixed(0), z: +c.z.toFixed(0), v: +c.v.toFixed(1), hold: c.hold, line: await live() })
    if (!shot && c.v > 6) { shot = true; await page.screenshot({ path: 'qa/x5-ride.png' }) }
    await page.waitForTimeout(100)
  }
  for (const k of Object.keys(held)) await set(k, false)
  out.samples = samples
  out.final = await cub()
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'qa/x5-done.png' })
  out.ticked = await page.evaluate(() => window.__capy.taskDone('pho-run'))
  out.toasts = await page.evaluate(() => Array.from(document.querySelectorAll('.capyui-toast')).map(e => e.textContent).join(' / '))
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(async (o) => { await fetch('/shot?name=x5cub.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
