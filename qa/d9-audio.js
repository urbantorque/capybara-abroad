async page => {
  // D9: the three audio changes, and the two clocks.
  //
  //   THE VOICE CEILING must be invisible in ordinary play and must actually
  //   fire on a cascade. Both halves matter: a cap that never engages is one
  //   nobody can tell is there, and one that engages while you are walking
  //   about is eating the game's own sounds. `mixAudit().voiceDrops` is the
  //   number.
  //
  //   THE RUSH BED is 0 on the ground at a sprint and non-zero off it.
  //   `mixAudit().rush` is the level the fifth bed voice is being driven at.
  //
  //   THE TWO NEW CLOCKS. Sydney's ferry and Pasto's float are both "be there
  //   when X happens" and neither published `nextIn` — chapter one's very
  //   first waiting task had no clock at all. Sampled over half a minute so
  //   the countdown is seen to COUNT rather than merely to answer.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1100, height: 660 })
  const out = { errs: [] }

  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)
  out.sydney = await page.evaluate(async () => {
    const g = window.__capy
    const rows = []
    // the ferry clock, sampled for 40 s
    for (let i = 0; i < 40; i++) {
      rows.push(Math.round(g.env.nextIn('ferry-ride') * 10) / 10)
      await new Promise(r => setTimeout(r, 1000))
    }
    return { clock: rows, other: g.env.nextIn('wheek'),
             mix: g.hud.mixAudit() }
  })
  // ...and the rush, on the ground at a sprint, then off a hop
  out.rush = await page.evaluate(async () => {
    const g = window.__capy
    const read = () => { const m = g.hud.mixAudit(); return m ? m.rush : null }
    // A SPRINT ACROSS A LAWN MUST BE SILENT. `input.x/z` are rebuilt from the
    // key state every frame, so they are written every tick.
    let onGround = 0
    for (let i = 0; i < 200; i++) {
      g.input.z = 1; g.input.run = true
      const v = read()
      if (v > onGround) onGround = v
      await new Promise(r => setTimeout(r, 12))
    }
    g.input.z = 0; g.input.run = false
    // ...and a hop cannot answer the other half: the animal leaves the ground
    // at about 6.3 m/s against a floor of 6.5, on purpose. The Drift is where
    // a fall is long enough — see qa/d9-rush.js, which measures 0.851 at
    // 23.1 m/s.
    const inAir = null
    // ...and a cascade: twenty different sounds inside one tenth of a second,
    // which is what a shelf of crates going over actually is.
    // TWENTY DISTINCT NAMES, not ten repeated. The per-name throttle sits
    // ABOVE the voice ceiling, so a second 'thud' inside its own gap never
    // reaches the cap at all — the first cut of this fired ten names three
    // times each, twenty of the thirty were thrown away before the ceiling saw
    // them, and it reported a working cap as dead.
    const before = g.hud.mixAudit().voiceDrops
    const names = ['thud','clink','pop','rustle','splash','gull','bark','horn','chime','tick',
                   'step','cheer','drip','strum','hiss','whistle','gasp','wheek','organ','tram']
    for (const n of names) g.sfx(n, { volume: 0.12 })
    const after = g.hud.mixAudit().voiceDrops
    return { sprintOnGround: onGround, peakInAir: inAir,
             dropsBefore: before, dropsAfterCascade: after }
  })

  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit2')
  await page.waitForTimeout(11000)
  out.pasto = await page.evaluate(async () => {
    const g = window.__capy
    const rows = []
    for (let i = 0; i < 40; i++) {
      rows.push(Math.round(g.pasto.nextIn('carroza') * 10) / 10)
      await new Promise(r => setTimeout(r, 1000))
    }
    return { clock: rows, other: g.pasto.nextIn('condor-ride') }
  })

  out.errs = errs
  await page.evaluate((o) => fetch('/shot?name=d9-audio.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
