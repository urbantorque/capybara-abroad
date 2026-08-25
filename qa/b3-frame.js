async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 160)))
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(700)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)

  const out = await page.evaluate(async () => {
    const g = window.__capy
    const R = { issues: [], has: typeof g.frameShot === 'function' }
    if (!R.has) { R.issues.push('game.frameShot is not a function'); return R }
    const settle = n => { for (let i = 0; i < n; i++) g.tick(1 / 60, false) }
    const park = name => {
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.input.x = 0; g.input.z = 0; g.input.action = false; g.input.run = false
      settle(120)
    }
    const bearing = () => {
      const c = g.capy.position, e = g.camera.position
      return Math.atan2(e.x - c.x, e.z - c.z)
    }
    const reach = () => Math.hypot(g.camera.position.x - g.capy.position.x,
                                   g.camera.position.z - g.capy.position.z)
    const deg = r => +(r * 180 / Math.PI).toFixed(1)

    // ---- 1. a shot swings the bearing and pulls the distance -------------
    park('kyoto')
    R.beforeYaw = deg(bearing()); R.beforeReach = +reach().toFixed(2)
    const want = bearing() + Math.PI * 0.75
    g.frameShot({ yaw: want, dist: 14, pitch: 26 * Math.PI / 180, hold: 3 })
    let peakW = 0
    for (let i = 0; i < 60 * 3; i++) { settle(1); peakW = Math.max(peakW, g.framing()) }
    R.peakW = +peakW.toFixed(3)
    R.heldYaw = deg(bearing()); R.wantYaw = deg(want)
    R.heldReach = +reach().toFixed(2)
    R.yawErrDeg = +Math.abs(((R.heldYaw - R.wantYaw + 540) % 360) - 180).toFixed(1)
    if (peakW < 0.98) R.issues.push('the envelope never reached full weight: ' + peakW)
    if (R.yawErrDeg > 8) R.issues.push('bearing missed by ' + R.yawErrDeg + ' deg')
    if (Math.abs(R.heldReach - 14) > 1.6) R.issues.push('distance held at ' + R.heldReach + ' not 14')

    // ---- 2. it lets go -----------------------------------------------------
    for (let i = 0; i < 60 * 4; i++) settle(1)
    R.afterW = +g.framing().toFixed(3)
    R.afterReach = +reach().toFixed(2)
    if (R.afterW > 0.01) R.issues.push('the shot never released: w=' + R.afterW)
    if (Math.abs(R.afterReach - R.beforeReach) > 2.0)
      R.issues.push('distance did not return: ' + R.afterReach + ' vs ' + R.beforeReach)

    // ---- 3. THE PLAYER WINS. Touching the camera kills it. ---------------
    park('kyoto')
    g.frameShot({ yaw: bearing() + Math.PI, dist: 15, hold: 6 })
    for (let i = 0; i < 40; i++) settle(1)
    R.midW = +g.framing().toFixed(3)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true }))
    for (let i = 0; i < 30; i++) settle(1)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyZ', bubbles: true }))
    for (let i = 0; i < 60; i++) settle(1)
    R.killedW = +g.framing().toFixed(3)
    if (!(R.killedW < 0.06)) R.issues.push('a camera input did not kill the shot: ' + R.killedW)

    // ---- 4. it does not survive a border ---------------------------------
    g.frameShot({ yaw: 0, dist: 15, hold: 8 })
    for (let i = 0; i < 40; i++) settle(1)
    park('rio')
    R.crossW = +g.framing().toFixed(3)
    if (R.crossW > 0.001) R.issues.push('a shot survived biome:enter: ' + R.crossW)

    // ---- 5. a yaw-only shot leaves the distance alone --------------------
    park('venice')
    const d0 = reach()
    g.frameShot({ yaw: bearing() + 1.2, hold: 2 })
    for (let i = 0; i < 90; i++) settle(1)
    R.yawOnlyReachDelta = +(reach() - d0).toFixed(2)
    if (Math.abs(R.yawOnlyReachDelta) > 0.9)
      R.issues.push('a yaw-only shot moved the distance by ' + R.yawOnlyReachDelta)
    R.lastError = g.state.lastError || null
    return R
  })
  out.pageErrors = errs
  await page.evaluate(async (o) => { await fetch('/shot?name=b3-frame.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
