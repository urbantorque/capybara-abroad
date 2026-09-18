async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(8500)
  const out = { errs, rows: {} }
  const go = async (name) => {
    await page.evaluate((n) => window.__capy.biome.switchTo(n), name)
    await page.waitForTimeout(1200)
    const r = await page.evaluate(() => {
      const g = window.__capy
      let sun = null
      g.scene.traverse(o => { if (o.isDirectionalLight && o.castShadow && (!sun || o.intensity > sun.intensity)) sun = o })
      return sun ? { radius: sun.shadow.radius, normalBias: sun.shadow.normalBias, intensity: sun.intensity } : { none: true }
    })
    out.rows[name] = r
  }
  await go('sydney')   // baseline: flat, unnamed -> sysBIO_SH_NB[0] = 0.02
  await go('pasto')    // tall: sysBIO_SH_NB[1] = 0.05
  await go('iceland')  // named override -> 0.085
  await go('antarctic') // named override -> 0.09
  await go('pantanal') // named override -> 0.075
  await go('kyoto')    // unnamed, flat -> back to 0.02
  await page.evaluate(async (o) => { await fetch('/shot?name=wow-shadow-bias.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
