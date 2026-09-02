async page => {
  // Review shots, 3 Sep 2026: the title, then the resting frame of twelve
  // chapters entered through the picker key, then a run and a wheek in Sydney.
  // Judged from the PNG, never from a metric.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.screenshot({ path: 'qa/rv-title.png' })

  const KEYS = ['Digit1', 'Digit3', 'Digit4', 'Digit6', 'Digit8', 'Digit0', 'Minus', 'Equal', 'BracketRight', 'Comma', 'Period', 'Slash']
  const out = { rows: [], errs: [] }
  for (const key of KEYS) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(13000)
    const info = await page.evaluate(() => {
      const g = window.__capy
      const c = g.camInfo || {}
      return { biome: g.biome.current, clear: c.clear, fov: g.camera.fov, dpr: g.renderer.getPixelRatio(),
               calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles }
    })
    await page.screenshot({ path: 'qa/rv-' + info.biome + '.png' })
    out.rows.push(Object.assign({ key: key }, info))
  }

  // Sydney: a run shot and a wheek shot
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)
  await page.keyboard.down('ShiftLeft')
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(2600)
  await page.screenshot({ path: 'qa/rv-sydney-run.png' })
  await page.keyboard.up('KeyW')
  await page.keyboard.up('ShiftLeft')
  await page.waitForTimeout(1500)
  await page.keyboard.press('KeyQ')
  await page.waitForTimeout(350)
  await page.screenshot({ path: 'qa/rv-sydney-wheek.png' })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'qa/rv-sydney-pause.png' })

  out.errs = errs
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=rv-shots.json', { method: 'POST', body: s })
  }, out)
}
