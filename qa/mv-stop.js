async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(6000)

  const out = await page.evaluate(() => {
    const g = window.__capy
    const inp = g.input
    const D = 1 / 60
    const b = g.capy.body
    let sx = 0, sz = 0, srun = false
    function T (k) {
      for (let i = 0; i < k; i++) {
        inp.x = sx; inp.z = sz; inp.run = srun; inp.camYaw = 0
        inp.jump = false; inp.jumpPressed = false; inp.action = false
        g.tick(D, false)
      }
    }
    function spd () { return Math.hypot(b.velocity.x, b.velocity.z) }
    function place () {
      b.position.set(4, 0.5, 30); b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }
    const res = {}

    // ---- STOPPING DISTANCE from a full sprint -----------------------------
    place(); sz = -1; srun = true; T(150)
    const v0 = spd()
    const x0 = b.position.x, z0 = b.position.z
    sx = 0; sz = 0; srun = false
    const trace = []
    for (let i = 0; i < 30; i++) {
      T(1)
      trace.push({ f: i + 1, v: +spd().toFixed(2),
                   d: +Math.hypot(b.position.x - x0, b.position.z - z0).toFixed(3) })
      if (spd() < 0.01) break
    }
    res.sprint = +v0.toFixed(2)
    res.stopFrames = trace.length
    res.stopDist = trace[trace.length - 1].d
    res.stopTrace = trace

    // ---- TURN: 90 degrees at a sprint, how far it travels and how much it keeps
    place(); sz = -1; srun = true; T(150)
    const vBefore = spd()
    const tx = b.position.x, tz = b.position.z
    sx = -1; sz = 0                       // hard left
    let minV = 99, settled = -1
    const tt = []
    for (let i = 0; i < 90; i++) {
      T(1)
      const s = spd()
      if (s < minV) minV = s
      const head = Math.atan2(b.velocity.x, b.velocity.z)
      tt.push({ f: i + 1, v: +s.toFixed(2), h: +(head * 57.3).toFixed(0),
                d: +Math.hypot(b.position.x - tx, b.position.z - tz).toFixed(2) })
      if (settled < 0 && Math.abs(head + Math.PI / 2) < 0.15 && s > 0.95 * vBefore) settled = i + 1
    }
    res.turnBefore = +vBefore.toFixed(2)
    res.turnMinV = +minV.toFixed(2)
    res.turnFrames = settled
    res.turnTrace = tt.filter((_, i) => i % 5 === 0)

    // ---- ...and the same turn at a WALK -----------------------------------
    place(); sx = 0; sz = -1; srun = false; T(150)
    const wB = spd()
    sx = -1; sz = 0
    let wMin = 99
    for (let i = 0; i < 90; i++) { T(1); wMin = Math.min(wMin, spd()) }
    res.walkBefore = +wB.toFixed(2)
    res.walkMinV = +wMin.toFixed(2)

    // ---- GENTLE course change: 45 degrees, which is what weaving actually is
    place(); sx = 0; sz = -1; srun = true; T(150)
    const gB = spd()
    sx = -0.707; sz = -0.707
    let gMin = 99
    for (let i = 0; i < 90; i++) { T(1); gMin = Math.min(gMin, spd()) }
    res.g45Before = +gB.toFixed(2)
    res.g45MinV = +gMin.toFixed(2)

    sx = 0; sz = 0; srun = false; T(30)
    return res
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=mv-stop.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
