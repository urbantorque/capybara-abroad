async page => {
  // FOUR PICTURES THE COUNTERS CANNOT TAKE.
  //
  // Every one of them has to be taken WHILE the thing is happening, which is
  // the whole difficulty: the first cut of this screenshotted after the probe
  // had let go of the key and photographed a capybara standing on a bin.
  //
  // The camera goes through game.frameShot, which always looks at the animal —
  // so for the herd the animal is put IN FRONT OF them and the lens behind it.
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  const out = {}

  async function chapter(key) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(9000)
  }

  // ---- 1. on the wall -----------------------------------------------------
  await chapter('Minus')
  await page.evaluate(() => {
    const g = window.__capy
    const s = g.kowloon.scaffold
    g.capy.body.position.set(s.x - 1.2, 3.4, s.z)
    g.capy.body.velocity.set(0, 0, 0)
  })
  await page.waitForTimeout(1200)
  await page.keyboard.down('KeyE')
  await page.waitForTimeout(2600)
  // Side on, because a climb read from behind is a capybara-shaped hole.
  await page.evaluate(() => {
    window.__capy.frameShot({ yaw: 1.75, dist: 4.6, pitch: -0.10, raise: 1.6, hold: 6 })
  })
  await page.waitForTimeout(1400)
  await page.screenshot({ path: 'qa/d8s-climb.png' })
  out.climb = await page.evaluate(() => {
    const a = window.__capy.capy.animAudit()
    return { pose: +a.climbPose.toFixed(3), pitch: +a.pitch.toFixed(3),
             legX: a.legX.map(v => +v.toFixed(2)) }
  })
  await page.keyboard.up('KeyE')

  // ---- 2. the herd, in front of the lens ----------------------------------
  await chapter('Semicolon')
  await page.evaluate(() => {
    const g = window.__capy
    const h = g.pantanal.herd()
    // Six metres past them, so they are between the animal and the camera.
    g.capy.body.position.set(h.x, g.pantanal.terrainHeight(h.x, h.z + 7) + 0.6, h.z + 7)
    g.capy.body.velocity.set(0, 0, 0)
  })
  await page.waitForTimeout(2500)
  // Three wheeks recruits them, and a recruited animal RUNS — which is the
  // speed the old fixed 8 rad/s bob was most wrong at.
  for (let i = 0; i < 3; i++) { await page.keyboard.press('KeyQ'); await page.waitForTimeout(700) }
  await page.waitForTimeout(2500)
  await page.evaluate(() => {
    const g = window.__capy
    const h = g.pantanal.herd()
    const c = g.capy.position
    g.frameShot({ yaw: Math.atan2(c.x - h.x, c.z - h.z) + 1.1,
                  dist: 9.5, pitch: 0.10, raise: 1.5, hold: 6 })
  })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'qa/d8s-herd.png' })
  out.herd = await page.evaluate(() => {
    const a = window.__capy.pantanal.herdAudit()
    return { legs: a.legs, moving: a.rows.filter(r => r.moving).length,
             footHz: a.rows.map(r => r.footHz) }
  })

  // ---- 3. the crowd, talking ----------------------------------------------
  await chapter('Digit1')
  // Stand in the middle of the promenade and wait for somebody to say something
  // to somebody else — chatStep runs on its own clock and needs no prompting.
  out.crowd = await page.evaluate(() => new Promise(res => {
    const g = window.__capy
    let n = 0, best = null
    const t = setInterval(() => {
      const a = g.gestAudit()
      if (a.talking > 0 && a.armMax > 0.35) { best = a; clearInterval(t); res(best); return }
      if (++n > 200) { clearInterval(t); res(a) }
    }, 100)
  }))
  await page.evaluate(() => {
    window.__capy.frameShot({ yaw: 0.6, dist: 7.5, pitch: 0.08, raise: 1.5, hold: 5 })
  })
  await page.waitForTimeout(1400)
  await page.screenshot({ path: 'qa/d8s-crowd.png' })

  // ---- 4. the face, at the top of a wheek ---------------------------------
  await page.evaluate(() => {
    window.__capy.frameShot({ yaw: 0.2, dist: 2.4, pitch: -0.02, raise: 0.55, hold: 6 })
  })
  await page.waitForTimeout(1600)
  await page.screenshot({ path: 'qa/d8s-face-rest.png' })
  await page.keyboard.press('KeyQ')
  await page.waitForTimeout(260)
  await page.screenshot({ path: 'qa/d8s-face-wheek.png' })
  out.face = await page.evaluate(() => {
    const a = window.__capy.capy.animAudit();
    return { mood: +a.mood.toFixed(3), blink: +a.blink.toFixed(3) }
  })

  await page.evaluate(o => fetch('/shot?name=d8-shots.json',
      { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
