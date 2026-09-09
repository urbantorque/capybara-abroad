async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 160)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)

  const out = await page.evaluate(async () => {
    const g = window.__capy
    const R = { issues: [] }
    const settle = n => { for (let i = 0; i < n; i++) g.tick(1 / 60, false) }
    g.biome.switchTo('kyoto')
    const b = g.capy.body, K = g.kyoto

    // AT THE BRIDGE, IN THE WATER — the intended start of the run.
    const st = K.bridge
    b.position.set(st.x, -0.6, st.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    settle(30)
    R.startWet = +(g.capy.wet || 0).toFixed(2)
    R.startFlow = +K.runFlow().toFixed(3)
    R.startInRiver = K.inRiver()

    // Let the current carry it. No steering at all — the river is the verb.
    const cues = []
    const of = g.sfx
    g.sfx = function (n, o) { cues.push(n + (o && o.at ? '@POS' : ' MONO')); return of.apply(g, arguments) }
    let framedAt = -1, peakFraming = 0
    let done = false, t = 0
    const oct = g.completeTask
    g.completeTask = function (id) { if (id === 'uji-run') done = true; return oct.apply(g, arguments) }
    const flow = []
    // STEER DOWN THE FLOW, which is what the river is asking you to do. A
    // straight line at the mill leaves the water and the clock lapses — that
    // is how the earlier probe got a 0.4 s run.
    let outOfWater = 0
    for (let i = 0; i < 60 * 180 && !done; i++) {
      const p = g.capy.position
      const f = K.flow(p.x, p.z)
      const m = Math.hypot(f.x || 0, f.z || 0)
      if (m > 0.01) { g.input.x = f.x / m; g.input.z = f.z / m; g.input.run = true }
      else { outOfWater++; const dx = K.mill.x - p.x, dz = K.mill.z - p.z, d = Math.hypot(dx, dz) || 1
             g.input.x = dx / d; g.input.z = dz / d; g.input.run = true }
      settle(1); t += 1 / 60
      if (i % 60 === 0) flow.push(+K.runFlow().toFixed(2))
      const fr = g.framing()
      if (fr > peakFraming) { peakFraming = fr; }
      if (framedAt < 0 && fr > 0.5) framedAt = +t.toFixed(1)
    }
    g.input.x = 0; g.input.z = 0; g.input.run = false
    R.outOfWaterFrames = outOfWater
    R.endPos = [+g.capy.position.x.toFixed(1), +g.capy.position.z.toFixed(1)]
    R.millAt = [+K.mill.x.toFixed(1), +K.mill.z.toFixed(1)]
    R.completedAfterS = done ? +t.toFixed(1) : -1
    R.runBest = +K.runBest().toFixed(2)
    R.payoutCues = cues.slice(-8)
    R.flowSamples = flow.slice(0, 20)
    // the framing envelope keeps easing after the payout
    for (let i = 0; i < 60 * 2; i++) { settle(1); const fr = g.framing(); if (fr > peakFraming) peakFraming = fr }
    R.peakFraming = +peakFraming.toFixed(3)
    R.framedAtS = framedAt
    g.sfx = of; g.completeTask = oct

    if (!done) R.issues.push('A REAL RUN FROM THE BRIDGE DID NOT COMPLETE IN 180 s — the marquee may now be unreachable')
    if (done && R.runBest <= 5) R.issues.push('runBest is still ' + R.runBest)
    if (done && peakFraming < 0.9) R.issues.push('the payout did not frame the wheel: peak w = ' + peakFraming)
    const chimes = cues.filter(c => c.indexOf('chime') === 0)
    R.chimeAtPayout = chimes.slice(-1)[0] || null
    if (done && R.chimeAtPayout && R.chimeAtPayout.indexOf('@POS') < 0)
      R.issues.push('the payout chime is still mono')
    R.lastError = g.state.lastError || null
    return R
  })
  out.pageErrors = errs
  await page.evaluate(async o => {
    await fetch('/shot?name=b3-kyoto-run.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
