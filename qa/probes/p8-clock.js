async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1100, height: 660 })
  await page.goto('http://localhost:5188/')
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(6500)
  const out = { errs: [] }

  // ---- 1. fps must be a WALL-CLOCK number ---------------------------------
  // The perf readout is the only place fps is visible, so it is turned on and
  // read. Under slow motion the scaled clock crawls: an fps built from it
  // reads high, and it is the number that drives adaptive resolution.
  out.fps = await page.evaluate(async () => {
    const g = window.__capy
    const read = () => {
      const el = document.querySelector('.capyui-perf') ||
                 Array.from(document.querySelectorAll('div,pre'))
                   .find(e => /(^|\n)fps\s/.test(e.textContent || ''))
      if (!el) return null
      const m = (el.textContent || '').match(/fps\s+(\d+)/)
      return m ? +m[1] : null
    }
    // BACKQUOTE, not P. P is the camera; the perf readout is on the backtick,
    // and pressing the wrong one would have put this probe into photo mode and
    // then read a number that was never on the screen.
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote', key: '`', bubbles: true }))
    await new Promise(r => setTimeout(r, 1400))
    const normal = read()
    // now hold the world at a fraction of real time and read again
    if (g.slowmo) g.slowmo(0.25, 4)
    await new Promise(r => setTimeout(r, 2000))
    const slow = read()
    const scale = g.state.timeScale
    await new Promise(r => setTimeout(r, 4000))
    const after = read()
    return { normal: normal, slow: slow, after: after, scaleDuringSlow: scale }
  })

  // ---- 2. a kinematic body with a NaN velocity is repaired -----------------
  // mainSaneWorld skipped mass<=0 outright, and those are every carrier in the
  // game — the things the animal stands ON.
  out.kinematic = await page.evaluate(async () => {
    const g = window.__capy
    const bodies = g.world.bodies
    const kin = bodies.filter(b => b.mass <= 0)
    if (!kin.length) return { none: true, total: bodies.length }
    const b = kin[Math.floor(kin.length / 2)]
    const before = g.state.solverSaves || 0
    const px = b.position.x
    b.velocity.set(NaN, NaN, NaN)
    await new Promise(r => setTimeout(r, 500))
    const vFixed = b.velocity.x === b.velocity.x
    // ...and a runaway, which must be clamped and not zeroed
    b.velocity.set(9999, 0, 0)
    await new Promise(r => setTimeout(r, 500))
    const sp = Math.hypot(b.velocity.x, b.velocity.y, b.velocity.z)
    b.velocity.set(0, 0, 0)
    return { kinematicBodies: kin.length, nanRepaired: vFixed,
             clampedTo: Math.round(sp),
             posUntouched: Math.abs(b.position.x - px) < 50,
             saves: (g.state.solverSaves || 0) - before }
  })

  out.errs = errs
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p8-clock.json', { method: 'POST', body: s })
  }, out)
}
