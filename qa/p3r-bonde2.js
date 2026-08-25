async page => {
  const errs = []
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)) })
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 160)))
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(800)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => { window.__capy.biome.switchTo('rio') })
  await page.waitForTimeout(4000)

  const out = { board: [], roof: [], errors: [] }
  // wait for tram 0 at the street terminus and standing
  for (let i = 0; i < 60; i++) {
    const x = await page.evaluate(() => window.__capy.rio.bonde().x)
    if (x > 37) break
    await page.waitForTimeout(600)
  }
  // exact running-board top: step 0.55 + half 0.07 = 0.62 ; z offset 0.72+0.34 = 1.06
  await page.evaluate(() => {
    const g = window.__capy, b = g.rio.bonde(), c = g.capy.body
    c.position.set(b.x, b.y + 0.62 + 0.42, b.z + 1.06); c.velocity.set(0, 0, 0)
    c.previousPosition.copy(c.position); c.interpolatedPosition.copy(c.position)
  })
  await page.waitForTimeout(1500)
  let shotA = false, shotB = false, shotC = false
  for (let i = 0; i < 70; i++) {
    await page.waitForTimeout(500)
    const s = await page.evaluate(() => {
      const g = window.__capy, b = g.rio.bonde(), c = g.capy.position
      return { bx: +b.x.toFixed(2), by: +b.y.toFixed(2),
               dx: +(c.x - b.x).toFixed(2), dy: +(c.y - b.y).toFixed(2), dz: +(c.z - b.z).toFixed(2),
               cy: +c.y.toFixed(2), grounded: g.capy.grounded,
               done: g.taskDone('o-bonde'), t: +g.state.time.toFixed(1) }
    })
    out.board.push(s)
    if (!shotA && s.by > 6) { shotA = true; await page.screenshot({ path: 'qa/p3r-bonde-ramp.png' }) }
    if (!shotB && s.by > 15 && s.bx < 5) { shotB = true; await page.screenshot({ path: 'qa/p3r-bonde-arches.png' }) }
    if (s.done && !shotC) { shotC = true; await page.screenshot({ path: 'qa/p3r-bonde-done.png' }) }
    if (Math.abs(s.dx) > 8) break
    if (s.done && i > 3) break
  }
  out.res1 = await page.evaluate(() => ({ done: window.__capy.taskDone('o-bonde') }))
  out.errors = errs.slice(0, 10)
  await page.evaluate(async o => {
    await fetch('/shot?name=p3r-bonde2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
