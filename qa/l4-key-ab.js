async page => {
  // L4 E1 (a1) — THE KEY, SAME LENS, SAME WEATHER. All nineteen chapters at the
  // settled lens: a frame with the key as shipped, then game.state.noKey for
  // half a second and a second frame. The value script's p50 on the pair is
  // the honest test of "the lit value is held" — the morning's before-set was
  // taken at a different lens in three chapters (Rio, Manly, Antarctica were
  // caught mid-walk) and under other weather everywhere, so a before/after on
  // it confounds the key with the framing. Frames: qa/l4k-<biome>-{on,off}.png
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })   // pinned to 'pretty' (a1): the perf governor under load is not the picture
  const KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0',
    'Minus', 'Equal', 'BracketLeft', 'BracketRight', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash']
  const out = { rows: [] }
  for (const key of KEYS) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(10000)
    const rig = () => page.evaluate(() => {
      const g = window.__capy
      const sun = g.scene.children.find(o => o.isDirectionalLight && o.castShadow)
      const hemi = g.scene.children.find(o => o.isHemisphereLight)
      const amb = g.scene.children.find(o => o.isAmbientLight)
      const fill = g.scene.children.find(o => o.isDirectionalLight && !o.castShadow)
      const sd = sun.position.clone().sub(sun.target.position).normalize()
      const S = sun.intensity, H = hemi.intensity, A = amb.intensity, F = fill.intensity
      const L = c => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
      const lumaRatio = (S * sd.y * L(sun.color)) / ((H + F) * L(hemi.color) + A * L(amb.color))
      return { sun: +S.toFixed(2), hemi: +H.toFixed(2), amb: +A.toFixed(2), fill: +F.toFixed(2),
               ratio: +((S * sd.y) / (H + A + F)).toFixed(2), lumaRatio: +lumaRatio.toFixed(2), lit: +(S * sd.y + H + A + F).toFixed(2), elev: +(Math.asin(sd.y) * 180 / Math.PI).toFixed(0) }
    })
    const name = await page.evaluate(() => window.__capy.biome.current)
    const on = await rig()
    await page.screenshot({ path: 'qa/l4k-' + name + '-on.png', timeout: 90000 })
    await page.evaluate(() => { window.__capy.state.noKey = true })
    await page.waitForTimeout(500)
    const off = await rig()
    await page.screenshot({ path: 'qa/l4k-' + name + '-off.png', timeout: 90000 })
    await page.evaluate(() => { window.__capy.state.noKey = false })
    const err = await page.evaluate(() => window.__capy.state.lastError || null)
    const ka = await page.evaluate(() => window.__capy.hud.keyAudit())
    const pf = await page.evaluate(() => window.__capy.perfAudit ? window.__capy.perfAudit() : null)
    out.rows.push({ key, name, on, off, live: ka.live, rung: pf && pf.rung, dpr: pf && pf.dpr, shadowRes: pf && pf.shadow, err })
  }
  await page.evaluate((o) => fetch('/shot?name=l4-key-ab.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
