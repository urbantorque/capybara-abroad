async page => {
  // THE FACE, FROM THE FRONT. frameShot's `yaw` is the bearing from the animal
  // TO the camera, so to see a face it has to be the direction the animal is
  // POINTING — capyRoot.rotation.y, which is what the model is turned by.
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)
  const out = { rows: [] }
  async function shot(tag) {
    await page.evaluate(() => {
      const g = window.__capy
      g.frameShot({ yaw: g.capy.animAudit().yaw, dist: 2.7, pitch: -0.05,
                    raise: 0.52, hold: 6 })
    })
    await page.waitForTimeout(1300)
    await page.screenshot({ path: 'qa/d8s-face-' + tag + '.png' })
    out.rows.push(Object.assign({ tag: tag },
      await page.evaluate(() => {
        const a = window.__capy.capy.animAudit()
        return { mood: +a.mood.toFixed(3), blink: +a.blink.toFixed(3) }
      })))
  }
  await shot('rest')
  await page.keyboard.press('KeyQ')
  await page.waitForTimeout(120)
  await page.screenshot({ path: 'qa/d8s-face-wheek.png' })
  out.rows.push(Object.assign({ tag: 'wheek' },
    await page.evaluate(() => {
      const a = window.__capy.capy.animAudit()
      return { mood: +a.mood.toFixed(3), blink: +a.blink.toFixed(3) }
    })))
  // ...and the other end of the scale: a refused hop, which is the face for
  // stamina that has run out.
  await page.evaluate(() => { window.__capy.state.stam = 0 })
  await page.waitForTimeout(2600)
  await shot('loaf')
  await page.evaluate(o => fetch('/shot?name=d8-faceshot.json',
      { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
