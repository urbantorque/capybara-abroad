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
    const put = (x, y, z) => {
      b.position.set(x, y, z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }
    const cues = []
    const of = g.sfx
    g.sfx = function (n, o) { cues.push(n + (o && o.at ? '@POS' : ' MONO')); return of.apply(g, arguments) }
    let done = 0
    const oct = g.completeTask
    g.completeTask = function (id) { if (id === 'uji-run') done++; return oct.apply(g, arguments) }
    let peakFraming = 0

    // ---- A: THE SHORT RUN MUST PAY NOTHING ------------------------------
    // Drop in at the mill: the clock arms and the circle finishes it inside a
    // frame. This is the exact false completion that wrote 0.4 s into runBest.
    put(K.mill.x, -1.0, K.mill.z)
    settle(60 * 8)
    R.A_completions = done
    R.A_runBest = +K.runBest().toFixed(2)
    R.A_chimes = cues.filter(c => c.indexOf('chime') === 0).length
    if (done > 0) R.issues.push('A: a run started at the mill still ticked the marquee')
    if (R.A_runBest > 0) R.issues.push('A: runBest took ' + R.A_runBest)

    // ---- B: A RUN LONGER THAN THE FLOOR MUST PAY --------------------------
    // Held in the water upstream long enough for the clock to pass the floor,
    // then let go at the mill. This is the gate's logic, not a swim test.
    put(K.bridge.x, -0.6, K.bridge.z)
    settle(20)
    R.B_armedUpstream = K.inRiver()
    // pin it upstream for twelve seconds of wall clock
    for (let i = 0; i < 60 * 12; i++) { put(K.bridge.x, -0.6, K.bridge.z); settle(1) }
    // now step it down the centreline in ten hops, staying wet the whole way
    const n = 10
    for (let k = 1; k <= n && !done; k++) {
      const f = k / n
      put(K.bridge.x + (K.mill.x - K.bridge.x) * f, -0.7,
          K.bridge.z + (K.mill.z - K.bridge.z) * f)
      for (let i = 0; i < 8; i++) {
        settle(1)
        const fr = g.framing(); if (fr > peakFraming) peakFraming = fr
      }
    }
    for (let i = 0; i < 60 * 3; i++) { settle(1); const fr = g.framing(); if (fr > peakFraming) peakFraming = fr }
    R.B_completions = done
    R.B_runBest = +K.runBest().toFixed(2)
    R.B_peakFraming = +peakFraming.toFixed(3)
    const chimes = cues.filter(c => c.indexOf('chime') === 0)
    R.B_lastChime = chimes.slice(-1)[0] || null
    R.B_chimeCount = chimes.length

    if (done === 0) R.issues.push('B: A RUN PAST THE FLOOR DID NOT PAY — the marquee is unreachable')
    if (done > 1) R.issues.push('B: the marquee paid out ' + done + ' times')
    if (done && R.B_runBest <= 5) R.issues.push('B: runBest is ' + R.B_runBest + ', at or under the floor')
    if (done && peakFraming < 0.9) R.issues.push('B: the payout did not frame the wheel, peak w = ' + peakFraming)
    if (done && R.B_lastChime && R.B_lastChime.indexOf('@POS') < 0)
      R.issues.push('B: the payout chime is still mono')

    // ---- C: AND IT MUST NOT RE-FIRE WHILE YOU FLOAT THERE ---------------
    const before = cues.length
    settle(60 * 30)
    R.C_cuesIn30s = cues.length - before
    R.C_completions = done
    R.C_refires = cues.slice(before).filter(c => c.indexOf('chime') === 0).length
    if (R.C_refires > 0) R.issues.push('C: the finish re-fired ' + R.C_refires + ' times in 30 s')

    g.sfx = of; g.completeTask = oct
    R.lastError = g.state.lastError || null
    return R
  })
  out.pageErrors = errs
  await page.evaluate(async o => {
    await fetch('/shot?name=b3-kyoto-gate.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
