async page => {
  // D2: DO THE FEET SKATE, DOES THE HOP CROUCH, DOES A STOP LEAN?
  //
  // THE SKATE. Per half cycle of the legs the foot arc is worth `stride` metres
  // of ground; the legs turn at `gaitRate` rad/s; so the ground the gait CLAIMS
  // is `stride * gaitRate / PI` m/s against the `speed` the animal covers. That
  // ratio is 1.000 by construction now, which is the point and is also not a
  // measurement — so this reports what the OLD formula would have claimed at
  // the same speed (`clamp(PI * v / 0.62, 2.6, 34)`, capySTRIDE as a constant)
  // and how many metres per step that disagrees with the legs by. That number
  // is the fault, and it is largest exactly where the game is quietest: the
  // creep-up-on-a-picnic speed, which is reached on the ramp out of a standstill
  // and by no key.
  //
  // EVERY RUN FROM A FRESH LOAD. The first cut of this walked, then sprinted
  // from wherever the walk had ended up, and the sprint row read 1.76 m/s
  // because the animal was against a fence. A locomotion probe that does not
  // reload has measured the fence.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1100, height: 660 })
  const out = { rows: [], errs: [] }

  async function fresh() {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press('Digit1')
    await page.waitForTimeout(9000)
  }
  const OLD_STRIDE = 0.62

  // ---- 1. the ramp out of a standstill, which is every speed under a walk --
  await fresh()
  await page.keyboard.down('KeyW')
  const ramp = await page.evaluate(async () => {
    const g = window.__capy, s = []
    for (let i = 0; i < 150; i++) {
      const a = g.capy.animAudit()
      s.push([a.speed, a.gaitRate, a.stride, a.grounded ? 1 : 0])
      await new Promise(r => setTimeout(r, 8))
    }
    return s
  })
  await page.keyboard.up('KeyW')
  const BINS = [0.6, 1.0, 1.6, 2.5, 3.4, 4.2]
  for (const b of BINS) {
    const hit = ramp.filter(s => s[3] === 1 && Math.abs(s[0] - b) < 0.18)
    if (!hit.length) { out.rows.push({ speed: b, n: 0 }); continue }
    const mean = (f) => hit.reduce((x, s) => x + f(s), 0) / hit.length
    const stride = mean(s => s[2])
    const oldRate = Math.min(34, Math.max(2.6, Math.PI * b / OLD_STRIDE))
    out.rows.push({ speed: b, n: hit.length,
      stride: Math.round(stride * 1000) / 1000,
      gaitRate: Math.round(mean(s => s[1]) * 10) / 10,
      stepsPerSec: Math.round(mean(s => s[1]) / Math.PI * 100) / 100,
      skateRatio: Math.round(mean(s => s[0] / (s[2] * s[1] / Math.PI)) * 1000) / 1000,
      oldClaimedStride: Math.round(Math.PI * b / oldRate * 1000) / 1000,
      oldSlipPerStep: Math.round(Math.abs(Math.PI * b / oldRate - stride) * 1000) / 1000 })
  }

  // ---- 2. a sprint, from a fresh load, so the ceiling is measured too ------
  await fresh()
  await page.keyboard.down('ShiftLeft')
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(1400)
  const sp = await page.evaluate(async () => {
    const g = window.__capy, s = []
    for (let i = 0; i < 40; i++) {
      const a = g.capy.animAudit()
      s.push([a.speed, a.gaitRate, a.stride, a.grounded ? 1 : 0, a.lean])
      await new Promise(r => setTimeout(r, 25))
    }
    return s
  })
  const on = sp.filter(s => s[3] === 1 && s[0] > 5)
  const m = (f) => on.length ? on.reduce((x, s) => x + f(s), 0) / on.length : null
  out.sprint = on.length ? {
    n: on.length, speed: Math.round(m(s => s[0]) * 100) / 100,
    stride: Math.round(m(s => s[2]) * 1000) / 1000,
    gaitRate: Math.round(m(s => s[1]) * 10) / 10,
    stepsPerSec: Math.round(m(s => s[1]) / Math.PI * 100) / 100,
    skateRatio: Math.round(m(s => s[0] / (s[2] * s[1] / Math.PI)) * 1000) / 1000,
    lean: Math.round(m(s => s[4]) * 1000) / 1000 } : { n: 0 }
  // ...and the stop, on the same run, with the animal at full speed
  await page.keyboard.up('KeyW')
  await page.keyboard.up('ShiftLeft')
  out.stop = await page.evaluate(async () => {
    const g = window.__capy, s = []
    for (let i = 0; i < 70; i++) {
      const a = g.capy.animAudit()
      s.push([Math.round(a.lean * 1000) / 1000, Math.round(a.accel * 10) / 10,
              Math.round(a.speed * 100) / 100])
      await new Promise(r => setTimeout(r, 12))
    }
    return { minLean: Math.min.apply(null, s.map(x => x[0])),
             maxLean: Math.max.apply(null, s.map(x => x[0])),
             minAccel: Math.min.apply(null, s.map(x => x[1])),
             secondsNegative: s.filter(x => x[0] < -0.004).length * 0.012,
             trace: s.slice(0, 30) }
  })

  // ---- 3. the hop, at 120 Hz on the spring the scale is drawn from ---------
  await fresh()
  out.hop = await page.evaluate(async () => {
    const g = window.__capy, s = []
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }))
    for (let i = 0; i < 70; i++) {
      const a = g.capy.animAudit()
      s.push([Math.round(a.pop * 1000) / 1000, Math.round(a.earLag * 100) / 100,
              Math.round(a.vy * 100) / 100])
      await new Promise(r => setTimeout(r, 8))
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }))
    const pops = s.map(x => x[0])
    let below = 0, firstUp = -1
    pops.forEach((v, i) => { if (v < -0.02) below++; if (firstUp < 0 && v > 0.05) firstUp = i })
    // only the takeoff half: the landing has its own absorb and its own dip
    const takeoff = pops.slice(0, 30)
    return { samplesBelowZero: below, minTakeoff: Math.min.apply(null, takeoff),
             maxTakeoff: Math.max.apply(null, takeoff), firstStretchSample: firstUp,
             earWhipPeak: Math.max.apply(null, s.map(x => Math.abs(x[2] - x[1]))),
             trace: s.slice(0, 26) }
  })

  out.errs = errs
  await page.evaluate((o) => fetch('/shot?name=d2-skate.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
