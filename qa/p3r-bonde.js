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

  const out = { climb: [], ride: [], errors: [] }

  // ---- 1. THE KIOSK CLIMB, the intended route: crate -> counter -----------
  out.climbGeom = await page.evaluate(() => {
    const g = window.__capy, b = g.capy.body
    const ky = g.rio.terrainHeight(-8, -6)
    b.position.set(-5.9, ky + 1.45 + 0.4, -8.0); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    return { ky, crateTop: ky + 1.40, counterTop: ky + 2.11 }
  })
  await page.waitForTimeout(1200)
  out.onCrate = await page.evaluate(() => ({ y: +window.__capy.capy.position.y.toFixed(2),
    x: +window.__capy.capy.position.x.toFixed(2), z: +window.__capy.capy.position.z.toFixed(2),
    grounded: window.__capy.capy.grounded }))
  // hop west onto the counter, closed loop for 4 s
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => {
      const g = window.__capy
      const yaw = g.input.camYaw || 0
      // want world -x. camera-relative: pick the key whose world dir is closest.
      const dirs = { KeyW: [-Math.sin(yaw), -Math.cos(yaw)], KeyS: [Math.sin(yaw), Math.cos(yaw)],
                     KeyA: [-Math.cos(yaw), Math.sin(yaw)], KeyD: [Math.cos(yaw), -Math.sin(yaw)] }
      let best = 'KeyW', bd = -9
      for (const k in dirs) { const d = dirs[k][0] * -1 + dirs[k][1] * 0; if (d > bd) { bd = d; best = k } }
      window.__qaKey = best
      return best
    })
    const k = await page.evaluate(() => window.__qaKey)
    await page.keyboard.down(k)
    await page.keyboard.press('Space')
    await page.waitForTimeout(400)
    await page.keyboard.up(k)
    const s = await page.evaluate(() => ({ y: +window.__capy.capy.position.y.toFixed(2),
      x: +window.__capy.capy.position.x.toFixed(2), z: +window.__capy.capy.position.z.toFixed(2) }))
    out.climb.push(s)
    if (s.y > out.climbGeom.counterTop + 0.1 && s.x < -6.5) break
  }
  await page.screenshot({ path: 'qa/p3r-kiosk-climb.png' })

  // ---- 2. O BONDE --------------------------------------------------------
  out.bondeGeom = await page.evaluate(() => {
    const g = window.__capy
    return { deckY: g.rio.lapa, t0: g.rio.bonde().toArray ? g.rio.bonde().toArray() : [g.rio.bonde().x, g.rio.bonde().y, g.rio.bonde().z] }
  })
  // wait for tram 0 down at the street terminus
  for (let i = 0; i < 60; i++) {
    const x = await page.evaluate(() => window.__capy.rio.bonde().x)
    if (x > 34) break
    await page.waitForTimeout(600)
  }
  await page.evaluate(() => {
    const g = window.__capy, b = g.rio.bonde()
    const c = g.capy.body
    c.position.set(b.x, b.y + 1.3, b.z + 1.4); c.velocity.set(0, 0, 0)
    c.previousPosition.copy(c.position); c.interpolatedPosition.copy(c.position)
  })
  await page.waitForTimeout(1000)
  let shotDeck = false, shotPass = false
  for (let i = 0; i < 70; i++) {
    await page.waitForTimeout(600)
    const s = await page.evaluate(() => {
      const g = window.__capy, b = g.rio.bonde(), c = g.capy.position
      return { bx: +b.x.toFixed(1), by: +b.y.toFixed(2), cy: +c.y.toFixed(2),
               gap: +Math.hypot(c.x - b.x, c.z - b.z).toFixed(2),
               done: g.taskDone('o-bonde'), t: +g.state.time.toFixed(1) }
    })
    out.ride.push(s)
    if (!shotDeck && s.by > 12) { shotDeck = true; await page.screenshot({ path: 'qa/p3r-bonde-deck.png' }) }
    if (s.done && !shotPass) { shotPass = true; await page.screenshot({ path: 'qa/p3r-bonde-done.png' }) }
    if (s.done && i > 4) break
    if (s.gap > 6) break
  }
  out.final = await page.evaluate(() => {
    const g = window.__capy
    const todo = document.querySelector('.capyui-todo')
    return { obonde: g.taskDone('o-bonde'), kiosk: g.taskDone('kiosk'),
             card: todo ? (todo.innerText || '').replace(/\n/g, ' | ').slice(0, 400) : 'NONE' }
  })
  out.errors = errs.slice(0, 10)
  await page.evaluate(async o => {
    await fetch('/shot?name=p3r-bonde.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
