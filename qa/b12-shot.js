async page => {
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)
  await page.evaluate(() => { window.__capy.hud.cross('kyoto') })
  await page.waitForTimeout(13000)
  const s = await page.evaluate(() => {
    const g = window.__capy
    const live = g.biome.current
    for (const L of (g.locals || [])) {
      if (L && L.biome === live && L.tool && !L.toolOut) { window.__W = L; return { tool: L.tool.type } }
    }
    return { err: 'none' }
  })
  const frame = async () => page.evaluate(() => {
    const g = window.__capy, W = window.__W
    g.capy.body.position.set(W.ax + 2.6, W.y + 0.5, W.az + 2.6)
    g.capy.body.velocity.set(0, 0, 0)
    if (typeof g.frameShot === 'function') {
      g.frameShot({ yaw: Math.atan2(2.6, 2.6), dist: 4.6, pitch: 0.36, raise: 1.0, hold: 9 })
    }
  })
  await frame()
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'qa/B12-tool-here.png' })
  // Take it, and stand back where the camera was.
  // TAKE IT OUT OF THE WORLD RATHER THAN OUT OF THE MOUTH. Holding it makes
  // the owner walk over and take it back within seconds — which is the
  // mechanic working and is exactly what makes it hard to photograph. The
  // errand is held off so the absence lasts long enough to catch a stroke in.
  const took = await page.evaluate(() => {
    const g = window.__capy, W = window.__W
    const p = W.tool
    p.body.position.set(W.ax + 40, W.y + 0.2, W.az + 40)
    p.body.velocity.set(0, 0, 0)
    p.body.previousPosition.copy(p.body.position)
    p.body.interpolatedPosition.copy(p.body.position)
    W.ownCool = 999
    W.own = null
    return { ok: true }
  })
  await page.waitForTimeout(600)
  await frame()
  // Wait for a stroke to be in progress, then catch it.
  const caught = await page.evaluate(async () => {
    const W = window.__W
    for (let i = 0; i < 200; i++) {
      if (W.toolOut && W.beatP > 0.40 && W.beatP < 0.85) {
        return { beatP: +W.beatP.toFixed(2), fails: W.toolFail, out: !!W.toolOut }
      }
      await new Promise(r => setTimeout(r, 60))
    }
    return { beatP: -1, fails: W.toolFail, out: !!W.toolOut }
  })
  await page.screenshot({ path: 'qa/B12-tool-gone.png' })
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=b12-shot.json', { method: 'POST', body: s })
  }, { s: s, took: took, caught: caught, errs: errs })
}
