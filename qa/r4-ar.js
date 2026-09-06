async page => {
  // R4's ACCEPTANCE FRAMES. Exactly the cameras qa/art-review.js uses for the
  // capybara block, so the crops go straight back into the review sheet and are
  // comparable with the ones already on disk — and a standing three-quarter as
  // well, because the loaf is only half of what R4 changed.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)

  await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    window.__art = {
      cam(x, y, z, tx, ty, tz, fov) {
        const c = new T.PerspectiveCamera(fov || 32, 1280 / 760, 0.02, 900)
        c.position.set(x, y, z); c.lookAt(tx, ty, tz); c.updateMatrixWorld()
        return c
      },
      render(c) {
        // NO setSize: art-review.js renders at whatever the canvas already is
        // (896 x 532 here), and a crop at a different size is not comparable
        // with the one already in the sheet.
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
  const shot = async (name, fn) => {
    const url = await page.evaluate(fn)
    if (!url || url.length < 100) { errs.push(name + ': EMPTY'); return }
    await page.evaluate(async o => { await fetch('/shot?name=' + o.n, { method: 'POST', body: o.u }) },
                        { n: name, u: url })
  }

  await shot('AR-capy-3q', () => window.__art.capyShot(0.75, 3.0, 0.75, 0.25, 0.1))
  await shot('AR-capy-side', () => window.__art.capyShot(Math.PI / 2, 3.2, 0.55, 0.25, 0.0))
  await shot('AR-capy-rear3q', () => window.__art.capyShot(Math.PI - 0.7, 3.0, 0.8, 0.25, 0.0))
  await shot('AR-capy-front', () => window.__art.capyShot(0.0, 2.8, 0.45, 0.28, 0.2))
  // ...and closer on the loaf, because at 3 m a foot is forty pixels and the
  // point of R4 is what it is at arm's length.
  await shot('R4-loaf-close', () => window.__art.capyShot(0.62, 1.55, 0.20, 0.02, 0.30, 38))

  // standing: walk, release, shoot inside a quarter of a second (the same
  // reason qa/hull-stand.js does it that way — rest IS the loaf).
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(1400)
  await page.keyboard.up('KeyW')
  await shot('R4-stand-3q', () => window.__art.capyShot(0.75, 2.4, 0.55, 0.20, 0.1))
  await shot('R4-stand-close', () => window.__art.capyShot(0.55, 1.45, 0.18, 0.02, 0.28, 38))
  const loafNow = await page.evaluate(() => window.__capy.capy.loaf)

  await page.evaluate(async o => {
    await fetch('/shot?name=R4-ar.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, { errs, loafNow })
}
