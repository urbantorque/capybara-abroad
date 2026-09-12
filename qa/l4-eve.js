async page => {
  // L4 F2 — THE HOUR TURNS. Sydney, Venice, Pasto from the picker at the
  // settled lens: a frame at arrival, then hud.eveForce(1) (the evening in
  // full, as a finished chapter would have it) and a frame four seconds
  // later; eveAudit before and after. qa/l4e-<biome>-{day,eve}.png, read by
  // qa/l4r-art-value.mjs and qa/l4-bands.mjs. qa/l4-eve.json
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  const CH = [['sydney', 'Digit1'], ['venice', 'Digit0'], ['pasto', 'Digit2']]
  const out = { rows: [] }
  for (const [name, key] of CH) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(10000)
    const a0 = await page.evaluate(() => window.__capy.hud.eveAudit())
    await page.screenshot({ path: 'qa/l4e-' + name + '-day.png', timeout: 90000 })
    await page.evaluate(() => window.__capy.hud.eveForce(1))
    await page.waitForTimeout(4000)
    const a1 = await page.evaluate(() => window.__capy.hud.eveAudit())
    await page.screenshot({ path: 'qa/l4e-' + name + '-eve.png', timeout: 90000 })
    const rig = await page.evaluate(() => { const g = window.__capy; const sun = g.scene.children.find(o => o.isDirectionalLight && o.castShadow); const hemi = g.scene.children.find(o => o.isHemisphereLight)
      return { sun: +sun.intensity.toFixed(2), hemi: +hemi.intensity.toFixed(2), key: g.hud.keyAudit().live } })
    out.rows.push({ name, biome: await page.evaluate(() => window.__capy.biome.current), day: a0, eve: a1, rig, err: await page.evaluate(() => window.__capy.state.lastError || null) })
  }
  await page.evaluate((o) => fetch('/shot?name=l4-eve.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
