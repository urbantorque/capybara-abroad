async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit5') // cali, sysSELF.cali = 0.26
  await page.waitForTimeout(8500)
  const out = { errs, on: [], off: [] }
  const sample = async (arr) => {
    for (let i = 0; i < 8; i++) {
      const yaw = (i / 8) * Math.PI * 2
      await page.evaluate((y) => window.__capy.frameShot({ yaw: y, dist: 6, pitch: 0.1, raise: 1.0, hold: 6 }), yaw)
      await page.waitForTimeout(700)
      const r = await page.evaluate(() => window.__capy.hud.canopyAudit().rim.self)
      arr.push(+r.toFixed(4))
    }
  }
  await sample(out.on)
  await page.evaluate(() => { window.__capy.state.noCapyRim = true })
  await page.waitForTimeout(300)
  await sample(out.off)
  await page.evaluate(async (o) => { await fetch('/shot?name=wow-capy-rim.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
