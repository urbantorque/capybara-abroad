async page => {
  // G5 — THE LIVING ARE ROUND. The animal's eight-azimuth contact sheet, own
  // camera, raw scene render (no composite), so the model is judged as a model.
  // Copied from qa/art-review.js's capyShot. Two sets when the toggle exists:
  // `game.state.noRound = true` (flat) and false (round), same pose, same sun.
  // Plus a head close-up per state and ONE composite play-distance frame
  // (frameShot, ~7 m) for the eye fleck at the distance the game is played at.
  const PREFIX = 'WR2'
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)
  const out = { shots: [], errs }

  await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    window.__art = {
      cam(px, py, pz, tx, ty, tz, fov) {
        const c = new T.PerspectiveCamera(fov || 34, 1280 / 760, 0.05, 400)
        c.position.set(px, py, pz); c.lookAt(tx, ty, tz); c.updateMatrixWorld()
        return c
      },
      render(c) {
        g.renderer.setRenderTarget(null)
        g.renderer.render(g.scene, c)
        return g.renderer.domElement.toDataURL('image/png')
      },
      capyShot(yawOff, dist, up, aimY, aimFwd, fov) {
        const p = g.capy.position
        const my = (g.capy.model || g.capy.group).rotation.y
        const fx = Math.sin(my), fz = Math.cos(my)
        const ax = p.x + fx * (aimFwd || 0), az = p.z + fz * (aimFwd || 0), ay = p.y + (aimY || 0)
        const yaw = my + yawOff
        return this.render(this.cam(ax + Math.sin(yaw) * dist, ay + up, az + Math.cos(yaw) * dist, ax, ay, az, fov))
      }
    }
  })
  const post = async (name, url) => {
    await page.evaluate(async (o) => { await fetch('/shot?name=' + o.n, { method: 'POST', body: o.u }) }, { n: name, u: url })
    out.shots.push(name)
  }
  const shot = async (name, fn, arg) => {
    try {
      const url = await page.evaluate(fn, arg)
      if (url && url.length > 100) await post(name, url); else out.shots.push(name + ':EMPTY')
    } catch (e) { errs.push(name + ': ' + String(e.message || e)) }
  }

  // hold the animal still: pause the sim so both sets share one pose
  await page.evaluate(() => { window.__capy.state.paused = true })
  await page.waitForTimeout(300)

  for (const [tag, noRound] of [['flat', true], ['round', false]]) {
    await page.evaluate((v) => { window.__capy.state.noRound = v }, noRound)
    // one unpaused frame so a live toggle can act, then hold again
    await page.evaluate(() => { window.__capy.state.paused = false })
    await page.waitForTimeout(120)
    await page.evaluate(() => { window.__capy.state.paused = true })
    await page.waitForTimeout(200)
    out[tag] = await page.evaluate(() => {
      const g = window.__capy
      const r = g.hud && g.hud.canopyAudit ? g.hud.canopyAudit().rim : null
      return { noRound: g.state.noRound, rim: r, round: g.capy.roundInfo ? g.capy.roundInfo() : null }
    })
    for (let i = 0; i < 8; i++) {
      const yaw = i * Math.PI / 4
      await shot(PREFIX + '-' + tag + '-' + i, (a) => window.__art.capyShot(a, 3.0, 0.75, 0.25, 0.1), yaw)
    }
    await shot(PREFIX + '-' + tag + '-head', () => window.__art.capyShot(0.62, 1.55, 0.2, 0.26, 0.52, 38))
    await shot(PREFIX + '-' + tag + '-feet', () => window.__art.capyShot(0.35, 1.6, 0.05, 0.05, 0.3, 34))
  }

  // play distance: the game's own frame (composite), round state
  await page.evaluate(() => { window.__capy.state.noRound = false; window.__capy.state.paused = false })
  await page.waitForTimeout(200)
  await page.evaluate(() => {
    const g = window.__capy
    const my = (g.capy.model || g.capy.group).rotation.y
    g.frameShot({ yaw: my + 0.6, dist: 7, pitch: 0.05, raise: 1.1, hold: 6 })
  })
  await page.waitForTimeout(2600)
  await page.screenshot({ path: 'qa/' + PREFIX + '-play.png' }); out.shots.push(PREFIX + '-play')
  // ...and the resting lens itself, as it is
  await page.waitForTimeout(6500)
  await page.screenshot({ path: 'qa/' + PREFIX + '-rest.png' }); out.shots.push(PREFIX + '-rest')
  return out
}
