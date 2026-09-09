async page => {
  await page.reload()
  await page.waitForTimeout(4500)
  const errs = []
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  // install a synthetic pad BEFORE starting, so padPoll finds it
  await page.evaluate(() => {
    const mk = () => ({
      index: 0, connected: true, id: 'synthetic', mapping: 'standard',
      axes: window.__pad.axes,
      buttons: window.__pad.btn.map(v => ({ pressed: v > 0.5, value: v })),
      vibrationActuator: { playEffect: () => { window.__pad.rumbles++; return Promise.resolve('complete') } }
    })
    window.__pad = { axes: [0,0,0,0], btn: new Array(17).fill(0), rumbles: 0 }
    navigator.getGamepads = () => [mk()]
  })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1500)
  const out = {}
  out.idle = await page.evaluate(() => {
    const i = window.__capy.input
    return { x: +i.x.toFixed(3), z: +i.z.toFixed(3), run: i.run }
  })
  // left stick hard forward-right, past the run threshold
  await page.evaluate(() => { window.__pad.axes = [0.8, -0.8, 0, 0] })
  await page.waitForTimeout(500)
  out.stick = await page.evaluate(() => {
    const g = window.__capy, i = g.input
    return { x: +i.x.toFixed(3), z: +i.z.toFixed(3), run: i.run,
             sp: +Math.hypot(g.capy.velocity.x, g.capy.velocity.z).toFixed(2) }
  })
  // deadzone: a small nudge must be exactly zero
  await page.evaluate(() => { window.__pad.axes = [0.15, 0.10, 0, 0] })
  await page.waitForTimeout(300)
  out.dead = await page.evaluate(() => ({ x: +window.__capy.input.x.toFixed(3), z: +window.__capy.input.z.toFixed(3) }))
  await page.evaluate(() => { window.__pad.axes = [0,0,0,0] })
  await page.waitForTimeout(300)
  // A (0) = hop. Watch for the edge reaching a reader.
  const jump = await page.evaluate(async () => {
    const g = window.__capy
    let sawPressed = false, sawHeld = false, agree = true
    const y0 = g.capy.position.y
    const iv = setInterval(() => {
      if (g.input.jumpPressed) { sawPressed = true; if (!g.input.jump) agree = false }
      if (g.input.jump) sawHeld = true
    }, 4)
    window.__pad.btn[0] = 1
    await new Promise(r => setTimeout(r, 220))
    window.__pad.btn[0] = 0
    await new Promise(r => setTimeout(r, 400))
    clearInterval(iv)
    return { sawPressed, sawHeld, agree, rose: +(g.capy.position.y - y0).toFixed(2) }
  })
  out.jump = jump
  // B (1) = wheek
  out.wheek = await page.evaluate(async () => {
    const g = window.__capy
    let n = 0
    const off = () => { n++ }
    g.events.on('capy:wheek', off)
    window.__pad.btn[1] = 1
    await new Promise(r => setTimeout(r, 200))
    window.__pad.btn[1] = 0
    await new Promise(r => setTimeout(r, 400))
    g.events.off('capy:wheek', off)
    return { wheeks: n }
  })
  // right stick turns the camera
  out.look = await page.evaluate(async () => {
    const g = window.__capy
    const y0 = g.input.camYaw
    window.__pad.axes = [0, 0, 0.9, 0]
    await new Promise(r => setTimeout(r, 700))
    window.__pad.axes = [0,0,0,0]
    return { dYaw: +(g.input.camYaw - y0).toFixed(3) }
  })
  // rumble on a punch
  out.rumble = await page.evaluate(async () => {
    window.__pad.rumbles = 0
    window.__capy.punch(0.3)
    await new Promise(r => setTimeout(r, 120))
    const big = window.__pad.rumbles
    window.__pad.rumbles = 0
    await new Promise(r => setTimeout(r, 400))
    window.__capy.punch(0.05)   // under sysPAD_RUM_MIN: must stay still
    await new Promise(r => setTimeout(r, 120))
    return { big, small: window.__pad.rumbles }
  })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  out.errs = errs
  const payload = JSON.stringify(out)
  await page.evaluate(async (b) => {
    await fetch('/shot?name=gp-pad.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(b))) })
  }, payload)
}
