async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 180)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)

  const out = await page.evaluate(async () => {
    const g = window.__capy
    const R = { issues: [] }
    const tick = n => { for (let i = 0; i < n; i++) g.tick(1 / 60, false) }
    g.biome.switchTo('goreme')
    const sp = g.biome.spawnOf('goreme'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    tick(120)
    const api = g.goreme

    // ---- 1. the trailer is a floor ----------------------------------------
    const t0 = api.truck()
    R.truck = [+t0.x.toFixed(1), +t0.z.toFixed(1)]
    // stand on the bed
    const yaw = 0
    R.kinBodies = g.world.bodies.filter(x => x.type === 4).length
    // find the trailer body: the kinematic box within 3 m of truck+2.4 ahead
    let tb = null
    for (const bd of g.world.bodies) {
      if (bd.type !== 4) continue
      const d = Math.hypot(bd.position.x - t0.x, bd.position.z - t0.z)
      if (d < 4 && d > 1) { tb = bd; break }
    }
    R.foundTrailer = !!tb
    if (tb) {
      R.trailerY = +tb.position.y.toFixed(2)
      b.position.set(tb.position.x, tb.position.y + 1.2, tb.position.z)
      b.velocity.set(0, 0, 0)
      tick(90)
      R.restY = +b.position.y.toFixed(2)
      R.bedTop = +(tb.position.y + 0.12).toFixed(2)
      R.standing = b.position.y > tb.position.y
      if (!R.standing) R.issues.push('the animal fell through the trailer bed')
      R.carryFrame = api.carryFrame ? (api.carryFrame() ? 'yes' : 'null') : 'no fn'
      // does it move WITH the bed?
      const dx0 = b.position.x - tb.position.x, dz0 = b.position.z - tb.position.z
      tick(240)
      const dx1 = b.position.x - tb.position.x, dz1 = b.position.z - tb.position.z
      R.slipOnBed = +Math.hypot(dx1 - dx0, dz1 - dz0).toFixed(2)
      R.bedMoved = +Math.hypot(tb.position.x - t0.x, tb.position.z - t0.z).toFixed(2)
      if (R.slipOnBed > 1.6) R.issues.push('the passenger slid ' + R.slipOnBed + ' m on the bed')
    }

    // ---- 2. the sunrise gate ------------------------------------------------
    // wind the clock to the moment and read where the sun disc is
    R.sunSamples = []
    for (const s of [0.12, 0.30, 0.465, 0.7]) {
      // y = lerp(-120, 300, gorSmooth(s))
      const sm = s * s * (3 - 2 * s)
      R.sunSamples.push([s, Math.round(-120 + 420 * sm)])
    }
    R.err = g.state.lastError || null
    return R
  })
  out.pageErrors = errs
  await page.evaluate(async (o) => { await fetch('/shot?name=b4-gorfix.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
