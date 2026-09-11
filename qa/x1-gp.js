async page => {
  // x1-gp: the Grand Prix. Walk to the red car, E, the lights, W held with one
  // move to the right lane; sample the live line and the race state every
  // second; expect the lap to complete and the task to tick.
  await page.setViewportSize({ width: 1200, height: 700 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(4500)
  await page.keyboard.press('Digit1'); await page.waitForTimeout(3500)
  const hold = async (code, ms) => { await page.keyboard.down(code); await page.waitForTimeout(ms); await page.keyboard.up(code) }
  const tp = (x, y, z) => page.evaluate(([x, y, z]) => {
    const g = window.__capy; const b = g.capy.body; b.position.set(x, y, z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
  }, [x, y, z])
  const live = () => page.evaluate(() => (document.querySelector('.capyui-marqlive') || {}).textContent)
  const race = () => page.evaluate(() => window.__capy.monaco.race())
  await page.evaluate(() => window.__capy.biome.switchTo('monaco')); await page.waitForTimeout(3500)
  const car = await page.evaluate(() => window.__capy.monaco.gridCar())
  await tp(car.x + 2.5, 9.5, car.z + 1); await page.waitForTimeout(800)
  const out = { car: car, before: await race() }
  await page.keyboard.press('KeyE'); await page.waitForTimeout(400)
  out.took = await race()
  out.toast0 = await page.evaluate(() => Array.from(document.querySelectorAll('.capyui-toast')).map(e => e.textContent).join(' / '))
  await page.waitForTimeout(2400)
  await page.screenshot({ path: 'qa/x1-grid.png' })
  await page.waitForTimeout(1000)   // the lights
  out.go = await race()
  await page.keyboard.down('KeyW')
  await hold('KeyD', 550)
  const samples = []
  let ticked = false
  for (let i = 0; i < 70; i++) {
    await page.waitForTimeout(1000)
    const r = await race()
    samples.push({ t: i + 1, s: +r.s.toFixed(0), v: +r.v.toFixed(1), lat: +r.lat.toFixed(2), passed: r.passed, lap: r.lap, line: await live() })
    if (i === 6) await page.screenshot({ path: 'qa/x1-run.png' })
    if (r.lap >= 1) { ticked = await page.evaluate(() => window.__capy.taskDone('the-tunnel')); break }
    // stuck behind one: move over
    if (samples.length > 2 && /behind one/.test(samples[samples.length - 1].line || '')) await hold('KeyD', 300)
  }
  await page.keyboard.up('KeyW')
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'qa/x1-done.png' })
  out.samples = samples; out.ticked = ticked
  out.after = await race()
  out.toasts = await page.evaluate(() => Array.from(document.querySelectorAll('.capyui-toast')).map(e => e.textContent).join(' / '))
  out.capy = await page.evaluate(() => { const c = window.__capy.capy; const p = c.position; return { p: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], atHelm: c.atHelm, sailing: window.__capy.state.sailing } })
  // get out
  await page.keyboard.press('KeyS'); await page.waitForTimeout(2500)
  await page.keyboard.press('KeyE'); await page.waitForTimeout(500)
  out.left = await race()
  out.capyLeft = await page.evaluate(() => { const c = window.__capy.capy; const p = c.position; return { p: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], atHelm: c.atHelm, sailing: window.__capy.state.sailing } })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(async (o) => { await fetch('/shot?name=x1gp.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
